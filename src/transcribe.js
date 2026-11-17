// Live speech-to-text over the Gemini Live API (WebSocket), with automatic
// endpoint fallback (AI Studio + Vertex AI Express Mode `AQ.` keys) and
// near-real-time chunked REST transcription fallback if WebSockets are blocked.
// Every failure is silent: recording must never depend on the network.

const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const AI_STUDIO_WS =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const VERTEX_EXPRESS_WS =
  'wss://aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';

const WS_CANDIDATES = [
  {
    name: 'aistudio-transcribe-live',
    url: AI_STUDIO_WS,
    setup: {
      model: 'models/gemini-3.5-transcribe-live',
      generationConfig: { responseModalities: ['TEXT'] },
      inputAudioTranscription: {},
    },
  },
  {
    name: 'aistudio-flash-live',
    url: AI_STUDIO_WS,
    setup: {
      model: 'models/gemini-2.0-flash-live-001',
      generationConfig: { responseModalities: ['AUDIO'] },
      inputAudioTranscription: {},
    },
  },
  {
    name: 'vertex-express-live',
    url: VERTEX_EXPRESS_WS,
    setup: {
      model: 'publishers/google/models/gemini-2.0-flash-live-001',
      generationConfig: { responseModalities: ['AUDIO'] },
      inputAudioTranscription: {},
    },
  },
];

const REST_TRANSCRIBE_PROMPT =
  'Transcribe the spoken words in this audio recording verbatim in the language spoken. ' +
  'Return ONLY the spoken words as plain text with natural punctuation. ' +
  'If there is only silence or background noise with no speech, return an empty string.';

export const transcriptionAvailable = !!KEY;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + '=';
  }
  return out;
}

function utf8(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}

/** Wrap raw 16-bit mono little-endian PCM chunks in a 44-byte WAV container and base64-encode it. */
function pcmChunksToWavBase64(chunks, sampleRate = 16000) {
  let dataBytes = 0;
  for (let i = 0; i < chunks.length; i++) dataBytes += chunks[i].byteLength;
  if (dataBytes < 1600) return null; // < 50ms at 16kHz

  const wav = new Uint8Array(44 + dataBytes);
  const view = new DataView(wav.buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) wav[off + i] = str.charCodeAt(i);
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audioFormat = 1 (PCM integer)
  view.setUint16(22, 1, true); // channels = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byteRate
  view.setUint16(32, 2, true); // blockAlign
  view.setUint16(34, 16, true); // bitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < chunks.length; i++) {
    wav.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return toBase64(wav);
}

let workingRestEndpointIdx = null;

const FILE_MIME = {
  wav: 'audio/wav',
  m4a: 'audio/m4a',
  aac: 'audio/aac',
  mp3: 'audio/mp3',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
};

function mimeFromUri(uri = '') {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return FILE_MIME[ext] || 'audio/wav';
}

async function readAudioUriBase64(uri) {
  if (!uri) return null;
  try {
    if (!uri.startsWith('blob:') && !uri.startsWith('http') && !uri.startsWith('data:')) {
      const FileCls = require('expo-file-system').File;
      const file = new FileCls(uri);
      if (!file.exists || !file.size || file.size > 14 * 1024 * 1024) return null;
      return { base64: await file.base64(), mimeType: mimeFromUri(uri) };
    }
    const blob = await (await fetch(uri)).blob();
    if (!blob.size || blob.size > 14 * 1024 * 1024) return null;
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result.split(',')[1] || null : null);
      reader.readAsDataURL(blob);
    });
    return base64 ? { base64, mimeType: blob.type || mimeFromUri(uri) } : null;
  } catch {
    return null;
  }
}

async function transcribeWavViaRest(wavBase64, mimeType = 'audio/wav') {
  if (!KEY || !wavBase64) return null;

  const generateBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { text: REST_TRANSCRIBE_PROMPT },
          { inlineData: { mimeType, data: wavBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  });

  const endpoints = [
    // Vertex AI Express Mode (supports AQ.* keys bound to Vertex AI)
    async () => {
      const res = await fetch(
        `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(KEY)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: generateBody }
      );
      if (!res.ok) return null;
      const json = await res.json();
      const txt = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
      return txt.trim();
    },
    // Google AI Studio generateContent
    async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(KEY)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: generateBody }
      );
      if (!res.ok) return null;
      const json = await res.json();
      const txt = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
      return txt.trim();
    },
    // Gemini Interactions API (gemini-4-hydrogen)
    async () => {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': KEY,
          'Api-Revision': '2026-05-20',
        },
        body: JSON.stringify({
          model: 'gemini-4-hydrogen',
          input: [
            { type: 'text', text: REST_TRANSCRIBE_PROMPT },
            { type: 'audio', data: wavBase64, mime_type: mimeType },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const txt = (json?.steps || [])
        .filter((s) => s.type === 'model_output')
        .flatMap((s) => s.content || [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
      return txt.trim();
    },
  ];

  // Try cached working endpoint first if known
  const order =
    workingRestEndpointIdx !== null
      ? [workingRestEndpointIdx, ...endpoints.map((_, i) => i).filter((i) => i !== workingRestEndpointIdx)]
      : KEY.startsWith('AQ.')
        ? [0, 1, 2]
        : [1, 0, 2];

  for (const idx of order) {
    try {
      const out = await endpoints[idx]();
      if (out !== null) {
        workingRestEndpointIdx = idx;
        return out;
      }
    } catch {
      // try next endpoint
    }
  }
  return null;
}

const join = (a, b) => [a, b].filter(Boolean).join(' ');

/**
 * Opens a transcription session.
 * onText({ final, interim }) fires as words arrive: `final` is settled text,
 * `interim` is the sentence still being spoken.
 * Returns { send(buffer), finish() -> Promise<string>, close() }, or null without an API key.
 */
export function createTranscriber({ onText }) {
  if (!KEY) return null;

  let ws = null;
  let candidateIdx = 0;
  let ready = false;
  let stopped = false;
  let wsProducedWords = false;
  let final = '';
  let interim = '';
  let queue = []; // audio captured before the socket is ready
  let allPcmChunks = []; // 16-bit PCM chunks retained (~32 KB/s) for seamless REST fallback
  let pcmBytesTotal = 0;
  let pcmSampleRate = 16000;
  let settle = null;
  let restTimer = null;
  let restInFlight = false;
  let lastRestBytes = 0;

  const stats = {
    startedAt: Date.now(),
    openMs: null,
    readyMs: null,
    sent: 0,
    received: 0,
    mode: 'ws',
    lastMessageAt: null,
  };

  const emit = () => onText?.({ final, interim });
  const text = () => join(final, interim);

  const sendAudioFrame = ({ bytes, sampleRate }) => {
    if (!ws || !ready || stopped) return;
    stats.sent += 1;
    ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: toBase64(bytes),
            mimeType: `audio/pcm;rate=${sampleRate}`,
          },
        },
      })
    );
  };

  const runRestSnapshot = async ({ isFinal = false } = {}) => {
    if (wsProducedWords || !allPcmChunks.length) return;
    if (!isFinal && (restInFlight || pcmBytesTotal - lastRestBytes < pcmSampleRate * 2 * 1.5)) return;
    restInFlight = true;
    const snapBytes = pcmBytesTotal;
    const wavBase64 = pcmChunksToWavBase64(allPcmChunks, pcmSampleRate);
    try {
      const transcript = await transcribeWavViaRest(wavBase64);
      if (transcript !== null && !wsProducedWords) {
        lastRestBytes = snapBytes;
        stats.mode = 'rest';
        stats.received += 1;
        if (isFinal) {
          final = transcript;
          interim = '';
        } else {
          interim = transcript;
        }
        emit();
      }
    } finally {
      restInFlight = false;
    }
  };

  const startRestPolling = () => {
    if (restTimer || stopped) return;
    stats.mode = 'rest';
    restTimer = setInterval(() => {
      if (!stopped && !wsProducedWords) runRestSnapshot({ isFinal: false });
    }, 2600);
  };

  const handleWsJson = (rawText) => {
    let msg;
    try {
      msg = JSON.parse(rawText);
    } catch {
      return;
    }
    stats.received += 1;
    stats.lastMessageAt = Date.now();

    if (msg.setupComplete !== undefined) {
      ready = true;
      stats.readyMs = Date.now() - stats.startedAt;
      const pending = queue;
      queue = [];
      pending.forEach((chunk) => {
        try {
          sendAudioFrame(chunk);
        } catch {}
      });
      return;
    }

    const interimObj = msg.serverContent?.interimInputTranscription ?? msg.interimInputTranscription;
    const finalObj = msg.serverContent?.inputTranscription ?? msg.inputTranscription;

    if (interimObj && typeof interimObj.text === 'string') {
      wsProducedWords = true;
      interim = interimObj.text;
      emit();
    } else if (finalObj && typeof finalObj.text === 'string') {
      const piece = finalObj.text.trim();
      if (piece) wsProducedWords = true;
      final = join(final, piece);
      interim = '';
      emit();
      settle?.();
    }
  };

  const connectCandidate = (idx) => {
    if (stopped || idx >= WS_CANDIDATES.length) {
      startRestPolling();
      return;
    }
    candidateIdx = idx;
    const candidate = WS_CANDIDATES[idx];
    ready = false;

    let socket;
    try {
      socket = new WebSocket(`${candidate.url}?key=${encodeURIComponent(KEY)}`);
      socket.binaryType = 'arraybuffer';
    } catch {
      connectCandidate(idx + 1);
      return;
    }
    ws = socket;

    socket.onopen = () => {
      if (ws !== socket || stopped) return;
      stats.openMs = Date.now() - stats.startedAt;
      stats.mode = candidate.name;
      try {
        socket.send(JSON.stringify({ setup: candidate.setup }));
      } catch {
        // onclose will advance candidate
      }
    };

    socket.onmessage = (e) => {
      if (ws !== socket || stopped) return;
      if (typeof e.data === 'string') {
        handleWsJson(e.data);
      } else if (typeof Blob !== 'undefined' && e.data instanceof Blob) {
        e.data.text().then(handleWsJson).catch(() => {});
      } else if (e.data) {
        handleWsJson(utf8(e.data));
      }
    };

    socket.onerror = () => {};
    socket.onclose = () => {
      if (ws !== socket) return;
      const wasReady = ready;
      ready = false;
      if (stopped) {
        settle?.();
        return;
      }
      // If this socket closed before producing words, try next WS candidate and enable REST fallback
      if (!wasReady && idx + 1 < WS_CANDIDATES.length) {
        connectCandidate(idx + 1);
      } else if (!wsProducedWords) {
        startRestPolling();
      }
    };
  };

  connectCandidate(0);

  // Also arm REST polling after 3.5s if WS hasn't produced words yet (e.g. silent WS drop)
  const watchdog = setTimeout(() => {
    if (!stopped && !wsProducedWords && !ready) startRestPolling();
  }, 3500);

  return {
    /** Send one microphone buffer (int16 mono PCM). */
    send({ data, sampleRate = 16000 }) {
      if (stopped || !data) return;
      pcmSampleRate = sampleRate;
      const copy = new Uint8Array(data.slice ? data.slice(0) : data);
      // Cap fallback buffer at ~8 MB (~4 minutes at 16kHz mono)
      if (pcmBytesTotal + copy.byteLength <= 8 * 1024 * 1024) {
        allPcmChunks.push(copy);
        pcmBytesTotal += copy.byteLength;
      }

      const item = { bytes: copy, sampleRate };
      if (!ready) {
        if (queue.length < 500) queue.push(item);
        return;
      }
      try {
        sendAudioFrame(item);
      } catch {}
    },

    /** Signal the end of speech and wait briefly for the last words. */
    finish({ fileUri = null } = {}) {
      stopped = true;
      clearTimeout(watchdog);
      if (restTimer) {
        clearInterval(restTimer);
        restTimer = null;
      }

      return new Promise((resolve) => {
        let resolved = false;
        const complete = async () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          settle = null;

          // If Live WS yielded nothing at all, run one final full REST transcription pass
          if (!wsProducedWords) {
            if (allPcmChunks.length > 0) {
              await runRestSnapshot({ isFinal: true });
            } else if (fileUri) {
              const filePayload = await readAudioUriBase64(fileUri);
              if (filePayload) {
                const transcript = await transcribeWavViaRest(filePayload.base64, filePayload.mimeType);
                if (transcript) {
                  final = transcript;
                  interim = '';
                }
              }
            }
          }

          final = text();
          interim = '';
          emit();
          try {
            ws?.close();
          } catch {}
          resolve(final);
        };

        const timer = setTimeout(complete, wsProducedWords ? (interim ? 2200 : 700) : 450);
        if (!ws || !ready) {
          complete();
          return;
        }
        settle = complete;
        try {
          ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        } catch {
          complete();
        }
      });
    },

    /** Connection health, for the development read-out. */
    stats: () => ({ ...stats, queued: queue.length, closed: stopped }),

    close() {
      stopped = true;
      clearTimeout(watchdog);
      if (restTimer) {
        clearInterval(restTimer);
        restTimer = null;
      }
      try {
        ws?.close();
      } catch {}
    },
  };
}

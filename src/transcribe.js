// Live speech-to-text over the Gemini Live API (WebSocket).
// Microphone PCM goes up in small chunks; words come back while the user is still speaking.
// Every failure is silent: recording must never depend on the network.

const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = 'models/gemini-3.5-transcribe-live';
const URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export const transcriptionAvailable = !!KEY;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes) {
  // Native btoa is far faster than building the string by hand; the loop below is the fallback.
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
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
  const bytes = new Uint8Array(buffer);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
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

  let ws;
  let ready = false;
  let closed = false;
  let final = '';
  let interim = '';
  let queue = []; // audio captured before the socket is ready
  let settle = null;
  const stats = { startedAt: Date.now(), openMs: null, readyMs: null, sent: 0, received: 0, lastMessageAt: null };

  const emit = () => onText?.({ final, interim });
  const text = () => join(final, interim);

  const sendAudio = ({ data, sampleRate }) => {
    stats.sent += 1;
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: toBase64(new Uint8Array(data)), mimeType: `audio/pcm;rate=${sampleRate}` } },
      })
    );
  };

  try {
    ws = new WebSocket(`${URL}?key=${KEY}`);
    ws.binaryType = 'arraybuffer';
  } catch {
    return null;
  }

  ws.onopen = () => {
    stats.openMs = Date.now() - stats.startedAt;
    ws.send(JSON.stringify({ setup: { model: MODEL } }));
  };

  ws.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(typeof e.data === 'string' ? e.data : utf8(e.data));
    } catch {
      return;
    }
    stats.received += 1;
    stats.lastMessageAt = Date.now();
    if (msg.setupComplete) {
      ready = true;
      stats.readyMs = Date.now() - stats.startedAt;
      queue.forEach(sendAudio);
      queue = [];
      return;
    }
    const content = msg.serverContent;
    if (content?.interimInputTranscription) {
      interim = content.interimInputTranscription.text || '';
      emit();
    } else if (content?.inputTranscription) {
      final = join(final, (content.inputTranscription.text || '').trim());
      interim = '';
      emit();
      settle?.();
    }
  };

  ws.onerror = () => {};
  ws.onclose = () => {
    closed = true;
    settle?.();
  };

  return {
    /** Send one microphone buffer (int16 mono PCM). */
    send(buffer) {
      if (closed) return;
      if (!ready) {
        if (queue.length < 400) queue.push(buffer);
        return;
      }
      try {
        sendAudio(buffer);
      } catch {}
    },

    /** Signal the end of speech and wait briefly for the last words. */
    finish() {
      return new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          settle = null;
          // Whatever was still interim is the best we will get.
          final = text();
          interim = '';
          emit();
          try {
            ws.close();
          } catch {}
          resolve(final);
        };
        // Waiting on a sentence in progress deserves longer than a possible late final.
        const timer = setTimeout(done, interim ? 3000 : 800);
        if (closed || !ready) return done();
        settle = done;
        try {
          ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        } catch {
          done();
        }
      });
    },

    /** Connection health, for the development read-out. */
    stats: () => ({ ...stats, queued: queue.length, closed }),

    close() {
      closed = true;
      try {
        ws.close();
      } catch {}
    },
  };
}

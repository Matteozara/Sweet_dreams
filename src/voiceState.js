// How the user sounded, judged from the recording itself rather than the words:
// prosody (pitch, energy, speaking rate, pauses) and voice quality.
// The counterpart of contentState.js, which judges the words.

import { Platform } from 'react-native';

import { askGemini, stateFrom, warner } from './gemini';

// The whole request must stay under 20 MB, and base64 adds a third.
const MAX_BYTES = 14 * 1024 * 1024;
const warn = warner('voiceState');

const PROMPT = `You are listening to a short spoken evening reflection ("How did you feel today?").
Judge the speaker's state from HOW they sound, not from what they say. Base it on:
- Prosody: pitch level and variability, energy and loudness, speaking rate, pauses and hesitations.
- Voice quality: breathiness, creakiness, tension or strain, tremor, flatness, warmth.

Return:
- speech: false when there is no intelligible human speech to judge, otherwise true.
- score: an integer from 0 to 10 for how the speaker sounds. 0 is very depleted, flat or strained;
  5 is neutral or mixed; 10 is calm, steady and energised. Use 0 when speech is false.
- analysis: two to four plain sentences describing what you heard in the voice (pitch, energy, rate,
  pauses, voice quality) and what it suggests about their state. Describe, do not diagnose, and do not
  give advice. Address nobody; write in the third person ("The voice is…").`;

const SCHEMA = {
  type: 'object',
  properties: {
    speech: { type: 'boolean' },
    score: { type: 'integer', minimum: 0, maximum: 10 },
    analysis: { type: 'string' },
  },
  required: ['speech', 'score', 'analysis'],
};

const MIME = { wav: 'audio/wav', m4a: 'audio/m4a', aac: 'audio/aac', mp3: 'audio/mp3', webm: 'audio/webm', ogg: 'audio/ogg' };
const mimeOf = (uri) => MIME[uri.split('?')[0].split('.').pop().toLowerCase()] || 'audio/wav';

/** Reads a local recording as base64, or null when it is missing or too large to send inline. */
async function readBase64(uri) {
  if (Platform.OS !== 'web') {
    // fetch() cannot be relied on for file:// URIs on a device; the file system can.
    const file = new (require('expo-file-system').File)(uri);
    if (!file.exists || !file.size) return warn('recording not found', uri);
    if (file.size > MAX_BYTES) return warn('recording too large to send', file.size);
    return file.base64();
  }
  const blob = await (await fetch(uri)).blob(); // a blob: URL
  if (!blob.size || blob.size > MAX_BYTES) return warn('recording empty or too large', blob.size);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    // A data URL: everything after the comma is the base64 payload.
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result.split(',')[1] || null : null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Analyses one recording.
 * Resolves to { score, analysis, model, at } — score is 0–10, or null when no speech was heard —
 * or to null when the analysis could not be done (no key, no file, offline, bad reply).
 */
export async function analyzeVoiceState(uri) {
  if (!uri) return warn('no recording file for this answer');
  let data;
  try {
    data = await readBase64(uri);
  } catch (e) {
    return warn('could not read the recording', e?.message || e);
  }
  if (!data) return null;
  const out = await askGemini({
    input: [
      { type: 'text', text: PROMPT },
      { type: 'audio', data, mime_type: mimeOf(uri) },
    ],
    schema: SCHEMA,
    tag: 'voiceState',
  });
  return stateFrom(out, out?.speech !== false, warn);
}

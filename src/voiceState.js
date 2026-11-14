// How the user sounded, judged from the recording itself rather than the words:
// prosody (pitch, energy, speaking rate, pauses) and voice quality.
// One request to the Gemini Interactions API after the evening is closed.
// Every failure resolves to null: closing the day must never depend on the network.

import { Platform } from 'react-native';

const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = 'gemini-4-hydrogen';
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';
// The whole request must stay under 20 MB, and base64 adds a third.
const MAX_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 60000;

export const voiceStateAvailable = !!KEY;

const PROMPT = `You are listening to a short spoken evening reflection ("How was your day?").
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

// Failures stay silent for the user; in development they say why in the console.
const warn = (...args) => __DEV__ && console.warn('[voiceState]', ...args);

/** Reads a local recording as base64, or null when it is missing or too large to send inline. */
async function readBase64(uri) {
  if (Platform.OS !== 'web') {
    // fetch() cannot be relied on for file:// URIs on a device; the file system can.
    const file = new (require('expo-file-system').File)(uri);
    if (!file.exists || !file.size) return warn('recording not found', uri) || null;
    if (file.size > MAX_BYTES) return warn('recording too large to send', file.size) || null;
    return file.base64();
  }
  const blob = await (await fetch(uri)).blob(); // a blob: URL
  if (!blob.size || blob.size > MAX_BYTES) return warn('recording empty or too large', blob.size) || null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    // A data URL: everything after the comma is the base64 payload.
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result.split(',')[1] || null : null);
    reader.readAsDataURL(blob);
  });
}

function outputText(response) {
  const parts = (response.steps || [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content || []);
  return parts.filter((p) => p.type === 'text').map((p) => p.text).join('');
}

/**
 * Analyses one recording.
 * Resolves to { score, analysis, model, at } — score is 0–10, or null when no speech was heard —
 * or to null when the analysis could not be done (no key, no file, offline, bad reply).
 */
export async function analyzeVoiceState(uri) {
  if (!KEY || !uri) return warn(KEY ? 'no recording file for this answer' : 'no EXPO_PUBLIC_GEMINI_API_KEY') || null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const data = await readBase64(uri);
    if (!data) return null;
    const res = await fetch(URL, {
      method: 'POST',
      signal: abort.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY, 'Api-Revision': API_REVISION },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { type: 'text', text: PROMPT },
          { type: 'audio', data, mime_type: mimeOf(uri) },
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
      }),
    });
    if (!res.ok) return warn('request failed', res.status, (await res.text()).slice(0, 300)) || null;
    const out = JSON.parse(outputText(await res.json()));
    const analysis = typeof out.analysis === 'string' ? out.analysis.trim() : '';
    if (!analysis) return warn('reply had no analysis') || null;
    const score = Number.isFinite(out.score) ? Math.min(10, Math.max(0, Math.round(out.score))) : null;
    return {
      score: out.speech === false ? null : score,
      analysis,
      model: MODEL,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return warn('failed', e?.message || e) || null;
  } finally {
    clearTimeout(timer);
  }
}

// One structured question to the Gemini Interactions API, shared by the analyses
// that run after the evening is closed (voiceState.js, contentState.js).
// Every failure resolves to null: closing the day must never depend on the network.

const KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';
const TIMEOUT_MS = 60000;

export const MODEL = 'gemini-4-hydrogen';
export const geminiAvailable = !!KEY;

/** Failures stay silent for the user; in development they say why in the console. */
export const warner = (tag) => (...args) => {
  if (__DEV__) console.warn(`[${tag}]`, ...args);
  return null;
};

function outputText(response) {
  const parts = (response.steps || [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content || []);
  return parts.filter((p) => p.type === 'text').map((p) => p.text).join('');
}

/**
 * Sends `input` (text and audio parts) and resolves to the reply parsed against `schema`,
 * or to null when there is no key, no connection, or no usable reply.
 */
export async function askGemini({ input, schema, tag = 'gemini' }) {
  const warn = warner(tag);
  if (!KEY) return warn('no EXPO_PUBLIC_GEMINI_API_KEY');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal: abort.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY, 'Api-Revision': API_REVISION },
      body: JSON.stringify({
        model: MODEL,
        input,
        response_format: { type: 'text', mime_type: 'application/json', schema },
      }),
    });
    if (!res.ok) return warn('request failed', res.status, (await res.text()).slice(0, 300));
    return JSON.parse(outputText(await res.json()));
  } catch (e) {
    return warn('failed', e?.message || e);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shapes a { score, analysis } reply into what is saved on the entry:
 * { score, analysis, model, at }, with score 0–10 or null when `judged` is false.
 */
export function stateFrom(out, judged, warn) {
  if (!out) return null;
  const analysis = typeof out.analysis === 'string' ? out.analysis.trim() : '';
  if (!analysis) return warn('reply had no analysis');
  const score = Number.isFinite(out.score) ? Math.min(10, Math.max(0, Math.round(out.score))) : null;
  return { score: judged ? score : null, analysis, model: MODEL, at: new Date().toISOString() };
}

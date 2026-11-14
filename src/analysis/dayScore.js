// Gemini API day-line scoring (0 to 10 overall day score).
// Failure-tolerant: returns null if EXPO_PUBLIC_GEMINI_API_KEY is unset or the request fails.

import { meanMood, thin } from '../line.js';

const MODEL = 'gemini-4-hydrogen';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const dayScoreAvailable = !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;

/**
 * Send the day-line drawing to Gemini, explaining its axes and meaning,
 * and ask for an overall day score from 0 to 10.
 * Returns `{ score, rationale, model, scoredAt }` or null.
 */
export async function scoreDayLineDetailed(line, { fetchImpl = globalThis.fetch } = {}) {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) return { ok: false, error: 'Missing EXPO_PUBLIC_GEMINI_API_KEY' };
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'fetch unavailable' };
  if (!line?.points?.length) return { ok: false, error: 'No drawing points' };

  const sampled = thin(line.points, 25).map((p) => ({
    x: +p.x.toFixed(3),
    y: +p.y.toFixed(3),
    lightness: +(1 - 2 * p.y).toFixed(2),
  }));

  const avgMood = +meanMood(line.points).toFixed(2);
  const startLight = sampled[0]?.lightness ?? 0;
  const endLight = sampled[sampled.length - 1]?.lightness ?? 0;

  const prompt = [
    'You are analyzing a daily emotional-trajectory drawing from a mental-health check-in app.',
    'Drawing meaning:',
    '- The x-axis runs from 0.0 (Morning) to 1.0 (Night).',
    '- The y-axis runs from 0.0 (top = "+ Light", feeling light/energized/good) to 1.0 (bottom = "- Heavy", feeling heavy/low/weighed down).',
    '- Equivalently, lightness = 1 - 2*y ranges from -1.0 (heaviest) to +1.0 (lightest), with 0.0 as neutral.',
    '- Rising curves toward the end indicate recovery/improvement through the day; falling curves or sustained low positions indicate heaviness.',
    '',
    `Summary: mean_lightness=${avgMood}, morning_lightness=${startLight}, night_lightness=${endLight}, duration_ms=${line.durationMs || 0}, finger_lifts=${line.fingerLifts ?? Math.max(0, (line.attempts || 1) - 1)}.`,
    `Sampled points (morning -> night): ${JSON.stringify(sampled)}`,
    '',
    'Output a JSON object with:',
    '- "score": a number from 0 to 10 (0 = heaviest/most difficult day, 10 = lightest/best day),',
    '- "rationale": one concise sentence describing the trajectory.',
  ].join('\n');

  try {
    const res = await fetchImpl(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) detail = `${detail}: ${errJson.error.message}`;
      } catch {}
      return { ok: false, error: detail };
    }
    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { ok: false, error: 'Empty Gemini response' };
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const rawScore = Number(parsed?.score);
    if (!Number.isFinite(rawScore)) return { ok: false, error: 'Invalid score in response' };
    const score = Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
    const rationale = typeof parsed?.rationale === 'string' ? parsed.rationale.trim() : '';
    return {
      ok: true,
      data: {
        score,
        rationale,
        model: MODEL,
        scoredAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

export async function scoreDayLine(line, opts) {
  const res = await scoreDayLineDetailed(line, opts);
  return res.ok ? res.data : null;
}

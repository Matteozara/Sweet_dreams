// Remission baseline & z-score normalization (v2 Section 5).

import { clip, isSlopeSignificant, median, scaledMad } from './stats.js';

export const PIPELINE_VERSION = '2.0.0';
const PRACTICE_SESSIONS = 5;
const MIN_BASELINE_LOCAL = 10; // k = 0 (< 30 users on central server)
const MIN_BASELINE_POOLED = 7; // k = 5 (>= 30 users on central server)
const K_POOLED = 5;

/**
 * Compute per-feature baseline statistics `{ med, s, n, slopeSignificant }`
 * from a chronological array of daily feature objects.
 */
export function computeBaseline(dailyFeatureRows, { phq9 = 0, sigmaPool = null } = {}) {
  const gated = phq9 < 5;
  const k = sigmaPool ? K_POOLED : 0;
  const requiredSessions = sigmaPool ? MIN_BASELINE_POOLED : MIN_BASELINE_LOCAL;

  const afterPractice = dailyFeatureRows.slice(PRACTICE_SESSIONS);
  const ready = gated && afterPractice.length >= requiredSessions;

  const featureKeys = [
    'drawingSpeed',
    'drawingPauseTimeMs',
    'ikdMedianMs',
    'ikdMadMs',
    'typingSessionMs',
    'voicePauseRatio',
  ];

  const stats = {};
  let anySlopeSignificant = false;

  if (ready) {
    for (const key of featureKeys) {
      const vals = afterPractice.map((r) => r[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (vals.length < 3) continue;
      const n = vals.length;
      const med = median(vals);
      const madScaled = scaledMad(vals) || 0;
      const sigma = sigmaPool && typeof sigmaPool[key] === 'number' ? sigmaPool[key] : 0;
      const s = Math.sqrt((n * madScaled * madScaled + k * sigma * sigma) / (n + k));
      const slopeSig = isSlopeSignificant(vals);
      if (slopeSig) anySlopeSignificant = true;
      stats[key] = { med, s, n, slopeSignificant: slopeSig };
    }
  }

  return {
    pipelineVersion: PIPELINE_VERSION,
    gated,
    practiceExcluded: Math.min(PRACTICE_SESSIONS, dailyFeatureRows.length),
    baselineSessions: afterPractice.length,
    requiredSessions,
    k,
    ready,
    extendRecommended: anySlopeSignificant,
    stats,
  };
}

/**
 * Compute normalized z-score `clip((x - med) / s, -5, 5)`.
 * `signed = false` returns `|z|` (used for median IKD and spectral slopes).
 */
export function normalizeFeature(value, stat, { signed = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !stat || !stat.s || stat.s <= 1e-9) {
    return null;
  }
  const z = clip((value - stat.med) / stat.s, -5, 5);
  return signed ? z : Math.abs(z);
}

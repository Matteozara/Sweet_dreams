// Remission baseline & z-score normalization (v2 Section 5).

import { clip, isSlopeSignificant, median, scaledMad } from './stats.js';

export const PIPELINE_VERSION = '2.1.0';
const PRACTICE_SESSIONS = 5;
const MIN_BASELINE_LOCAL = 10; // k = 0 (< 30 users on central server)
const MIN_BASELINE_POOLED = 7; // k = 5 (>= 30 users on central server)
const K_POOLED = 5;

/**
 * Physiological minimum spread floors (`sigma_min`) in physical feature units.
 * Prevents `MAD = 0` (`s_f = 0 -> z = null`) when `k = 0` (< 30 users, no `sigma_pool`)
 * on zero-inflated baseline features such as 0 drawing pauses or 0 long speech pauses
 * on >= 6 of 10 remission baseline evenings.
 */
export const SIGMA_MIN = {
  drawingSpeed: 2.5, // mm/s
  drawingPauseTimeMs: 120, // ms (pause threshold is >= 100 ms)
  drawingJerk: 150, // dimensionless normalized jerk
  drawingCV: 0.06, // speed coefficient of variation
  ikdMedianMs: 12, // ms
  ikdMadMs: 8, // ms
  backspaceRate: 0.015, // 1.5% backspace share
  typingSessionMs: 2500, // ms
  voicePauseRatio: 0.03, // 3% pause ratio
  voiceLongPausesPerMin: 0.8, // >= 1.0 s pauses / min
  dayScore: 0.6, // 0..10 Gemini Day Line score points
};

/**
 * Compute per-feature baseline statistics `{ med, s, rawS, usedFloor, n, slopeSignificant }`
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
    'backspaceRate',
    'typingSessionMs',
    'voicePauseRatio',
    'voiceLongPausesPerMin',
  ];

  const stats = {};
  let anySlopeSignificant = false;
  let anyFloorUsed = false;

  if (ready) {
    for (const key of featureKeys) {
      const vals = afterPractice.map((r) => r[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (vals.length < 3) continue;
      const n = vals.length;
      const med = median(vals);
      const madScaled = scaledMad(vals) || 0;
      const hasPool = Boolean(sigmaPool && typeof sigmaPool[key] === 'number' && sigmaPool[key] > 0);
      const kFeat = hasPool ? k : 0;
      const sigma = hasPool ? sigmaPool[key] : 0;
      const rawS = Math.sqrt((n * madScaled * madScaled + kFeat * sigma * sigma) / (n + kFeat));
      const floor = SIGMA_MIN[key] ?? 1e-6;
      const s = hasPool ? Math.max(rawS, 1e-6) : Math.max(rawS, floor);
      const usedFloor = !hasPool && rawS < floor;
      if (usedFloor) anyFloorUsed = true;
      const slopeSig = isSlopeSignificant(vals);
      if (slopeSig) anySlopeSignificant = true;
      stats[key] = { med, s, rawS, usedFloor, n, slopeSignificant: slopeSig };
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
    anyFloorUsed,
    stats,
  };
}

/**
 * Compute normalized z-score `clip((x - med) / s, -5, 5)`.
 * `signed = false` returns `|z|` (used for median IKD and spectral slopes, Paper #4).
 */
export function normalizeFeature(value, stat, { signed = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !stat || !stat.s || stat.s <= 1e-9) {
    return null;
  }
  const z = clip((value - stat.med) / stat.s, -5, 5);
  return signed ? z : Math.abs(z);
}

/**
 * Separate healthy personal equilibrium (~0 SD / 4.0–6.0) from psychomotor slowing
 * (< -1.5 SD) and possible agitation / dysregulation (> +1.8 SD speed surge, or high |z|
 * alongside elevated IKD MAD, elevated backspaceRate, or nocturnal typing 00:00–05:00).
 * Grounded in Papers #4 (Vesel et al. 2020), #5 (JMIR 2024), and #7 (Maruani et al. 2025).
 */
export function classifyMotorState({
  signedPaceZ = null,
  dysregulationZ = null,
  ikdMadZ = null,
  backspaceZ = null,
  nightShare = 0,
} = {}) {
  const hasPace = typeof signedPaceZ === 'number' && Number.isFinite(signedPaceZ);
  const hasDys = typeof dysregulationZ === 'number' && Number.isFinite(dysregulationZ);
  if (!hasPace && !hasDys) {
    return { code: 'pre_baseline', label: 'Pre-baseline', shortLabel: 'Pre-baseline', tone: 'neutral' };
  }

  const erraticTyping =
    (typeof ikdMadZ === 'number' && ikdMadZ >= 1.2) ||
    (typeof backspaceZ === 'number' && backspaceZ >= 1.2);
  const nocturnalTyping = typeof nightShare === 'number' && nightShare >= 0.2;
  const coMarkers = erraticTyping || nocturnalTyping;

  if (
    (hasPace && signedPaceZ >= 1.8) ||
    (hasPace && signedPaceZ >= 1.35 && coMarkers) ||
    (hasDys && dysregulationZ >= 1.8 && (!hasPace || signedPaceZ > -1.0) && coMarkers)
  ) {
    return {
      code: 'agitation_watch',
      label: 'Possible Agitation / Dysregulation',
      shortLabel: 'Agitation watch',
      tone: 'amber',
    };
  }

  if (hasPace && signedPaceZ <= -1.5) {
    return {
      code: 'slowing',
      label: 'Psychomotor Slowing',
      shortLabel: 'Slowed',
      tone: 'warn',
    };
  }

  if (hasDys && dysregulationZ >= 1.6) {
    return {
      code: 'dysregulated',
      label: 'Elevated Dysregulation (|z|)',
      shortLabel: 'Dysregulated',
      tone: 'amber',
    };
  }

  if (hasPace && signedPaceZ < -1.0) {
    return {
      code: 'mild_slowing',
      label: 'Mildly Slower than Equilibrium',
      shortLabel: 'Mildly slow',
      tone: 'warn',
    };
  }

  if (hasPace && signedPaceZ > 1.0) {
    return {
      code: 'mild_fast',
      label: 'Brisk Pace (Monitor Equilibrium)',
      shortLabel: 'Brisk',
      tone: 'info',
    };
  }

  return {
    code: 'equilibrium',
    label: 'In Personal Equilibrium',
    shortLabel: 'Equilibrium',
    tone: 'ok',
  };
}

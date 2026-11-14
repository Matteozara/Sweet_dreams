// Finger Drawing v2 preprocessing and feature extraction.
// Converts normalized canvas motion into millimetres, runs quality checks,
// cleans jumps/duplicates, resamples to device median rate, and computes
// Savitzky-Golay (~80 ms, order 3) kinematics and pauses.

import { cv, mean, median } from './stats.js';

export const DP_PER_MM = 160 / 25.4; // ~6.2992 dp/mm
const MAX_MEDIAN_DT_MS = 17;
const GAP_THRESHOLD_MS = 50;
const MAX_GAP_PCT = 5;
const MAX_JUMP_MM = 50;
const SG_WINDOW_MS = 80;
const PAUSE_SPEED_MM_S = 5;
const PAUSE_MIN_MS = 100;

/** Solve small linear system A * x = b via Gaussian elimination with partial pivoting. */
function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const diag = M[col][col];
    if (Math.abs(diag) < 1e-12) return new Array(n).fill(0);
    for (let j = col; j <= n; j += 1) M[col][j] /= diag;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j += 1) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Compute Savitzky-Golay filter weights for odd window size `win` and polynomial order `order`.
 * Returns weights for derivative `deriv` (0 = smooth, 1 = 1st deriv, 3 = 3rd deriv) scaled by dt^deriv.
 */
function savitzkyGolayWeights(win, order, deriv, dtSec) {
  const half = (win - 1) / 2;
  const p = Math.min(order, win - 1);
  const cols = p + 1;
  // Build Vandermonde matrix J (win x cols): J[i][k] = (i - half)^k
  const J = [];
  for (let i = 0; i < win; i += 1) {
    const x = i - half;
    const row = new Array(cols);
    row[0] = 1;
    for (let k = 1; k < cols; k += 1) row[k] = row[k - 1] * x;
    J.push(row);
  }
  // Normal matrix N = J^T * J
  const N = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (let r = 0; r < cols; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let s = 0;
      for (let i = 0; i < win; i += 1) s += J[i][r] * J[i][c];
      N[r][c] = s;
    }
  }
  // Unit vector e_deriv scaled by deriv! / dt^deriv
  const rhs = new Array(cols).fill(0);
  if (deriv < cols) {
    let fact = 1;
    for (let k = 2; k <= deriv; k += 1) fact *= k;
    rhs[deriv] = fact / Math.pow(dtSec, deriv);
  }
  const coeffs = solveLinearSystem(N, rhs);
  // Filter weights w[i] = sum_k coeffs[k] * J[i][k]
  const weights = new Array(win).fill(0);
  for (let i = 0; i < win; i += 1) {
    let s = 0;
    for (let k = 0; k < cols; k += 1) s += coeffs[k] * J[i][k];
    weights[i] = s;
  }
  return weights;
}

function convolveValidWithEdgePad(arr, weights) {
  const n = arr.length;
  const half = (weights.length - 1) / 2;
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    let acc = 0;
    for (let k = -half; k <= half; k += 1) {
      const idx = Math.min(n - 1, Math.max(0, i + k));
      acc += arr[idx] * weights[k + half];
    }
    out[i] = acc;
  }
  return out;
}

/**
 * Analyze a single Day Line drawing (`entry.line`).
 * Supports multi-stroke motion `[xNorm, yNorm, tMs, strokeId]` (and legacy `[xNorm, yNorm, tMs]`).
 * Resamples and differentiates strictly within strokes; returns null if no usable motion.
 */
export function analyzeDrawing(line) {
  const rawMotion = line?.motion;
  if (!rawMotion || rawMotion.length < 4) return null;

  const w = line.canvas?.w || 320;
  const h = line.canvas?.h || 240;
  const dpPerMm = line.canvas?.dpPerMm || DP_PER_MM;

  // 1. Convert normalized [0..1] coordinates to mm, group by strokeId, sort by time, dedupe.
  const strokeMap = new Map();
  for (let i = 0; i < rawMotion.length; i += 1) {
    const [xn, yn, t, strokeId = 1] = rawMotion[i];
    if (!strokeMap.has(strokeId)) strokeMap.set(strokeId, []);
    strokeMap.get(strokeId).push({ x: (xn * w) / dpPerMm, y: (yn * h) / dpPerMm, t });
  }

  const rawDts = [];
  let gapOver50Count = 0;
  const cleanedStrokes = [];

  for (const pts of strokeMap.values()) {
    pts.sort((a, b) => a.t - b.t);
    const deduped = [];
    for (let i = 0; i < pts.length; i += 1) {
      if (deduped.length === 0 || pts[i].t > deduped[deduped.length - 1].t) {
        deduped.push(pts[i]);
      }
    }
    if (deduped.length < 2) continue;

    // Quality checks on raw within-stroke intervals & drop jumps > 50 mm.
    const cleaned = [deduped[0]];
    for (let i = 1; i < deduped.length; i += 1) {
      const dt = deduped[i].t - deduped[i - 1].t;
      rawDts.push(dt);
      if (dt > GAP_THRESHOLD_MS) gapOver50Count += 1;

      const prev = cleaned[cleaned.length - 1];
      const dist = Math.hypot(deduped[i].x - prev.x, deduped[i].y - prev.y);
      if (dist <= MAX_JUMP_MM) cleaned.push(deduped[i]);
    }
    if (cleaned.length >= 2) cleanedStrokes.push(cleaned);
  }

  if (cleanedStrokes.length === 0) return null;

  const medianDtMs = median(rawDts) || 16.7;
  const gapOver50Pct = rawDts.length ? (gapOver50Count / rawDts.length) * 100 : 0;
  const qualityValid = medianDtMs <= MAX_MEDIAN_DT_MS && gapOver50Pct <= MAX_GAP_PCT;

  // 2. Resample & differentiate strictly within each stroke.
  const stepMs = Math.max(4, Math.min(50, medianDtMs));
  const dtSec = stepMs / 1000;

  const allSpeeds = [];
  let pathLengthMm = 0;
  let activeTimeMs = 0;
  let jerkIntegral = 0;
  let pauseCount = 0;
  let totalPauseTimeMs = 0;
  let reversals = 0;

  for (const cleaned of cleanedStrokes) {
    const tStart = cleaned[0].t;
    const tEnd = cleaned[cleaned.length - 1].t;
    const strokeMs = Math.max(0, tEnd - tStart);
    if (strokeMs < 50) continue;

    const resampled = [];
    let cursor = 0;
    for (let t = tStart; t <= tEnd + 1e-6; t += stepMs) {
      while (cursor < cleaned.length - 2 && cleaned[cursor + 1].t < t) {
        cursor += 1;
      }
      const p0 = cleaned[cursor];
      const p1 = cleaned[Math.min(cleaned.length - 1, cursor + 1)];
      const span = p1.t - p0.t;
      const alpha = span > 0 ? Math.min(1, Math.max(0, (t - p0.t) / span)) : 0;
      resampled.push({
        x: p0.x + alpha * (p1.x - p0.x),
        y: p0.y + alpha * (p1.y - p0.y),
        t,
      });
    }
    if (resampled.length < 5) continue;

    activeTimeMs += strokeMs;

    // Savitzky-Golay filter (~80 ms window, order 3) for velocity and jerk.
    let win = Math.round(SG_WINDOW_MS / stepMs);
    if (win % 2 === 0) win += 1;
    win = Math.max(5, Math.min(win, resampled.length % 2 === 1 ? resampled.length : resampled.length - 1));

    const xs = resampled.map((p) => p.x);
    const ys = resampled.map((p) => p.y);
    const w0 = savitzkyGolayWeights(win, 3, 0, dtSec);
    const w1 = savitzkyGolayWeights(win, 3, 1, dtSec);
    const w3 = savitzkyGolayWeights(win, 3, 3, dtSec);

    const sx = convolveValidWithEdgePad(xs, w0);
    const sy = convolveValidWithEdgePad(ys, w0);
    const vx = convolveValidWithEdgePad(xs, w1);
    const vy = convolveValidWithEdgePad(ys, w1);
    const jx = convolveValidWithEdgePad(xs, w3);
    const jy = convolveValidWithEdgePad(ys, w3);

    const speeds = new Array(resampled.length);
    for (let i = 0; i < resampled.length; i += 1) {
      speeds[i] = Math.hypot(vx[i], vy[i]);
      allSpeeds.push(speeds[i]);
      if (i > 0) {
        pathLengthMm += Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]);
      }
      jerkIntegral += (jx[i] * jx[i] + jy[i] * jy[i]) * dtSec;
    }

    // Pauses within stroke: speed < 5 mm/s for >= 100 ms while finger is down.
    let runSamples = 0;
    for (let i = 0; i < speeds.length; i += 1) {
      if (speeds[i] < PAUSE_SPEED_MM_S) {
        runSamples += 1;
      } else {
        const runMs = runSamples * stepMs;
        if (runMs >= PAUSE_MIN_MS) {
          pauseCount += 1;
          totalPauseTimeMs += runMs;
        }
        runSamples = 0;
      }
    }
    if (runSamples * stepMs >= PAUSE_MIN_MS) {
      pauseCount += 1;
      totalPauseTimeMs += runSamples * stepMs;
    }

    // Speed reversals per 10 mm (Mergl: local extrema in smoothed speed).
    for (let i = 1; i < speeds.length - 1; i += 1) {
      const d1 = speeds[i] - speeds[i - 1];
      const d2 = speeds[i + 1] - speeds[i];
      if ((d1 > 0.5 && d2 < -0.5) || (d1 < -0.5 && d2 > 0.5)) {
        reversals += 1;
      }
    }
  }

  if (allSpeeds.length < 5 || activeTimeMs < 50) return null;

  const firstT = cleanedStrokes[0][0].t;
  const lastStroke = cleanedStrokes[cleanedStrokes.length - 1];
  const lastT = lastStroke[lastStroke.length - 1].t;
  const movementTimeMs = Math.max(activeTimeMs, lastT - firstT);

  const meanSpeed = mean(allSpeeds);
  const speedCV = cv(allSpeeds);
  const speedReversalsPer10mm = pathLengthMm > 1 ? (reversals / pathLengthMm) * 10 : 0;

  // Normalized jerk: sqrt(0.5 * integral(j^2 dt) * T^5 / L^2).
  const T = activeTimeMs / 1000;
  const L = Math.max(1e-3, pathLengthMm);
  const normalizedJerk = Math.sqrt(0.5 * jerkIntegral * Math.pow(T, 5) / (L * L));

  const fingerLifts = Math.max(
    0,
    strokeMap.size - 1,
    (line.attempts || 1) - 1,
    line.fingerLifts || 0
  );

  return {
    movementTimeMs,
    pathLengthMm,
    meanSpeed,
    speedCV,
    speedReversalsPer10mm,
    normalizedJerk,
    pauseCount,
    totalPauseTimeMs,
    fingerLifts,
    quality: {
      medianDtMs,
      gapOver50Pct,
      valid: qualityValid,
    },
  };
}

/** Aggregate daily finger-drawing results for a week. */
export function aggregateDrawingWeek(dayEntries) {
  const results = dayEntries.map((e) => ({ date: e.date, metrics: analyzeDrawing(e.line) })).filter((r) => r.metrics);
  if (results.length === 0) return null;

  const validResults = results.filter((r) => r.metrics.quality.valid);
  const pool = validResults.length > 0 ? validResults : results;

  return {
    count: results.length,
    validCount: validResults.length,
    lowQualityCount: results.length - validResults.length,
    movementTimeMs: median(pool.map((r) => r.metrics.movementTimeMs)),
    meanSpeed: median(pool.map((r) => r.metrics.meanSpeed)),
    speedCV: median(pool.map((r) => r.metrics.speedCV).filter((v) => v !== null)),
    speedReversalsPer10mm: median(pool.map((r) => r.metrics.speedReversalsPer10mm)),
    normalizedJerk: median(pool.map((r) => r.metrics.normalizedJerk)),
    pauseCount: median(pool.map((r) => r.metrics.pauseCount)),
    totalPauseTimeMs: median(pool.map((r) => r.metrics.totalPauseTimeMs)),
    fingerLifts: median(pool.map((r) => r.metrics.fingerLifts)),
    medianDtMs: median(results.map((r) => r.metrics.quality.medianDtMs)),
    daily: results,
  };
}

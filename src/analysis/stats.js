// Shared statistical and numerical helpers for v2 preprocessing and normalization.

export function mean(arr) {
  if (!arr || arr.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < arr.length; i += 1) sum += arr[i];
  return sum / arr.length;
}

export function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function median(arr) {
  return percentile(arr, 50);
}

/** Median absolute deviation (raw, unscaled). */
export function mad(arr) {
  if (!arr || arr.length === 0) return null;
  const med = median(arr);
  const devs = arr.map((v) => Math.abs(v - med));
  return median(devs);
}

/** Consistent normal-scaled MAD (1.4826 * MAD). */
export function scaledMad(arr) {
  const m = mad(arr);
  return m === null ? null : 1.4826 * m;
}

/** Sample standard deviation (n - 1 denominator when n > 1). */
export function std(arr) {
  if (!arr || arr.length < 2) return null;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (arr.length - 1));
}

/** Coefficient of variation (std / mean). */
export function cv(arr) {
  if (!arr || arr.length < 2) return null;
  const m = mean(arr);
  if (m === null || m === 0) return null;
  const s = std(arr);
  return s === null ? null : s / Math.abs(m);
}

export function clip(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Simple OLS slope significance check against session index (1..n).
 * Returns { slope, significant } using |t| > 2.1 as an approximate p < 0.05 threshold.
 */
export function isSlopeSignificant(values) {
  if (!values || values.length < 5) return false;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xMean;
    sxx += dx * dx;
    sxy += dx * (values[i] - yMean);
  }
  if (sxx === 0) return false;
  const slope = sxy / sxx;
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const pred = yMean + slope * (i - xMean);
    const err = values[i] - pred;
    sse += err * err;
  }
  const se = Math.sqrt(sse / Math.max(1, n - 2) / sxx);
  if (se === 0) return false;
  return Math.abs(slope / se) > 2.1;
}

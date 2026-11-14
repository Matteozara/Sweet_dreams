// Voice v2 preprocessing and feature extraction from on-device dB metering.
// Note: Silero VAD, librosa pyin F0, spectral slopes, and gemini-3.5-transcribe
// word counts run on the EU backend; on-device analysis computes timing, pauses,
// SNR quality, and relative loudness CV from the recorded metering timeline.

import { cv, median, percentile } from './stats.js';

const MIN_SPEECH_MS = 20000;
const MIN_SNR_REJECT_DB = 15;
const LOW_CONF_SNR_DB = 20;
const MERGE_GAP_MS = 100;
const PAUSE_MIN_MS = 250;
const LONG_PAUSE_MIN_MS = 1000;

/**
 * Analyze a single voice entry (`entry.answer` with `type === 'audio'`).
 * Returns null if the entry is not an audio recording.
 */
export function analyzeVoiceEntry(entry) {
  if (entry?.answer?.type !== 'audio') return null;

  const durationMs = entry.answer.durationMs || 0;
  const metering = entry.answer.metering; // [[tMs, db], ...]

  if (!Array.isArray(metering) || metering.length < 3) {
    return {
      durationMs,
      hasMetering: false,
      quality: {
        status: durationMs >= MIN_SPEECH_MS ? 'low_confidence' : 'rejected',
        reason: durationMs >= MIN_SPEECH_MS ? 'No frame-level metering' : 'Below 20 s speech minimum',
        speechTimeMs: null,
        snrDb: null,
      },
    };
  }

  const dbs = metering.map(([, db]) => db);
  const noiseFloorDb = percentile(dbs, 5);
  const speechThreshDb = Math.max(-50, Math.min(-25, noiseFloorDb + 7));

  // Classify frames as speech (1) or silence (0).
  const isSpeech = metering.map(([, db]) => db >= speechThreshDb);

  // Estimate frame step (default 100 ms).
  const dts = [];
  for (let i = 1; i < metering.length; i += 1) {
    const dt = metering[i][0] - metering[i - 1][0];
    if (dt > 0) dts.push(dt);
  }
  const frameMs = median(dts) || 100;

  // Merge silence gaps shorter than 100 ms.
  const merged = [...isSpeech];
  let i = 0;
  while (i < merged.length) {
    if (!merged[i]) {
      let j = i;
      while (j < merged.length && !merged[j]) j += 1;
      const gapMs = (j - i) * frameMs;
      if (gapMs < MERGE_GAP_MS && i > 0 && j < merged.length) {
        for (let k = i; k < j; k += 1) merged[k] = true;
      }
      i = j;
    } else {
      i += 1;
    }
  }

  // Compute speech time, pauses (>= 250 ms), long pauses (>= 1000 ms), and speech dBs.
  let speechFrames = 0;
  const speechDbs = [];
  const pausesMs = [];
  let idx = 0;
  while (idx < merged.length) {
    if (merged[idx]) {
      speechFrames += 1;
      if (isSpeech[idx]) speechDbs.push(metering[idx][1]);
      idx += 1;
    } else {
      let end = idx;
      while (end < merged.length && !merged[end]) end += 1;
      const silMs = (end - idx) * frameMs;
      // Only count interior pauses (between speech segments) or substantial silences.
      if (silMs >= PAUSE_MIN_MS && idx > 0 && end < merged.length) {
        pausesMs.push(silMs);
      }
      idx = end;
    }
  }

  const totalTimeMs = Math.max(durationMs, metering[metering.length - 1][0]);
  const speechTimeMs = speechFrames * frameMs;
  const totalPauseMs = pausesMs.reduce((s, v) => s + v, 0);
  const pauseRatio = totalTimeMs > 0 ? totalPauseMs / totalTimeMs : 0;
  const medianPauseMs = pausesMs.length ? median(pausesMs) : 0;
  const longPauses = pausesMs.filter((p) => p >= LONG_PAUSE_MIN_MS).length;
  const longPausesPerMin = totalTimeMs > 0 ? (longPauses / totalTimeMs) * 60000 : 0;

  // Loudness CV relative to session median (linear amplitude ratio).
  let loudnessCV = null;
  if (speechDbs.length >= 2) {
    const medDb = median(speechDbs);
    const relAmps = speechDbs.map((db) => Math.pow(10, (db - medDb) / 20));
    loudnessCV = cv(relAmps);
  }

  // SNR check: speech median dB minus noise floor dB.
  const speechMedDb = speechDbs.length ? median(speechDbs) : noiseFloorDb;
  const snrDb = Math.max(0, speechMedDb - noiseFloorDb);

  let status = 'valid';
  let reason = null;
  if (speechTimeMs < MIN_SPEECH_MS) {
    status = 'rejected';
    reason = 'Below 20 s speech minimum';
  } else if (snrDb < MIN_SNR_REJECT_DB) {
    status = 'rejected';
    reason = 'SNR below 15 dB';
  } else if (snrDb < LOW_CONF_SNR_DB) {
    status = 'low_confidence';
    reason = 'SNR 15–20 dB';
  }

  return {
    durationMs: totalTimeMs,
    hasMetering: true,
    speechTimeMs,
    pauseRatio,
    medianPauseMs,
    longPausesPerMin,
    loudnessCV,
    snrDb,
    audioSource: entry.answer.audioSource || 'default',
    quality: {
      status,
      reason,
      speechTimeMs,
      snrDb,
    },
  };
}

/** Aggregate daily voice results for a week. */
export function aggregateVoiceWeek(dayEntries) {
  const results = dayEntries
    .map((e) => ({ date: e.date, metrics: analyzeVoiceEntry(e) }))
    .filter((r) => r.metrics);

  if (results.length === 0) return null;

  const withMetering = results.filter((r) => r.metrics.hasMetering);
  const valid = withMetering.filter((r) => r.metrics.quality.status === 'valid');
  const lowConf = withMetering.filter((r) => r.metrics.quality.status === 'low_confidence');
  const rejected = results.filter((r) => r.metrics.quality.status === 'rejected');

  const pool = valid.length + lowConf.length > 0 ? [...valid, ...lowConf] : withMetering;

  return {
    count: results.length,
    validCount: valid.length,
    lowConfidenceCount: lowConf.length,
    rejectedCount: rejected.length,
    durationMs: median(results.map((r) => r.metrics.durationMs)),
    speechTimeMs: pool.length ? median(pool.map((r) => r.metrics.speechTimeMs)) : null,
    pauseRatio: pool.length ? median(pool.map((r) => r.metrics.pauseRatio)) : null,
    medianPauseMs: pool.length ? median(pool.map((r) => r.metrics.medianPauseMs)) : null,
    longPausesPerMin: pool.length ? median(pool.map((r) => r.metrics.longPausesPerMin)) : null,
    loudnessCV: pool.length ? median(pool.map((r) => r.metrics.loudnessCV).filter((v) => v !== null)) : null,
    snrDb: pool.length ? median(pool.map((r) => r.metrics.snrDb)) : null,
    daily: results,
  };
}

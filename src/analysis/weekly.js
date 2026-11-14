// Per-week grouping and multi-modal v2 analysis.

import { dayKey, keyToDate } from '../line.js';
import { mean, median } from './stats.js';
import { analyzeDrawing, aggregateDrawingWeek } from './drawing.js';
import { analyzeTypingEntry, aggregateTypingWeek } from './typing.js';
import { analyzeVoiceEntry, aggregateVoiceWeek } from './voice.js';
import { classifyMotorState, computeBaseline, normalizeFeature } from './normalization.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Return Monday `YYYY-MM-DD` for the week containing `dateKey`. */
export function weekStartKey(dateKey) {
  const d = keyToDate(dateKey);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return dayKey(d);
}

export function weekEndKey(startKey) {
  const d = keyToDate(startKey);
  d.setDate(d.getDate() + 6);
  return dayKey(d);
}

export function formatWeekLabel(startKey, endKey) {
  const s = keyToDate(startKey);
  const e = keyToDate(endKey);
  if (s.getMonth() === e.getMonth()) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
  }
  return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}

/**
 * Group entries by Monday–Sunday calendar week and compute v2 modality
 * aggregates and baseline-normalized z-scores for each week.
 */
export function buildWeeklyAnalysis(entries, { phq9 = 0, sigmaPool = null } = {}) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return { weeks: [], baseline: computeBaseline([], { phq9, sigmaPool }) };

  // Build daily feature rows across all entries for baseline computation.
  const dailyRows = sorted.map((e) => {
    const draw = analyzeDrawing(e.line);
    const typ = analyzeTypingEntry(e);
    const voi = analyzeVoiceEntry(e);
    return {
      date: e.date,
      drawingSpeed: draw?.meanSpeed ?? null,
      drawingPauseTimeMs: draw?.totalPauseTimeMs ?? null,
      ikdMedianMs: typ && !typ.dropped ? typ.medianIkdMs : null,
      ikdMadMs: typ && !typ.dropped ? typ.ikdMadMs : null,
      backspaceRate: typ && !typ.dropped ? typ.backspaceRate : null,
      typingSessionMs: typ && !typ.dropped ? typ.medianSessionLengthMs : null,
      voicePauseRatio: voi && voi.hasMetering && voi.quality.status !== 'rejected' ? voi.pauseRatio : null,
      voiceLongPausesPerMin:
        voi && voi.hasMetering && voi.quality.status !== 'rejected' ? voi.longPausesPerMin : null,
    };
  });

  const baseline = computeBaseline(dailyRows, { phq9, sigmaPool });

  // Modality aggregates, exploratory Day Line tag, and signed + |z| dysregulation scores.
  const summarize = (set) => {
    const rawDrawing = aggregateDrawingWeek(set);
    // Explicitly mark Day Line kinematics as exploratory (emotional curve shape & recall pauses affect speed).
    const drawing = rawDrawing ? { ...rawDrawing, exploratory: true } : null;
    const typing = aggregateTypingWeek(set);
    const voice = aggregateVoiceWeek(set);

    if (!baseline.ready) {
      return { drawing, typing, voice, zScores: null, signedPaceZ: null, dysregulationZ: null, motorState: null };
    }

    const ikdSignedRaw = normalizeFeature(typing?.medianIkdMs, baseline.stats.ikdMedianMs, { signed: true });
    const zScores = {
      drawingSpeed: normalizeFeature(drawing?.meanSpeed, baseline.stats.drawingSpeed, { signed: true }),
      drawingPauseTimeMs: normalizeFeature(drawing?.totalPauseTimeMs, baseline.stats.drawingPauseTimeMs, { signed: true }),
      ikdMedianMs: normalizeFeature(typing?.medianIkdMs, baseline.stats.ikdMedianMs, { signed: false }),
      ikdMedianSignedMs: ikdSignedRaw,
      ikdMadMs: normalizeFeature(typing?.ikdMadMs, baseline.stats.ikdMadMs, { signed: true }),
      backspaceRate: normalizeFeature(typing?.backspaceRate, baseline.stats.backspaceRate, { signed: true }),
      typingSessionMs: normalizeFeature(typing?.medianSessionLengthMs, baseline.stats.typingSessionMs, { signed: true }),
      voicePauseRatio: normalizeFeature(voice?.pauseRatio, baseline.stats.voicePauseRatio, { signed: true }),
      voiceLongPausesPerMin: normalizeFeature(voice?.longPausesPerMin, baseline.stats.voiceLongPausesPerMin, {
        signed: true,
      }),
    };

    // Signed pace axis (+ = faster / more fluent, - = slowed / longer pauses, 0 = personal equilibrium).
    const paceComponents = [
      zScores.drawingSpeed,
      zScores.drawingPauseTimeMs !== null ? -zScores.drawingPauseTimeMs : null,
      ikdSignedRaw !== null ? -ikdSignedRaw : null,
      zScores.voicePauseRatio !== null ? -zScores.voicePauseRatio : null,
      zScores.voiceLongPausesPerMin !== null ? -zScores.voiceLongPausesPerMin : null,
    ].filter((v) => typeof v === 'number' && Number.isFinite(v));
    const signedPaceZ = paceComponents.length ? median(paceComponents) : null;

    // Absolute-deviation score `mean(|z|)` alongside the signed score (Papers #4 & #7).
    const absComponents = [
      zScores.drawingSpeed,
      zScores.drawingPauseTimeMs,
      zScores.ikdMedianMs,
      zScores.ikdMadMs,
      zScores.backspaceRate,
      zScores.voicePauseRatio,
      zScores.voiceLongPausesPerMin,
    ]
      .filter((v) => typeof v === 'number' && Number.isFinite(v))
      .map((v) => Math.abs(v));
    const dysregulationZ = absComponents.length ? mean(absComponents) : null;

    const motorState = classifyMotorState({
      signedPaceZ,
      dysregulationZ,
      ikdMadZ: zScores.ikdMadMs,
      backspaceZ: zScores.backspaceRate,
      nightShare: typing?.nightShare ?? 0,
    });

    return { drawing, typing, voice, zScores, signedPaceZ, dysregulationZ, motorState };
  };

  // Group entries by Monday week key.
  const map = new Map();
  for (const entry of sorted) {
    const start = weekStartKey(entry.date);
    if (!map.has(start)) map.set(start, []);
    map.get(start).push(entry);
  }

  const weeks = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startKey, weekEntries]) => {
      const endKey = weekEndKey(startKey);
      const { drawing, typing, voice, zScores, signedPaceZ, dysregulationZ, motorState } = summarize(weekEntries);
      // The same summary over a single evening, for the day-by-day view.
      const days = weekEntries.map((entry) => ({ entry, date: entry.date, ...summarize([entry]) }));
      const scoredDays = weekEntries
        .filter((e) => typeof e.dayScore?.score === 'number')
        .map((e) => ({ date: e.date, ...e.dayScore }));
      const dayScore = scoredDays.length
        ? {
            meanScore: mean(scoredDays.map((d) => d.score)),
            medianScore: median(scoredDays.map((d) => d.score)),
            count: scoredDays.length,
            latest: scoredDays[scoredDays.length - 1],
            daily: scoredDays,
          }
        : null;

      return {
        weekKey: startKey,
        startKey,
        endKey,
        label: formatWeekLabel(startKey, endKey),
        entries: weekEntries,
        days,
        drawing,
        typing,
        voice,
        dayScore,
        zScores,
        signedPaceZ,
        dysregulationZ,
        motorState,
      };
    });

  return { weeks, baseline };
}

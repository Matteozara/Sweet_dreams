import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDrawing, DP_PER_MM } from '../drawing.js';
import { analyzeTypingEntry } from '../typing.js';
import { analyzeVoiceEntry } from '../voice.js';
import { classifyMotorState, computeBaseline, normalizeFeature, SIGMA_MIN } from '../normalization.js';
import { scoreDayLine } from '../dayScore.js';
import { buildWeeklyAnalysis } from '../weekly.js';
import { suggestionsForEntry } from '../../activities.js';

test('drawing: constant-speed stroke computes accurate speed and quality', () => {
  const w = 320;
  const h = 240;
  // 50 mm horizontal stroke over 1000 ms at 10 ms intervals -> 50 mm/s
  const distNorm = (50 * DP_PER_MM) / w;
  const motion = [];
  for (let t = 0; t <= 1000; t += 10) {
    motion.push([0.1 + (t / 1000) * distNorm, 0.5, t]);
  }
  const res = analyzeDrawing({ motion, canvas: { w, h, dpPerMm: DP_PER_MM }, attempts: 1 });
  assert.ok(res);
  assert.equal(res.quality.valid, true);
  assert.ok(Math.abs(res.meanSpeed - 50) < 3, `expected ~50 mm/s, got ${res.meanSpeed}`);
  assert.equal(res.pauseCount, 0);
  assert.equal(res.fingerLifts, 0);
});

test('drawing: detects pauses >= 100 ms with speed < 5 mm/s and drops > 50 mm jumps', () => {
  const w = 320;
  const h = 240;
  const motion = [];
  // Move 20 mm in 400 ms, pause 200 ms, move 20 mm in 400 ms
  const d20 = (20 * DP_PER_MM) / w;
  for (let t = 0; t <= 400; t += 10) motion.push([0.1 + (t / 400) * d20, 0.5, t]);
  for (let t = 410; t <= 600; t += 10) motion.push([0.1 + d20, 0.5, t]);
  for (let t = 610; t <= 1000; t += 10) motion.push([0.1 + d20 + ((t - 600) / 400) * d20, 0.5, t]);
  // Inject a > 50 mm jump at the end
  motion.push([0.99, 0.99, 1010]);

  const res = analyzeDrawing({ motion, canvas: { w, h, dpPerMm: DP_PER_MM }, attempts: 2 });
  assert.ok(res);
  assert.ok(res.pauseCount >= 1, `expected >= 1 pause, got ${res.pauseCount}`);
  assert.ok(res.totalPauseTimeMs >= 100);
  assert.equal(res.fingerLifts, 1);
});

test('drawing: multi-stroke motion [x, y, t, strokeId] resamples within strokes and counts fingerLifts', () => {
  const w = 320;
  const h = 240;
  const motion = [];
  // Stroke 1: 0..400 ms
  for (let t = 0; t <= 400; t += 10) {
    motion.push([0.1 + (t / 400) * 0.3, 0.5, t, 1]);
  }
  // 300 ms finger lift gap, then Stroke 2: 700..1100 ms
  for (let t = 700; t <= 1100; t += 10) {
    motion.push([0.4 + ((t - 700) / 400) * 0.3, 0.5, t, 2]);
  }
  const res = analyzeDrawing({ motion, canvas: { w, h, dpPerMm: DP_PER_MM }, attempts: 2 });
  assert.ok(res);
  assert.equal(res.fingerLifts, 1);
  assert.equal(res.quality.valid, true);
  assert.ok(res.movementTimeMs >= 1100);
});

test('typing: drops < 10 key sessions, splits > 8s gaps, drops < 30ms IKD, flags < 200 keys', () => {
  const shortEntry = {
    date: '2026-11-10',
    startedAt: '2026-11-10T22:00:00',
    answer: { type: 'text', typing: { keystrokes: [[0, 'char'], [100, 'char'], [200, 'char']] } },
  };
  assert.equal(analyzeTypingEntry(shortEntry).dropped, true);

  const ks = [];
  let t = 0;
  for (let i = 0; i < 15; i += 1) {
    ks.push([t, i === 5 ? 'backspace' : 'char']);
    t += i === 2 ? 10 : 150; // one 10ms IKD (< 30ms) should be dropped
  }
  const nightEntry = {
    date: '2026-11-11',
    startedAt: '2026-11-11T02:15:00',
    answer: { type: 'text', typing: { keystrokes: ks } },
  };
  const res = analyzeTypingEntry(nightEntry);
  assert.equal(res.dropped, false);
  assert.equal(res.lowConfidence, true);
  assert.equal(res.nightShare, 1);
  assert.ok(Math.abs(res.medianIkdMs - 150) < 1);
});

test('voice: validates >= 20s speech, merges < 100ms gaps, counts pauses & long pauses', () => {
  const metering = [];
  for (let t = 0; t <= 26000; t += 100) {
    // 1.2s long pause at 5000..6200, 400ms pause at 12000..12400
    const silent = (t >= 5000 && t < 6200) || (t >= 12000 && t < 12400);
    metering.push([t, silent ? -55 : -22]);
  }
  const res = analyzeVoiceEntry({
    date: '2026-11-12',
    answer: { type: 'audio', durationMs: 26000, metering },
  });
  assert.equal(res.quality.status, 'valid');
  assert.ok(res.speechTimeMs >= 20000);
  assert.ok(res.longPausesPerMin > 0);
  assert.ok(res.pauseRatio > 0 && res.pauseRatio < 0.2);

  const tooShort = analyzeVoiceEntry({
    date: '2026-11-13',
    answer: { type: 'audio', durationMs: 10000, metering: metering.slice(0, 100) },
  });
  assert.equal(tooShort.quality.status, 'rejected');
});

test('normalization & weekly grouping: excludes 5 practice sessions and normalizes across weeks', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({
    drawingSpeed: 40 + (i % 3),
    drawingPauseTimeMs: 120,
    ikdMedianMs: 150,
    ikdMadMs: 20,
    typingSessionMs: 12000,
    voicePauseRatio: 0.1,
  }));
  const base = computeBaseline(rows, { phq9: 2 });
  assert.equal(base.practiceExcluded, 5);
  assert.equal(base.baselineSessions, 11);
  assert.equal(base.ready, true);
  assert.equal(normalizeFeature(1000, base.stats.drawingSpeed, { signed: true }), 5);

  // Build 14 days of entries across 2+ weeks
  const entries = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(2026, 10, 1 + i, 21, 0, 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    entries.push({
      id: `e-${i}`,
      date: key,
      startedAt: d.toISOString(),
      answer: { type: 'text', typing: { keystrokes: Array.from({ length: 25 }, (_, k) => [k * 140, 'char']) } },
      line: {
        points: [
          { x: 0.1, y: 0.5, t: 0 },
          { x: 0.9, y: 0.5, t: 1000 },
        ],
        motion: Array.from({ length: 40 }, (_, k) => [0.1 + (k / 39) * 0.8, 0.5, k * 15]),
        canvas: { w: 320, h: 240, dpPerMm: DP_PER_MM },
        attempts: 1,
      },
    });
  }
  const weekly = buildWeeklyAnalysis(entries);
  assert.ok(weekly.weeks.length >= 2);
  assert.ok(weekly.weeks[0].drawing);
  assert.equal(weekly.weeks[0].drawing.exploratory, true);
  assert.ok(weekly.weeks[0].typing);
});

test('normalization: zero-inflated baseline (MAD = 0 at k = 0) uses SIGMA_MIN floor instead of returning null', () => {
  // 5 practice + 10 baseline sessions where 8/10 baseline evenings have 0 drawing pauses and 0 long voice pauses
  const rows = Array.from({ length: 15 }, (_, i) => {
    const baseIdx = i - 5;
    const hasRarePause = baseIdx >= 8;
    return {
      drawingSpeed: 38 + (i % 4),
      drawingPauseTimeMs: baseIdx >= 0 && hasRarePause ? 140 : 0,
      ikdMedianMs: 165 + (i % 5) * 4,
      ikdMadMs: 28 + (i % 3) * 3,
      backspaceRate: 0.04,
      typingSessionMs: 14000,
      voicePauseRatio: 0.16 + (i % 3) * 0.01,
      voiceLongPausesPerMin: baseIdx >= 0 && hasRarePause ? 1.2 : 0,
    };
  });

  const base = computeBaseline(rows, { phq9: 1 });
  assert.equal(base.ready, true);
  assert.equal(base.k, 0);
  assert.equal(base.anyFloorUsed, true);
  assert.equal(base.stats.drawingPauseTimeMs.med, 0);
  assert.equal(base.stats.drawingPauseTimeMs.rawS, 0);
  assert.equal(base.stats.drawingPauseTimeMs.usedFloor, true);
  assert.equal(base.stats.drawingPauseTimeMs.s, SIGMA_MIN.drawingPauseTimeMs);

  // 0 ms pause stays at 0 SD; a 360 ms relapse hesitation yields +3.0 SD instead of null
  assert.equal(normalizeFeature(0, base.stats.drawingPauseTimeMs), 0);
  assert.equal(normalizeFeature(360, base.stats.drawingPauseTimeMs), 3);
  assert.equal(normalizeFeature(1.6, base.stats.voiceLongPausesPerMin), 2);
});

test('classifyMotorState: separates personal equilibrium, psychomotor slowing, and agitation / dysregulation', () => {
  // 0 SD neighborhood -> healthy personal equilibrium
  assert.equal(
    classifyMotorState({ signedPaceZ: 0.25, dysregulationZ: 0.65, ikdMadZ: 0.1, backspaceZ: -0.2, nightShare: 0 }).code,
    'equilibrium'
  );

  // Large negative shift (< -1.5 SD) -> psychomotor slowing / retardation
  assert.equal(
    classifyMotorState({ signedPaceZ: -1.85, dysregulationZ: 1.9, ikdMadZ: 1.1, backspaceZ: 0.8, nightShare: 0 }).code,
    'slowing'
  );

  // Large positive speed spike (> +1.8 SD) -> possible agitation / dysregulation (not extra healthy)
  assert.equal(
    classifyMotorState({ signedPaceZ: 2.05, dysregulationZ: 1.95, ikdMadZ: 0.4, backspaceZ: 0.3, nightShare: 0 }).code,
    'agitation_watch'
  );

  // Moderately fast pace (+1.45 SD) paired with high IKD MAD / backspaces / nocturnal typing -> agitation_watch
  assert.equal(
    classifyMotorState({ signedPaceZ: 1.45, dysregulationZ: 1.7, ikdMadZ: 1.6, backspaceZ: 1.5, nightShare: 0.35 }).code,
    'agitation_watch'
  );

  // Near-zero mean pace but high |z| dispersion -> dysregulated
  assert.equal(
    classifyMotorState({ signedPaceZ: -0.2, dysregulationZ: 1.75, ikdMadZ: 0.9, backspaceZ: 0.9, nightShare: 0 }).code,
    'dysregulated'
  );
});

test('dayScore: calls Gemini API with drawing meaning and clamps 0..10 score', async () => {
  const prevKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'test-key';
  try {
    let capturedBody = null;
    const mockFetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ score: 7.46, rationale: 'Lifted steadily toward night.' }) }],
              },
            },
          ],
        }),
      };
    };
    const res = await scoreDayLine(
      {
        points: [
          { x: 0, y: 0.7, t: 0 },
          { x: 1, y: 0.2, t: 1200 },
        ],
        durationMs: 1200,
        fingerLifts: 0,
      },
      { fetchImpl: mockFetch }
    );
    assert.ok(res);
    assert.equal(res.score, 7.5);
    assert.equal(res.rationale, 'Lifted steadily toward night.');
    assert.ok(capturedBody.contents[0].parts[0].text.includes('+ Light'));
  } finally {
    if (prevKey === undefined) delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    else process.env.EXPO_PUBLIC_GEMINI_API_KEY = prevKey;
  }
});

test('activities: suggestionsForEntry picks different activity tiers across all 5 score bands', () => {
  const fixedDate = new Date(2026, 10, 14);
  const brightDay = suggestionsForEntry(
    {
      line: { points: [{ x: 0, y: 0.12 }, { x: 1, y: 0.1 }] }, // near top (+ Good) -> ~8.9/10
      contentState: { score: 9 },
    },
    { date: fixedDate }
  );
  const steadyDay = suggestionsForEntry(
    {
      line: { points: [{ x: 0, y: 0.28 }, { x: 1, y: 0.25 }] }, // ~7.3/10
      contentState: { score: 7 },
    },
    { date: fixedDate }
  );
  const mixedDay = suggestionsForEntry(
    {
      line: { points: [{ x: 0, y: 0.48 }, { x: 1, y: 0.45 }] }, // ~5.3/10
      contentState: { score: 5 },
    },
    { date: fixedDate }
  );
  const heavyDay = suggestionsForEntry(
    {
      line: { points: [{ x: 0, y: 0.68 }, { x: 1, y: 0.7 }] }, // ~3.1/10
      contentState: { score: 3 },
    },
    { date: fixedDate }
  );
  const veryHardDay = suggestionsForEntry(
    {
      line: { points: [{ x: 0, y: 0.88 }, { x: 1, y: 0.92 }] }, // near bottom (- Bad) -> ~1.1/10
      contentState: { score: 1 },
    },
    { date: fixedDate }
  );

  assert.equal(brightDay.level.id, 'L0');
  assert.equal(steadyDay.level.id, 'L1');
  assert.equal(mixedDay.level.id, 'L2');
  assert.equal(heavyDay.level.id, 'L3');
  assert.equal(veryHardDay.level.id, 'L4');
  assert.equal(brightDay.items.length, 3);
  assert.equal(veryHardDay.items.length, 3);
  assert.notDeepEqual(
    brightDay.items.map((i) => i.title),
    veryHardDay.items.map((i) => i.title)
  );
});

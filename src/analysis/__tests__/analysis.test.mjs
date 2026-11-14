import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDrawing, DP_PER_MM } from '../drawing.js';
import { analyzeTypingEntry } from '../typing.js';
import { analyzeVoiceEntry } from '../voice.js';
import { computeBaseline, normalizeFeature } from '../normalization.js';
import { buildWeeklyAnalysis } from '../weekly.js';

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
  assert.ok(weekly.weeks[0].typing);
});

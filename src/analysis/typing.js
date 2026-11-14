// Typing v2 preprocessing and feature extraction.
// Supports keystroke timing streams (`[[dtMs, category], ...]`, never storing characters)
// as well as legacy `events` (`[[dtMs, textLength], ...]`).

import { median, percentile, scaledMad } from './stats.js';

const MIN_SESSION_KEYS = 10;
const MIN_DAILY_KEYS_CONFIDENT = 200;
const MIN_IKD_MS = 30;
const SESSION_SPLIT_GAP_MS = 8000;

/**
 * Normalize raw typing events into a uniform `[dtMs, category]` stream.
 * Categories: 'char' | 'backspace' | 'other'.
 */
function toKeystrokes(typing) {
  if (!typing) return [];
  if (Array.isArray(typing.keystrokes) && typing.keystrokes.length > 0) {
    return typing.keystrokes;
  }
  if (!Array.isArray(typing.events) || typing.events.length === 0) return [];

  const out = [];
  let prevLen = 0;
  for (let i = 0; i < typing.events.length; i += 1) {
    const [dt, len] = typing.events[i];
    const cat = len < prevLen ? 'backspace' : 'char';
    out.push([dt, cat]);
    prevLen = len;
  }
  return out;
}

/**
 * Analyze a single day's typing entry.
 * Returns null if the entry has no text typing data.
 */
export function analyzeTypingEntry(entry) {
  if (entry?.answer?.type !== 'text') return null;
  const typing = entry.answer.typing;
  const stream = toKeystrokes(typing);
  if (stream.length === 0) return null;

  // Split into sub-sessions wherever gap > 8000 ms.
  const subSessions = [];
  let current = [stream[0]];
  for (let i = 1; i < stream.length; i += 1) {
    const gap = stream[i][0] - stream[i - 1][0];
    if (gap > SESSION_SPLIT_GAP_MS) {
      subSessions.push(current);
      current = [stream[i]];
    } else {
      current.push(stream[i]);
    }
  }
  subSessions.push(current);

  // Drop sub-sessions with fewer than 10 keys.
  const validSessions = subSessions.filter((s) => s.length >= MIN_SESSION_KEYS);
  if (validSessions.length === 0) {
    return {
      dropped: true,
      keyCount: stream.length,
      lowConfidence: true,
    };
  }

  const ikds = [];
  const sessionLengths = [];
  let totalKeys = 0;
  let backspaces = 0;

  for (const sess of validSessions) {
    totalKeys += sess.length;
    const lenMs = Math.max(0, sess[sess.length - 1][0] - sess[0][0]);
    sessionLengths.push(lenMs);

    for (let i = 0; i < sess.length; i += 1) {
      if (sess[i][1] === 'backspace') backspaces += 1;
      if (i > 0 && sess[i][1] === 'char' && sess[i - 1][1] === 'char') {
        const ikd = sess[i][0] - sess[i - 1][0];
        if (ikd >= MIN_IKD_MS) ikds.push(ikd);
      }
    }
  }

  // Night typing share (00:00 - 05:00 local time).
  let isNight = false;
  if (entry.startedAt) {
    const hour = new Date(entry.startedAt).getHours();
    isNight = hour >= 0 && hour < 5;
  }

  return {
    dropped: false,
    keyCount: totalKeys,
    lowConfidence: totalKeys < MIN_DAILY_KEYS_CONFIDENT,
    medianIkdMs: median(ikds),
    p95IkdMs: percentile(ikds, 95),
    ikdMadMs: scaledMad(ikds),
    backspaceRate: totalKeys > 0 ? backspaces / totalKeys : 0,
    medianSessionLengthMs: median(sessionLengths),
    nightShare: isNight ? 1 : 0,
    ikdSampleCount: ikds.length,
  };
}

/** Aggregate daily typing results for a week. */
export function aggregateTypingWeek(dayEntries) {
  const results = dayEntries
    .map((e) => ({ date: e.date, metrics: analyzeTypingEntry(e) }))
    .filter((r) => r.metrics);

  if (results.length === 0) return null;

  const usable = results.filter((r) => !r.metrics.dropped);
  const droppedCount = results.length - usable.length;
  if (usable.length === 0) {
    return {
      count: results.length,
      usableCount: 0,
      droppedCount,
      lowConfidenceCount: results.length,
      daily: results,
    };
  }

  const lowConfidenceCount = usable.filter((r) => r.metrics.lowConfidence).length;
  const ikdMeds = usable.map((r) => r.metrics.medianIkdMs).filter((v) => v !== null);
  const ikdP95s = usable.map((r) => r.metrics.p95IkdMs).filter((v) => v !== null);
  const ikdMads = usable.map((r) => r.metrics.ikdMadMs).filter((v) => v !== null);

  return {
    count: results.length,
    usableCount: usable.length,
    droppedCount,
    lowConfidenceCount,
    medianIkdMs: median(ikdMeds),
    p95IkdMs: median(ikdP95s),
    ikdMadMs: median(ikdMads),
    backspaceRate: median(usable.map((r) => r.metrics.backspaceRate)),
    medianSessionLengthMs: median(usable.map((r) => r.metrics.medianSessionLengthMs)),
    keysPerDay: median(usable.map((r) => r.metrics.keyCount)),
    nightShare: usable.reduce((s, r) => s + r.metrics.nightShare, 0) / usable.length,
    daily: results,
  };
}

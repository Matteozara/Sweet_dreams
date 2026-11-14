import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey } from './line';

const PROFILE = 'sweetdreams.profile.v1';
const ENTRIES = 'sweetdreams.entries.v1';

export const defaultProfile = {
  signedIn: false,
  onboarded: false,
  movement: false,
  reminder: { enabled: true, hour: 22, minute: 0 },
};

async function read(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadAll() {
  const [profile, entries] = await Promise.all([read(PROFILE, null), read(ENTRIES, [])]);
  return { profile: { ...defaultProfile, ...(profile || {}) }, entries };
}

export const saveProfile = (profile) => AsyncStorage.setItem(PROFILE, JSON.stringify(profile)).catch(() => {});
export const saveEntries = (entries) => AsyncStorage.setItem(ENTRIES, JSON.stringify(entries)).catch(() => {});
export const clearAllData = () => AsyncStorage.multiRemove([PROFILE, ENTRIES]).catch(() => {});

/** One entry per day: a new one for the same date replaces the old one. */
export function upsertEntry(entries, entry) {
  return [...entries.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

function buildSampleMotion(points, durationMs) {
  // ~120 samples at ~15 ms intervals for realistic Savitzky-Golay kinematics & pause detection
  const steps = Math.max(80, Math.round(durationMs / 15));
  const motion = [];
  for (let i = 0; i < steps; i += 1) {
    const frac = i / (steps - 1);
    const pIdx = Math.min(points.length - 1, Math.floor(frac * (points.length - 1)));
    const pNext = Math.min(points.length - 1, pIdx + 1);
    const localT = frac * (points.length - 1) - pIdx;
    // Slight hesitation around the middle of the stroke to exercise pause detection
    const pauseFactor = frac > 0.48 && frac < 0.54 ? 0.05 : 1;
    const x = points[pIdx].x + (points[pNext].x - points[pIdx].x) * localT * pauseFactor;
    const y = points[pIdx].y + (points[pNext].y - points[pIdx].y) * localT;
    motion.push([+x.toFixed(4), +y.toFixed(4), Math.round(frac * durationMs)]);
  }
  return motion;
}

function buildSampleTyping(back) {
  const keystrokes = [];
  let t = 0;
  const keyCount = 210 + (back % 3) * 18;
  for (let i = 0; i < keyCount; i += 1) {
    const isBackspace = i % 23 === 11;
    const isSpace = i % 6 === 5;
    const cat = isBackspace ? 'backspace' : isSpace ? 'other' : 'char';
    keystrokes.push([t, cat]);
    t += 135 + ((i * 37 + back * 19) % 110);
  }
  return {
    type: 'text',
    text: '',
    typing: {
      durationMs: t,
      changes: keyCount,
      deletions: Math.floor(keyCount / 23),
      events: keystrokes.map(([dt], i) => [dt, i + 1]),
      keystrokes,
    },
  };
}

function buildSampleVoice(back) {
  const durationMs = 34000 + (back % 4) * 2000;
  const metering = [];
  for (let t = 0; t <= durationMs; t += 100) {
    // Alternate speech bursts and short/long pauses
    const sec = t / 1000;
    const inPause = (sec > 7 && sec < 8.3) || (sec > 17 && sec < 17.6) || (sec > 25 && sec < 26.2);
    const db = inPause ? -52 + Math.sin(t / 90) * 1.5 : -24 + Math.sin(t / 130 + back) * 5;
    metering.push([t, Math.round(db * 10) / 10]);
  }
  return {
    type: 'audio',
    uri: null,
    durationMs,
    metering,
    audioSource: 'sample',
  };
}

/** Two plausible past weeks, for demos. Never overwrites real days. */
export function sampleEntries(existing = []) {
  const taken = new Set(existing.map((e) => e.date));
  const out = [];
  for (let back = 16; back >= 1; back--) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    d.setHours(21, 30, 0, 0);
    const date = dayKey(d);
    if (taken.has(date)) continue;
    const base = 0.68 - (16 - back) * 0.02; // slowly lighter over the two weeks
    const points = Array.from({ length: 40 }, (_, i) => {
      const x = 0.04 + (i / 39) * 0.92;
      const y =
        base +
        0.13 * Math.sin(x * 5 + back * 1.7) +
        0.06 * Math.sin(x * 11 + back) -
        0.08 * x;
      return { x, y: Math.min(0.94, Math.max(0.06, y)), t: i * 55 };
    });
    const durationMs = 2100 + (back % 4) * 180;
    const answer = back % 2 === 0 ? buildSampleTyping(back) : buildSampleVoice(back);
    out.push({
      id: `sample-${date}`,
      date,
      sample: true,
      startedAt: d.toISOString(),
      finishedAt: new Date(d.getTime() + durationMs).toISOString(),
      answer,
      line: {
        points,
        motion: buildSampleMotion(points, durationMs),
        durationMs,
        attempts: back % 5 === 0 ? 2 : 1,
        canvas: { w: 320, h: 240, dpPerMm: +(160 / 25.4).toFixed(4), pixelRatio: 2 },
      },
    });
  }
  return [...existing, ...out].sort((a, b) => a.date.localeCompare(b.date));
}

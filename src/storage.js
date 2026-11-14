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

/** One entry per day: a new one for the same date replaces the old one. */
export function upsertEntry(entries, entry) {
  return [...entries.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

/** A plausible past week, for demos. Never overwrites real days. */
export function sampleEntries(existing = []) {
  const taken = new Set(existing.map((e) => e.date));
  const out = [];
  for (let back = 9; back >= 1; back--) {
    const d = new Date();
    d.setDate(d.getDate() - back);
    const date = dayKey(d);
    if (taken.has(date)) continue;
    const base = 0.68 - (9 - back) * 0.035; // slowly lighter over the week
    const points = Array.from({ length: 40 }, (_, i) => {
      const x = 0.04 + (i / 39) * 0.92;
      const y =
        base +
        0.13 * Math.sin(x * 5 + back * 1.7) +
        0.06 * Math.sin(x * 11 + back) -
        0.08 * x;
      return { x, y: Math.min(0.94, Math.max(0.06, y)), t: i * 45 };
    });
    out.push({
      id: `sample-${date}`,
      date,
      sample: true,
      startedAt: d.toISOString(),
      finishedAt: d.toISOString(),
      answer: { type: 'text', text: '' },
      line: { points, durationMs: 1800 },
    });
  }
  return [...existing, ...out].sort((a, b) => a.date.localeCompare(b.date));
}

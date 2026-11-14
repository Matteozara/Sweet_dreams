// Sweet Dreams Specialist Dashboard — data ingestion, v2 composite scoring, and rendering.

import { dayKey, keyToDate, meanMood } from '../src/line.js';
import { clip, mean, median } from '../src/analysis/stats.js';
import { analyzeDrawing, DP_PER_MM } from '../src/analysis/drawing.js';
import { analyzeTypingEntry } from '../src/analysis/typing.js';
import { analyzeVoiceEntry } from '../src/analysis/voice.js';
import { normalizeFeature } from '../src/analysis/normalization.js';
import { buildWeeklyAnalysis } from '../src/analysis/weekly.js';
import {
  renderDayLineSvg,
  renderDomainBars,
  renderDualLineChart,
  renderModalityTrend,
  renderZHeatmap,
} from './charts.js';

const HEATMAP_FEATURES = [
  { key: 'drawingSpeed', label: 'Drawing · Hand Speed' },
  { key: 'drawingPause', label: 'Drawing · Pause Time' },
  { key: 'drawingJerk', label: 'Drawing · Smoothness' },
  { key: 'ikdMedian', label: 'Typing · Keystroke Pace' },
  { key: 'ikdMad', label: 'Typing · Rhythm Steadiness' },
  { key: 'backspaceRate', label: 'Typing · Few Backspaces' },
  { key: 'voicePause', label: 'Voice · Fluent Speech' },
  { key: 'voiceLongPause', label: 'Voice · Few Long Silences' },
  { key: 'dayScoreZ', label: 'Mood · Day Line Score' },
];

let rawEntries = [];
let selectedTimeframeDays = 21; // 3 | 7 | 14 | 21 | null (null when weekSelect is active)
let selectedWeek = 'custom';
let selectedDate = null;

/** Deterministic PRNG so synthetic clinical telemetry has natural human variance yet stays reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a biomechanically & clinically realistic 38-day longitudinal record (36 recorded evenings):
 * - Sessions 1–5 (back 38..34): Practice / familiarization evenings.
 * - Sessions 6–15 (back 33..23, 1 missed evening at back=28): Healthy Remission Baseline (PHQ-9 < 5, 5.0 = personal norm).
 * - Transition (back 22): Episode onset.
 * - Last 21 calendar days (back 21..1, 1 missed evening at back=11 -> 20 evenings):
 *   Starts in genuine psychomotor slowing (~2.7/10 motor, ~3.5/10 mood, ~245 ms IKD, ~34% speech pauses)
 *   and steadily recovers back into healthy remission (~5.5–5.9/10 motor, ~7.4–8.1/10 mood, ~150 ms IKD, ~16% pauses).
 */
function buildDemoEntries() {
  const rand = mulberry32(20261114);
  const gauss = () => (rand() + rand() + rand() - 1.5) * 1.15; // approx N(0, 0.55)
  const out = [];

  for (let back = 38; back >= 1; back -= 1) {
    // Realistic adherence (~95%): 2 missed evenings across the 5.5-week span
    if (back === 28 || back === 11) continue;

    // Latent clinical state `health` in [0.28, 0.95]: ~0.74 = healthy personal remission baseline (with realistic sleepy/alert daily spread)
    let baseHealth;
    if (back >= 23) {
      // Practice + 10-day Remission Baseline: healthy state with realistic within-person daily variance (SD ~0.14)
      baseHealth = 0.74 + Math.sin(back * 1.35) * 0.17;
    } else if (back === 22) {
      baseHealth = 0.52;
    } else {
      // Last 21 days: positive recovery climb from moderate slowing (~ -2.2 SD) up into strong remission (~ +0.8 SD)
      const recProg = (21 - back) / 20; // 0.0 (21d ago) -> 1.0 (yesterday)
      baseHealth = 0.36 + 0.52 * Math.pow(recProg, 0.85);
    }
    const health = clip(baseHealth + gauss() * 0.075, 0.28, 0.95);
    const slowness = 1 - health; // 0 = brisk/healthy, 1 = slowed/heavy

    const d = new Date();
    d.setDate(d.getDate() - back);
    // Occasional late-night entry (00:35–01:20) during slowed evenings; normal 21:10–22:35 otherwise
    if (slowness > 0.68 && back % 3 === 0) {
      d.setHours(0, 35 + Math.floor(rand() * 45), 0, 0);
    } else {
      d.setHours(21, 10 + Math.floor(rand() * 80), 0, 0);
    }
    const date = dayKey(d);

    // 1. Continuous 60 Hz Finger Drawing (dt = 16 ms, smooth bell-shaped submovements, physiological tremor)
    const durationMs = Math.round(clip(1780 + slowness * 1720 + gauss() * 145, 1480, 3850));
    const dtMs = 16;
    const nFrames = Math.max(40, Math.round(durationMs / dtMs));

    // Motor hesitation windows: slowed days have 350–650 ms pauses; ~65% of baseline days have brief 110–190 ms micro-pauses
    const pauseDurMs =
      slowness > 0.5
        ? Math.round(280 + slowness * 390 + rand() * 90)
        : rand() < 0.68
          ? Math.round(108 + slowness * 130 + rand() * 65)
          : 0;
    const pauseCenter = 0.42 + (rand() - 0.5) * 0.16;
    const pauseHalfFrac = (pauseDurMs / durationMs) * 0.5;
    const hasFingerLift = slowness > 0.72 && rand() < 0.55;

    // Integrate smooth instantaneous speed weight -> monotonic arc progress u in [0, 1]
    const weights = [];
    for (let i = 0; i < nFrames; i += 1) {
      const f = i / (nFrames - 1);
      const envelope = Math.pow(Math.sin(Math.PI * clip(f, 0.02, 0.98)), 0.65);
      // Submovement modulation (more speed fluctuations when slowed)
      const submov = 1 + (0.14 + slowness * 0.34) * Math.sin(2 * Math.PI * (2.2 + slowness * 1.8) * f + back);
      let w = Math.max(0.08, envelope * submov);
      const distFromPause = Math.abs(f - pauseCenter);
      if (pauseHalfFrac > 0 && distFromPause < pauseHalfFrac + 0.03) {
        // Smooth raised-cosine deceleration into near-zero velocity (< 5 mm/s)
        const ramp = clip((distFromPause - pauseHalfFrac) / 0.03, 0, 1);
        w *= 0.015 + 0.985 * (0.5 - 0.5 * Math.cos(Math.PI * ramp));
      }
      weights.push(w);
    }
    const totalW = weights.reduce((a, b) => a + b, 0);

    const startY = clip(0.32 + slowness * 0.4 + gauss() * 0.045, 0.14, 0.86);
    const daySlope = -0.11 + slowness * 0.16 + gauss() * 0.03;
    const wavePhase = rand() * Math.PI * 2;
    const evalY = (x) =>
      clip(
        startY + daySlope * x + (0.055 + slowness * 0.035) * Math.sin(x * 4.6 + wavePhase),
        0.08,
        0.92
      );

    let cumW = 0;
    const motion = [];
    for (let i = 0; i < nFrames; i += 1) {
      if (i > 0) cumW += weights[i];
      const u = cumW / totalW;
      const t = Math.round((i / (nFrames - 1)) * durationMs);
      // Skip 3 frames across a genuine finger lift on two-stroke slowed attempts
      if (hasFingerLift && Math.abs(i / nFrames - 0.66) < 0.02) continue;
      const strokeId = hasFingerLift && i / nFrames >= 0.66 ? 2 : 1;
      const x = clip(0.02 + u * 0.96, 0.01, 0.99);
      const tremor = 0.0011 * Math.sin(2 * Math.PI * 8.2 * (t / 1000) + back);
      const y = clip(evalY(x) + tremor, 0.06, 0.94);
      motion.push([+x.toFixed(4), +y.toFixed(4), t, strokeId]);
    }

    // Visual Day Line points subsampled cleanly from the continuous stroke
    const points = Array.from({ length: 40 }, (_, i) => {
      const mIdx = Math.min(motion.length - 1, Math.round((i / 39) * (motion.length - 1)));
      return { x: motion[mIdx][0], y: motion[mIdx][1], t: motion[mIdx][2] };
    });

    // 2. Cumulative Multi-Burst Smartphone Typing (BiAffect-realistic 140–255 ms median IKD)
    // Include 1 realistic low-confidence day (< 200 keys) at back === 8
    const nKeys = back === 8 ? 156 : Math.round(225 + health * 65 + rand() * 35);
    const targetMedIkd = 145 + slowness * 105 + gauss() * 14; // ~165 ms healthy (SD ~15ms) -> ~235 ms slowed
    const rhythmSpread = 32 + slowness * 46 + rand() * 10; // MAD ~36 ms healthy -> ~75 ms slowed
    const bsProb = clip(0.032 + slowness * 0.062 + gauss() * 0.006, 0.02, 0.13);

    const keystrokes = [];
    let tKey = 0;
    for (let k = 0; k < nKeys; k += 1) {
      if (k > 0) {
        // Split into 2–3 natural daytime typing sessions (> 8000 ms gap)
        if (k === 88 || k === 182) {
          tKey += Math.round(10500 + rand() * 4500);
        } else {
          // Right-skewed human IKD: core digram timing + occasional word-boundary pause
          const wordPause = rand() < 0.16 ? (95 + slowness * 170) * rand() : 0;
          const rawGap = targetMedIkd + gauss() * rhythmSpread + wordPause;
          tKey += Math.round(clip(rawGap, 48, 1800));
        }
      }
      const cat = k > 2 && rand() < bsProb ? 'backspace' : 'char';
      keystrokes.push([tKey, cat]);
    }
    const passiveTyping = { durationMs: tKey, keystrokes };

    // 3. Evening Voice Reflection (Mundt/Cummins realistic 15–20% healthy pauses vs 30–37% slowed pauses)
    // Include 1 realistic noisy-environment low_confidence recording (~17.5 dB SNR) at back === 5
    const voiceDurMs = Math.round(35000 + rand() * 6000);
    const nAudioFrames = Math.round(voiceDurMs / 100);
    const noiseDb = back === 5 ? -39.5 : -53.5 + rand() * 2;

    // Build alternating speech phrases and natural breath/cognitive pauses between 1.3s and (dur - 1.3s)
    const pauseIntervals = [];
    let cursorSec = 1.3 + (2.8 - slowness * 1.1 + rand() * 0.9);
    const endSpeechSec = voiceDurMs / 1000 - 1.3;
    let insertedLong = false;
    while (cursorSec < endSpeechSec - 1.4) {
      // Slowed speech has frequent >= 1.0s hesitations; ~60% of healthy baseline evenings have 1 brief ~1.1s reflective pause
      let pDur;
      if (slowness > 0.45 && rand() < 0.48) {
        pDur = 1.08 + slowness * 0.68 + rand() * 0.35;
      } else if (!insertedLong && rand() < 0.58) {
        pDur = 1.05 + rand() * 0.24;
        insertedLong = true;
      } else {
        pDur = 0.32 + slowness * 0.36 + rand() * 0.28;
      }
      const pEnd = Math.min(endSpeechSec - 0.8, cursorSec + pDur);
      if (pEnd - cursorSec >= 0.26) pauseIntervals.push([cursorSec, pEnd]);
      const nextPhrase = Math.max(1.35, 3.1 - slowness * 1.45 + (rand() - 0.3) * 1.2);
      cursorSec = pEnd + nextPhrase;
    }

    const metering = Array.from({ length: nAudioFrames }, (_, k) => {
      const t = k * 100;
      const sec = t / 1000;
      const inMargin = sec < 1.3 || sec > endSpeechSec;
      const inPause = inMargin || pauseIntervals.some(([a, b]) => sec >= a && sec <= b);
      const speechDb = -22 + (3.8 - slowness * 1.6) * Math.sin(k * 0.45 + back) + gauss() * 1.1;
      return [t, +(inPause ? noiseDb + gauss() * 0.6 : speechDb).toFixed(1)];
    });
    const answer = { type: 'audio', durationMs: voiceDurMs, metering };

    // 4. Subjective Gemini Day Line Score (correlated with health + realistic daily life variance)
    const score = +clip(3.15 + health * 4.85 + gauss() * 0.48, 1.5, 9.4).toFixed(1);
    const rationale =
      score < 4.5
        ? 'Heavy morning and afternoon trajectory with limited lift before bedtime.'
        : score < 6.4
          ? 'Moderate day overall; dipped mid-afternoon before steadying in the evening.'
          : 'Steady, light trajectory holding above neutral from late morning into night.';

    out.push({
      id: `demo-${date}`,
      date,
      sample: true,
      startedAt: d.toISOString(),
      finishedAt: new Date(d.getTime() + durationMs).toISOString(),
      passiveTyping,
      answer,
      dayScore: {
        score,
        rationale,
        model: 'demo',
        scoredAt: d.toISOString(),
      },
      line: {
        points,
        motion,
        durationMs,
        attempts: slowness > 0.7 && rand() < 0.5 ? 2 : 1,
        fingerLifts: hasFingerLift ? 1 : 0,
        canvas: { w: 320, h: 240, dpPerMm: DP_PER_MM },
      },
    });
  }
  return out;
}

/** Build per-day sign-aligned z-scores, clinical domains, and 0..10 Objective/Subjective indices. */
function analyzeForSpecialist(entries) {
  const sorted = [...entries].filter((e) => e?.date).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = buildWeeklyAnalysis(sorted);

  const daily = sorted.map((e, idx) => {
    const draw = analyzeDrawing(e.line);
    const typSource = e.answer?.type === 'text' ? e : e.passiveTyping ? { ...e, answer: { type: 'text', typing: e.passiveTyping } } : e;
    const typ = analyzeTypingEntry(typSource);
    const voi = analyzeVoiceEntry(e);
    return {
      entry: e,
      date: e.date,
      isPractice: idx < 5,
      draw,
      typ: typ && !typ.dropped ? typ : null,
      voi: voi && voi.hasMetering ? voi : null,
      subjectiveScore: typeof e.dayScore?.score === 'number' ? e.dayScore.score : null,
      rationale: e.dayScore?.rationale || '',
      meanMood: e.line?.points?.length ? meanMood(e.line.points) : null,
    };
  });

  // Personal Baseline: exclude first 5 practice sessions, calibrate on the next 10 sessions
  const afterPractice = daily.slice(5);
  const baselineReady = afterPractice.length >= 10;
  const baselineWindow = afterPractice.slice(0, 10);

  // All features sign-aligned so positive z = faster / smoother / lighter (green) and negative z = slower / heavier (red)
  const featureDefs = [
    { key: 'drawingSpeed', get: (d) => d.draw?.meanSpeed, dir: 1 },
    { key: 'drawingPause', get: (d) => d.draw?.totalPauseTimeMs, dir: -1 },
    { key: 'drawingJerk', get: (d) => d.draw?.normalizedJerk, dir: -1 },
    { key: 'drawingCV', get: (d) => d.draw?.speedCV, dir: -1 },
    { key: 'ikdMedian', get: (d) => d.typ?.medianIkdMs, dir: -1 },
    { key: 'ikdMad', get: (d) => d.typ?.ikdMadMs, dir: -1 },
    { key: 'backspaceRate', get: (d) => d.typ?.backspaceRate, dir: -1 },
    { key: 'voicePause', get: (d) => (d.voi?.quality?.status !== 'rejected' ? d.voi?.pauseRatio : null), dir: -1 },
    { key: 'voiceLongPause', get: (d) => (d.voi?.quality?.status !== 'rejected' ? d.voi?.longPausesPerMin : null), dir: -1 },
    { key: 'dayScoreZ', get: (d) => d.subjectiveScore, dir: 1 },
  ];

  const baseStats = {};
  if (baselineReady) {
    for (const f of featureDefs) {
      const vals = baselineWindow.map(f.get).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (vals.length < 3) continue;
      const med = median(vals);
      const devs = vals.map((v) => Math.abs(v - med));
      const s = 1.4826 * (median(devs) || 0);
      baseStats[f.key] = { med, s: s > 1e-9 ? s : null, n: vals.length };
    }
  }

  const enriched = daily.map((d) => {
    const alignedZ = {};
    if (baselineReady && !d.isPractice) {
      for (const f of featureDefs) {
        const v = f.get(d);
        const st = baseStats[f.key];
        if (typeof v !== 'number' || !st || !st.s) {
          alignedZ[f.key] = null;
          continue;
        }
        const z = normalizeFeature(v, st, { signed: true });
        alignedZ[f.key] = f.dir === -1 ? -z : z;
      }
    }

    const avgDomain = (keys) => {
      const vals = keys.map((k) => alignedZ[k]).filter((v) => typeof v === 'number');
      return vals.length ? median(vals) : null;
    };

    const tempoFluency = avgDomain(['drawingSpeed', 'drawingPause', 'ikdMedian', 'voicePause', 'voiceLongPause']);
    const regularityEffort = avgDomain(['drawingJerk', 'drawingCV', 'ikdMad', 'backspaceRate']);
    const rhythmPerceived = avgDomain(['dayScoreZ']);

    const objDomains = [tempoFluency, regularityEffort].filter((v) => v !== null);
    const zObj = objDomains.length ? mean(objDomains) : null;
    const objectiveIndex = zObj !== null ? clip(5 + zObj, 0, 10) : null;

    return {
      ...d,
      alignedZ,
      domains: { tempoFluency, regularityEffort, rhythmPerceived },
      objectiveIndex,
    };
  });

  return { weekly, baselineReady, days: enriched };
}

function computeTrendDelta(vals) {
  if (vals.length < 2) return 0;
  const half = Math.max(1, Math.floor(vals.length / 2));
  const early = median(vals.slice(0, half));
  const recent = median(vals.slice(-half));
  return recent - early;
}

function updateStatusBanner({ baselineReady, totalDays, summaryLabel, objMed, subMed, objVals, subVals }) {
  const banner = document.getElementById('statusBanner');
  const headline = document.getElementById('statusHeadline');
  const detail = document.getElementById('statusDetail');

  if (!totalDays) {
    banner.className = 'status-banner amber';
    headline.textContent = 'No recorded days loaded';
    detail.textContent = 'Drop an exported sweetdreams-entries.json file anywhere or click Load Recovery Demo.';
    return;
  }

  if (!baselineReady) {
    const postPrac = Math.max(0, totalDays - 5);
    banner.className = 'status-banner amber';
    headline.textContent = `Calibrating personal baseline (${postPrac}/10 post-practice days collected)`;
    detail.textContent =
      subMed !== null
        ? `Raw modality trends and Perceived Mood (${subMed.toFixed(1)}/10) are active; personalized z-scores unlock after 5 practice + 10 baseline days.`
        : 'Raw drawing, typing, and voice trends are active; personalized z-scores unlock after 5 practice + 10 baseline days.';
    return;
  }

  const gap = objMed !== null && subMed !== null ? subMed - objMed : 0;
  const recentObj = objVals.length ? median(objVals.slice(-Math.min(4, objVals.length))) : objMed;
  const recentSub = subVals.length ? median(subVals.slice(-Math.min(4, subVals.length))) : subMed;
  const motorSlow = recentObj !== null && recentObj < 4.0;
  const moodHeavy = recentSub !== null && recentSub < 4.0;
  const largeGap = Math.abs(gap) >= 2.2;
  const objTrend = computeTrendDelta(objVals);
  const subTrend = computeTrendDelta(subVals);
  const isImproving = objTrend >= 0.45 || (objMed !== null && objMed > 5.6);

  if (motorSlow && moodHeavy) {
    banner.className = 'status-banner warn';
    headline.textContent = `Clinical attention (${summaryLabel}): Both motor behavior and perceived mood are below baseline`;
    detail.textContent = `Recent Motor Behavior ${recentObj.toFixed(1)}/10 · Perceived Mood ${recentSub.toFixed(1)}/10 (personal baseline is 4.0–6.0).`;
  } else if (motorSlow) {
    banner.className = 'status-banner warn';
    headline.textContent = `Motor slowing detected (${summaryLabel})${largeGap ? ' — Perceived mood remains higher than motor speed' : ''}`;
    detail.textContent = `Recent Motor Behavior is ${recentObj.toFixed(1)}/10 while Perceived Mood is ${
      recentSub !== null ? `${recentSub.toFixed(1)}/10` : 'unscored'
    }.`;
  } else if (moodHeavy) {
    banner.className = 'status-banner warn';
    headline.textContent = `Low perceived mood (${summaryLabel})${largeGap ? ' — Objective motor speed remains steady' : ''}`;
    detail.textContent = `Recent Perceived Mood is ${recentSub.toFixed(1)}/10 while Motor Behavior is ${
      recentObj !== null ? `${recentObj.toFixed(1)}/10` : 'pending'
    }.`;
  } else if (isImproving) {
    banner.className = 'status-banner';
    const trendNote = objTrend >= 0.45 ? ` (+${objTrend.toFixed(1)} motor pts across window)` : '';
    headline.textContent = `Positive recovery trend (${summaryLabel}) — Motor fluency & daily mood back in healthy range${trendNote}`;
    detail.textContent = `Recent Motor Behavior ${recentObj !== null ? `${recentObj.toFixed(1)}/10` : '—'} (5.0 = personal remission baseline) · Perceived Mood ${
      recentSub !== null ? `${recentSub.toFixed(1)}/10` : '—'
    }.`;
  } else if (largeGap) {
    banner.className = 'status-banner amber';
    headline.textContent = `Mood–Motor divergence noted (${summaryLabel})`;
    detail.textContent =
      gap > 0
        ? `Perceived Mood (${subMed.toFixed(1)}/10) is ${gap.toFixed(1)} pts higher than Motor Behavior (${objMed.toFixed(1)}/10).`
        : `Perceived Mood (${subMed.toFixed(1)}/10) is ${Math.abs(gap).toFixed(1)} pts lower than Motor Behavior (${objMed.toFixed(1)}/10).`;
  } else {
    banner.className = 'status-banner';
    headline.textContent = `Steady in remission (${summaryLabel}) — Motor behavior and perceived mood match personal baseline`;
    detail.textContent = `Motor Behavior ${objMed !== null ? `${objMed.toFixed(1)}/10` : '—'} · Perceived Mood ${
      subMed !== null ? `${subMed.toFixed(1)}/10` : '—'
    } · Within healthy personal range.`;
  }
}

function syncTimeframeButtons() {
  document.querySelectorAll('#timeframeGroup .tf-btn').forEach((btn) => {
    const n = Number(btn.dataset.days);
    btn.classList.toggle('active', selectedTimeframeDays === n);
  });
}

function sliceByCalendarDays(days, windowDays) {
  if (!days.length) return [];
  const latest = keyToDate(days[days.length - 1].date);
  latest.setDate(latest.getDate() - (windowDays - 1));
  const cutoff = dayKey(latest);
  return days.filter((d) => d.date >= cutoff);
}

function renderDashboard() {
  const { weekly, baselineReady, days } = analyzeForSpecialist(rawEntries);

  // Populate calendar-week selector alongside the 3d / 7d / 14d / 21d buttons
  const weekSel = document.getElementById('weekSelect');
  const prevWeek = selectedWeek;
  weekSel.innerHTML = '';

  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = selectedTimeframeDays ? `Window: Last ${selectedTimeframeDays} days` : 'Calendar week…';
  weekSel.appendChild(customOpt);

  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = `Full history (${days.length} evenings)`;
  weekSel.appendChild(allOpt);

  weekly.weeks.forEach((w) => {
    const opt = document.createElement('option');
    opt.value = w.weekKey;
    opt.textContent = `${w.label} (${w.entries.length}d)`;
    weekSel.appendChild(opt);
  });

  if (selectedTimeframeDays !== null) {
    weekSel.value = 'custom';
    selectedWeek = 'custom';
  } else {
    const validValues = Array.from(weekSel.options).map((o) => o.value);
    weekSel.value = validValues.includes(prevWeek) && prevWeek !== 'custom' ? prevWeek : 'all';
    selectedWeek = weekSel.value;
  }
  syncTimeframeButtons();

  const visibleDays =
    selectedTimeframeDays !== null
      ? sliceByCalendarDays(days, selectedTimeframeDays)
      : selectedWeek === 'all'
        ? days
        : days.filter((d) => {
            const wk = weekly.weeks.find((w) => w.weekKey === selectedWeek);
            return wk && d.date >= wk.startKey && d.date <= wk.endKey;
          });

  const summaryDays = visibleDays;
  const summaryLabel =
    selectedTimeframeDays !== null
      ? `Last ${selectedTimeframeDays}d (${visibleDays.length} evenings)`
      : selectedWeek === 'all'
        ? `Full history (${visibleDays.length} evenings)`
        : weekSel.options[weekSel.selectedIndex]?.textContent.replace(/\s*\(\d+d\)$/, '') || 'Selected week';

  if (!selectedDate || !visibleDays.some((d) => d.date === selectedDate)) {
    selectedDate = visibleDays[visibleDays.length - 1]?.date || null;
  }

  // Baseline badge
  const baseBadge = document.getElementById('baselineBadge');
  baseBadge.textContent = baselineReady
    ? `Baseline active · Viewing ${summaryLabel}`
    : `Baseline calibrating (${Math.max(0, days.length - 5)}/10 post-practice days)`;
  baseBadge.className = `pill ${baselineReady ? 'pill-ok' : 'pill-info'}`;

  // Top KPIs (computed over the active timeframe)
  const objVals = summaryDays.map((d) => d.objectiveIndex).filter((v) => typeof v === 'number');
  const subVals = summaryDays.map((d) => d.subjectiveScore).filter((v) => typeof v === 'number');
  const objMed = objVals.length ? median(objVals) : null;
  const subMed = subVals.length ? median(subVals) : null;

  updateStatusBanner({ baselineReady, totalDays: days.length, summaryLabel, objMed, subMed, objVals, subVals });

  const setGauge = (dotId, pct, color) => {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    if (pct === null) {
      dot.style.display = 'none';
      return;
    }
    dot.style.display = 'block';
    dot.style.left = `${clip(pct, 0, 100)}%`;
    dot.style.background = color;
  };

  const objEl = document.getElementById('kpiObjective');
  const objPill = document.getElementById('kpiObjPill');
  objEl.textContent = objMed !== null ? objMed.toFixed(1) : '—';
  if (objMed === null) {
    objEl.style.color = 'var(--text)';
    objPill.textContent = 'Pre-baseline';
    objPill.className = 'pill';
    setGauge('kpiObjDot', null);
  } else if (objMed < 4) {
    objEl.style.color = 'var(--pink)';
    objPill.textContent = 'Slowed';
    objPill.className = 'pill pill-warn';
    setGauge('kpiObjDot', objMed * 10, 'var(--pink)');
  } else if (objMed > 6) {
    objEl.style.color = 'var(--blue)';
    objPill.textContent = 'Improving / Fast';
    objPill.className = 'pill pill-ok';
    setGauge('kpiObjDot', objMed * 10, 'var(--blue)');
  } else {
    objEl.style.color = 'var(--lilac-pale)';
    objPill.textContent = 'Normal';
    objPill.className = 'pill pill-info';
    setGauge('kpiObjDot', objMed * 10, 'var(--lilac)');
  }

  const subEl = document.getElementById('kpiSubjective');
  const subPill = document.getElementById('kpiSubPill');
  subEl.textContent = subMed !== null ? subMed.toFixed(1) : '—';
  if (subMed === null) {
    subEl.style.color = 'var(--text)';
    subPill.textContent = 'Unscored';
    subPill.className = 'pill';
    setGauge('kpiSubDot', null);
  } else if (subMed < 4) {
    subEl.style.color = 'var(--pink)';
    subPill.textContent = 'Heavy';
    subPill.className = 'pill pill-warn';
    setGauge('kpiSubDot', subMed * 10, 'var(--pink)');
  } else if (subMed >= 6.5) {
    subEl.style.color = 'var(--blue)';
    subPill.textContent = 'Light';
    subPill.className = 'pill pill-ok';
    setGauge('kpiSubDot', subMed * 10, 'var(--blue)');
  } else {
    subEl.style.color = 'var(--lilac-pale)';
    subPill.textContent = 'Moderate';
    subPill.className = 'pill pill-info';
    setGauge('kpiSubDot', subMed * 10, 'var(--lilac)');
  }

  const divEl = document.getElementById('kpiDivergence');
  const divPill = document.getElementById('kpiDivPill');
  if (objMed !== null && subMed !== null) {
    const diff = subMed - objMed;
    divEl.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
    const divergent = Math.abs(diff) >= 1.5;
    divEl.style.color = divergent ? 'var(--pink)' : 'var(--blue)';
    divPill.textContent = divergent ? (diff > 0 ? 'Motor slower' : 'Mood heavier') : 'Aligned';
    divPill.className = `pill ${divergent ? 'pill-warn' : 'pill-ok'}`;
    setGauge('kpiDivDot', ((clip(diff, -5, 5) + 5) / 10) * 100, divergent ? 'var(--pink)' : 'var(--blue)');
  } else {
    divEl.textContent = '—';
    divEl.style.color = 'var(--text)';
    divPill.textContent = 'Pending';
    divPill.className = 'pill';
    setGauge('kpiDivDot', null);
  }

  const validDraw = visibleDays.filter((d) => d.draw?.quality?.valid).length;
  const lowConfTyp = visibleDays.filter((d) => d.typ?.lowConfidence).length;
  const rejVoice = visibleDays.filter((d) => d.voi?.quality?.status === 'rejected').length;
  const lowConfVoice = visibleDays.filter((d) => d.voi?.quality?.status === 'low_confidence').length;
  const lowTotal = lowConfTyp + lowConfVoice;
  const totalChecks = Math.max(1, validDraw + lowTotal + rejVoice);
  document.getElementById('kpiQuality').textContent = `${visibleDays.length}`;
  document.getElementById('qcValid').style.width = `${(validDraw / totalChecks) * 100}%`;
  document.getElementById('qcLow').style.width = `${(lowTotal / totalChecks) * 100}%`;
  document.getElementById('qcRej').style.width = `${(rejVoice / totalChecks) * 100}%`;
  document.getElementById('kpiQualitySub').innerHTML =
    `<span>Valid (${validDraw})</span><span>Low-conf (${lowTotal})</span><span>Rejected (${rejVoice})</span>`;
  const qcPill = document.getElementById('kpiQcPill');
  const hasIssues = lowTotal > 0 || rejVoice > 0;
  qcPill.textContent = hasIssues ? 'Review QC' : 'Clean QC';
  qcPill.className = `pill ${hasIssues ? 'pill-amber' : 'pill-ok'}`;

  // Modality Hero Numbers + Directional Delta Pills (compares latest value vs start of active timeframe or baseline)
  const setModalityCard = (heroId, pillId, vals, baseMed, unitLabel, unitShort, higherIsBetter) => {
    const heroEl = document.getElementById(heroId);
    const pillEl = document.getElementById(pillId);
    if (!heroEl || !pillEl) return;

    if (!vals.length) {
      heroEl.innerHTML = `<span class="mod-num">—</span><span class="mod-unit">${unitLabel}</span>`;
      pillEl.textContent = 'No data';
      pillEl.className = 'pill';
      return;
    }

    const last = vals[vals.length - 1];
    heroEl.innerHTML = `<span class="mod-num">${last.toFixed(1)}</span><span class="mod-unit">${unitLabel}</span>`;

    const ref = typeof baseMed === 'number' && baseMed > 0 ? baseMed : vals.length >= 2 ? vals[0] : null;
    if (ref === null || ref <= 0) {
      pillEl.textContent = `${vals.length} session`;
      pillEl.className = 'pill pill-info';
      return;
    }

    const pct = ((last - ref) / ref) * 100;
    const absPct = Math.round(Math.abs(pct));
    if (absPct < 8) {
      pillEl.textContent = `Steady (ref ${ref.toFixed(0)} ${unitShort})`;
      pillEl.className = 'pill pill-info';
    } else {
      const isBetter = higherIsBetter ? pct > 0 : pct < 0;
      const arrow = pct > 0 ? '↑' : '↓';
      const word = higherIsBetter ? (pct > 0 ? 'faster' : 'slower') : pct > 0 ? 'slower' : 'faster';
      pillEl.textContent = `${arrow} ${absPct}% ${word} vs base`;
      pillEl.className = `pill ${isBetter ? 'pill-ok' : 'pill-warn'}`;
    }
  };

  const baseDays = days.slice(5, 15);
  const baseMedFor = (fn) => {
    const bVals = baseDays.map(fn).filter((v) => typeof v === 'number');
    return bVals.length >= 3 ? median(bVals) : null;
  };

  setModalityCard(
    'drawHero',
    'drawDelta',
    visibleDays.map((d) => d.draw?.meanSpeed).filter((v) => typeof v === 'number'),
    baseMedFor((d) => d.draw?.meanSpeed),
    'mm/s latest · higher = faster',
    'mm/s',
    true
  );
  setModalityCard(
    'typingHero',
    'typingDelta',
    visibleDays.map((d) => d.typ?.medianIkdMs).filter((v) => typeof v === 'number'),
    baseMedFor((d) => d.typ?.medianIkdMs),
    'ms delay · lower = faster',
    'ms',
    false
  );
  setModalityCard(
    'voiceHero',
    'voiceDelta',
    visibleDays.map((d) => (d.voi ? d.voi.pauseRatio * 100 : null)).filter((v) => typeof v === 'number'),
    baseMedFor((d) => (d.voi ? d.voi.pauseRatio * 100 : null)),
    '% silent · lower = more fluent',
    '%',
    false
  );

  // Diverging Clinical Domain Bars (over summaryDays)
  const avgDom = (key) => {
    const vals = summaryDays.map((d) => d.domains[key]).filter((v) => typeof v === 'number');
    return vals.length ? median(vals) : null;
  };
  renderDomainBars(document.getElementById('domainBars'), [
    {
      label: 'Motor & Speech Speed',
      z: avgDom('tempoFluency'),
      lowLabel: 'Slower / More pauses',
      highLabel: 'Faster / More fluent',
    },
    {
      label: 'Movement & Typing Smoothness',
      z: avgDom('regularityEffort'),
      lowLabel: 'Hesitant / Irregular',
      highLabel: 'Smooth / Steady',
    },
    {
      label: 'Perceived Daily Mood',
      z: avgDom('rhythmPerceived'),
      lowLabel: 'Heavier than usual',
      highLabel: 'Lighter than usual',
    },
  ]);

  const renderInteractiveViews = () => {
    const onSelect = (date) => {
      selectedDate = date;
      renderInteractiveViews();
    };

    renderDualLineChart(document.getElementById('dualChart'), visibleDays, onSelect, selectedDate);
    renderZHeatmap(document.getElementById('heatmapChart'), visibleDays, HEATMAP_FEATURES, onSelect, selectedDate);

    renderModalityTrend(document.getElementById('drawChart'), visibleDays, {
      valueFn: (d) => d.draw?.meanSpeed,
      unit: 'mm/s',
      color: '#d4bbff',
      onSelectDay: onSelect,
      selectedDate,
    });
    renderModalityTrend(document.getElementById('typingChart'), visibleDays, {
      valueFn: (d) => d.typ?.medianIkdMs,
      unit: 'ms',
      color: '#cde5ff',
      onSelectDay: onSelect,
      selectedDate,
    });
    renderModalityTrend(document.getElementById('voiceChart'), visibleDays, {
      valueFn: (d) => (d.voi ? d.voi.pauseRatio * 100 : null),
      unit: '%',
      color: '#f1b5d7',
      onSelectDay: onSelect,
      selectedDate,
    });

    renderInspector(visibleDays, onSelect);
  };

  renderInteractiveViews();
}

function renderInspector(visibleDays, onSelect) {
  const listEl = document.getElementById('dayChips');
  listEl.innerHTML = '';
  visibleDays.forEach((d) => {
    const btn = document.createElement('button');
    btn.className = `day-chip ${d.date === selectedDate ? 'active' : ''}`;
    const slowFlag = d.objectiveIndex !== null && d.objectiveIndex < 4;
    const fastFlag = d.objectiveIndex !== null && d.objectiveIndex > 6;
    const dot = slowFlag || fastFlag ? ' ●' : '';
    btn.textContent = `${d.date.slice(5)}${dot}`;
    if (d.date !== selectedDate) {
      if (slowFlag) btn.style.color = 'var(--pink)';
      else if (fastFlag) btn.style.color = 'var(--blue)';
    }
    btn.addEventListener('click', () => onSelect(d.date));
    listEl.appendChild(btn);
  });

  const day = visibleDays.find((d) => d.date === selectedDate);
  const badgeEl = document.getElementById('selectedDayBadge');
  const tableEl = document.getElementById('inspectorTable');
  const ratEl = document.getElementById('inspectorRationale');
  if (!day) {
    if (badgeEl) badgeEl.textContent = 'No evening selected';
    renderDayLineSvg(document.getElementById('dayLineSvg'), null);
    tableEl.innerHTML = '';
    ratEl.textContent = 'Select an evening to inspect.';
    return;
  }

  if (badgeEl) {
    badgeEl.textContent = `${day.date}${day.isPractice ? ' · Practice evening' : ''}`;
  }
  renderDayLineSvg(document.getElementById('dayLineSvg'), day.entry.line, visibleDays, selectedDate);
  ratEl.textContent = day.rationale || 'No Gemini rationale recorded for this evening.';

  const rows = [
    ['Recorded Date', `${day.date}${day.isPractice ? ' (Practice 1–5)' : ''}`],
    ['Motor Behavior (Objective)', day.objectiveIndex !== null ? `${day.objectiveIndex.toFixed(1)} / 10` : 'Pre-baseline'],
    ['Perceived Mood (Gemini)', day.subjectiveScore !== null ? `${day.subjectiveScore.toFixed(1)} / 10` : '—'],
    [
      'Drawing Speed & Pauses',
      day.draw ? `${day.draw.meanSpeed.toFixed(1)} mm/s · ${Math.round(day.draw.totalPauseTimeMs)} ms paused` : '—',
    ],
    ['Drawing Finger Lifts', day.draw ? `${day.draw.fingerLifts}` : '—'],
    [
      'Typing Delay & Rhythm',
      day.typ ? `${Math.round(day.typ.medianIkdMs)} ms median · ±${Math.round(day.typ.ikdMadMs)} ms spread` : 'Not recorded',
    ],
    [
      'Voice Pauses & Audio SNR',
      day.voi
        ? `${(day.voi.pauseRatio * 100).toFixed(1)}% silent · ${day.voi.snrDb.toFixed(1)} dB (${day.voi.quality.status})`
        : 'Not recorded',
    ],
  ];
  tableEl.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function loadJsonPayload(text) {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null;
  if (!arr) throw new Error('Expected a JSON array of entries or { entries: [...] }.');
  rawEntries = arr;
  selectedTimeframeDays = 21;
  selectedWeek = 'custom';
  selectedDate = null;
  renderDashboard();
}

// Wire up 3d / 7d / 14d / 21d timeframe buttons
document.querySelectorAll('#timeframeGroup .tf-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedTimeframeDays = Number(btn.dataset.days);
    selectedWeek = 'custom';
    renderDashboard();
  });
});

document.getElementById('demoBtn').addEventListener('click', () => {
  rawEntries = buildDemoEntries();
  selectedTimeframeDays = 21;
  selectedWeek = 'custom';
  selectedDate = null;
  renderDashboard();
});

document.getElementById('weekSelect').addEventListener('change', (e) => {
  if (e.target.value === 'custom') return;
  selectedTimeframeDays = null;
  selectedWeek = e.target.value;
  renderDashboard();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    loadJsonPayload(await file.text());
  } catch (err) {
    alert(`Could not load JSON: ${err.message}`);
  }
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth += 1;
  document.body.classList.add('dragover');
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragover');
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  try {
    loadJsonPayload(await file.text());
  } catch (err) {
    alert(`Could not load JSON: ${err.message}`);
  }
});

// Auto-load from localStorage if opened on the same web origin; otherwise start with recovery demo data.
try {
  const stored = localStorage.getItem('sweetdreams.entries.v1');
  rawEntries = stored ? JSON.parse(stored) : buildDemoEntries();
} catch {
  rawEntries = buildDemoEntries();
}
renderDashboard();

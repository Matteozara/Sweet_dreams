import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path } from 'react-native-svg';
import { Card, Header } from '../components/Chrome';
import { GhostButton } from '../components/Buttons';
import { GlowLine, LineGradient } from '../components/LineArt';
import { dayKey, keyToDate, meanMood, smoothPath, streak, toPixels } from '../line';
import { dayScoreAvailable } from '../analysis/dayScore';
import { buildWeeklyAnalysis } from '../analysis/weekly';
import { card, colors, font, radius, type } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const fmtNum = (v, digits = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—');
const fmtSec = (ms, digits = 1) => (typeof ms === 'number' && Number.isFinite(ms) ? `${(ms / 1000).toFixed(digits)} s` : '—');
const fmtMs = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? `${Math.round(ms)} ms` : '—');
const fmtPct = (ratio) => (typeof ratio === 'number' && Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—');
const fmtZ = (z, abs = false) => {
  if (typeof z !== 'number' || !Number.isFinite(z)) return '—';
  if (abs) return `|z| ${z.toFixed(2)}`;
  return `${z >= 0 ? '+' : ''}${z.toFixed(2)} z`;
};

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** Every line on one canvas: the oldest faintest, tonight in full light. */
function Overlay({ entries }) {
  const [w, onLayout] = useWidth();
  const h = 180;
  const shown = entries.slice(-30);
  const older = shown.slice(0, -1);
  const latest = toPixels(shown[shown.length - 1].line.points, w, h, { pad: 10 });
  return (
    <View style={styles.plot} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LineGradient x2={w} />
          </Defs>
          <Line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke={colors.muted} strokeOpacity={0.14} strokeDasharray="3 6" />
          {older.map((e, i) => (
            <Path
              key={e.id}
              d={smoothPath(toPixels(e.line.points, w, h, { pad: 10 }))}
              stroke={colors.lilac}
              strokeOpacity={0.1 + 0.4 * ((i + 1) / older.length)}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          <GlowLine d={smoothPath(latest)} end={latest[latest.length - 1]} width={3} />
        </Svg>
      )}
      <View style={styles.axisRow}>
        <Text style={styles.axis}>Morning</Text>
        <Text style={styles.axis}>Night</Text>
      </View>
    </View>
  );
}

/** Selected week's lines joined end to end. */
function Week({ entries }) {
  const [w, onLayout] = useWidth();
  const h = 140;
  const days = entries.slice(-7);
  const inset = 14;
  const col = (w - inset * 2) / days.length;
  const today = dayKey();
  const joined = days.flatMap((e, i) => toPixels(e.line.points, col, h, { x0: inset + i * col, pad: 12 }));
  return (
    <View style={styles.plot} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LineGradient x2={w} />
          </Defs>
          {days.slice(1).map((e, i) => (
            <Line
              key={e.id}
              x1={inset + (i + 1) * col}
              x2={inset + (i + 1) * col}
              y1={6}
              y2={h - 6}
              stroke={colors.muted}
              strokeOpacity={0.12}
              strokeDasharray="2 5"
            />
          ))}
          <GlowLine d={smoothPath(joined)} end={joined[joined.length - 1]} width={2.5} />
          {days.slice(0, -1).map((e, i) => {
            const mood = meanMood(e.line.points);
            return (
              <Circle
                key={e.id}
                cx={inset + (i + 0.5) * col}
                cy={12 + ((1 - mood) / 2) * (h - 24)}
                r={3.5}
                fill={colors.low}
                stroke={i < days.length / 2 ? colors.pink : colors.lilac}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>
      )}
      <View style={styles.dayRow}>
        {days.map((e) => {
          const now = e.date === today;
          return (
            <Text key={e.id} style={[styles.day, now && styles.dayNow]}>
              {now ? 'Now' : WEEKDAYS[keyToDate(e.date).getDay()]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function Stat({ label, value, unit }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </Card>
  );
}

function Badge({ text, tone = 'neutral' }) {
  const bg =
    tone === 'ok'
      ? 'rgba(205,229,255,0.14)'
      : tone === 'warn'
      ? 'rgba(241,181,215,0.16)'
      : 'rgba(255,255,255,0.08)';
  const fg = tone === 'ok' ? colors.blue : tone === 'warn' ? colors.pink : colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

function MetricRow({ label, value, z }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRight}>
        {z !== undefined && z !== null && <Text style={styles.metricZ}>{z}</Text>}
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

/** One evening per row: the 0–10 score and written analysis saved under `field`. Hidden when the week has none. */
function StateCard({ title, field, entries, empty, note }) {
  const shown = entries.filter((e) => e[field]?.analysis);
  if (shown.length === 0) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Badge text={`${shown.length} ${shown.length === 1 ? 'evening' : 'evenings'}`} />
      </View>
      {shown.map((e) => (
        <View key={e.id} style={styles.state}>
          <View style={styles.stateHead}>
            <Text style={styles.metricLabel}>
              {keyToDate(e.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={styles.metricValue}>{e[field].score === null ? empty : `${e[field].score} / 10`}</Text>
          </View>
          <Text style={styles.stateText}>{e[field].analysis}</Text>
        </View>
      ))}
      <Text style={styles.note}>{note}</Text>
    </Card>
  );
}

export default function AnalysisScreen({ entries, onLoadSample, onScoreEntries, onDeleteAll, onSettings }) {
  const drawn = useMemo(() => entries.filter((e) => e.line?.points?.length > 1), [entries]);
  const run = streak(drawn);
  const canSample = __DEV__ && onLoadSample && !entries.some((e) => e.sample);

  const { weeks, baseline } = useMemo(() => buildWeeklyAnalysis(drawn), [drawn]);
  const [weekIdx, setWeekIdx] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState(null);

  // Default to the most recent week whenever the week list changes.
  useEffect(() => {
    if (weeks.length > 0) setWeekIdx(weeks.length - 1);
  }, [weeks.length]);

  const activeWeek = weeks[Math.min(weekIdx, Math.max(0, weeks.length - 1))] || null;
  const unscoredInWeek = activeWeek ? activeWeek.entries.filter((e) => typeof e.dayScore?.score !== 'number') : [];

  const handleScoreMissing = async () => {
    if (!onScoreEntries || unscoredInWeek.length === 0 || scoring) return;
    setScoring(true);
    setScoreError(null);
    try {
      const err = await onScoreEntries(unscoredInWeek);
      if (err) setScoreError(err);
    } finally {
      setScoring(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete my data',
      'This will permanently remove all locally stored entries and your profile from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteAll && onDeleteAll() },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
      {drawn.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.display, styles.center]}>Your lines</Text>
          <Text style={[type.bodySm, styles.center]}>They gather here, one evening at a time.</Text>
          {canSample && <GhostButton title="Load sample weeks" onPress={onLoadSample} style={{ marginTop: 24 }} />}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <Text style={[type.display, styles.center]}>Weekly analysis</Text>
            <Text style={[type.bodySm, styles.center]}>
              Pipeline v{baseline.pipelineVersion} · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'} logged
            </Text>
          </View>

          {activeWeek && (
            <Card style={styles.weekBar}>
              <Pressable
                onPress={() => setWeekIdx((i) => Math.max(0, i - 1))}
                disabled={weekIdx === 0}
                hitSlop={12}
                style={[styles.weekBtn, weekIdx === 0 && styles.weekBtnDisabled]}
                accessibilityLabel="Previous week"
              >
                <Text style={styles.weekBtnText}>‹</Text>
              </Pressable>
              <View style={styles.weekCenter}>
                <Text style={styles.weekTitle}>{activeWeek.label}</Text>
                <Text style={styles.weekSub}>
                  {activeWeek.entries.length}/7 evenings · Week {weekIdx + 1} of {weeks.length}
                </Text>
              </View>
              <Pressable
                onPress={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
                disabled={weekIdx >= weeks.length - 1}
                hitSlop={12}
                style={[styles.weekBtn, weekIdx >= weeks.length - 1 && styles.weekBtnDisabled]}
                accessibilityLabel="Next week"
              >
                <Text style={styles.weekBtnText}>›</Text>
              </Pressable>
            </Card>
          )}

          {activeWeek && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>This week, end to end</Text>
                <Badge text={`${activeWeek.entries.length} days`} />
              </View>
              <Week entries={activeWeek.entries} />
            </Card>
          )}

          {activeWeek && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Overall day score (Gemini)</Text>
                {activeWeek.dayScore ? (
                  <Badge text={`Mean ${fmtNum(activeWeek.dayScore.meanScore, 1)} / 10`} tone="ok" />
                ) : (
                  <Badge text={dayScoreAvailable ? 'Not scored' : 'API key unset'} />
                )}
              </View>
              {activeWeek.dayScore ? (
                <View style={styles.metrics}>
                  <MetricRow
                    label={`Weekly mean (${activeWeek.dayScore.count} ${activeWeek.dayScore.count === 1 ? 'day' : 'days'})`}
                    value={`${fmtNum(activeWeek.dayScore.meanScore, 1)} / 10`}
                  />
                  <MetricRow
                    label={`Weekly median (${activeWeek.dayScore.count} ${activeWeek.dayScore.count === 1 ? 'day' : 'days'})`}
                    value={`${fmtNum(activeWeek.dayScore.medianScore, 1)} / 10`}
                  />
                  <MetricRow
                    label="Latest day score"
                    value={`${fmtNum(activeWeek.dayScore.latest.score, 1)} / 10`}
                  />
                  <MetricRow
                    label="Daily scores"
                    value={activeWeek.dayScore.daily
                      .map((d) => `${WEEKDAYS[keyToDate(d.date).getDay()]} ${fmtNum(d.score, 1)}`)
                      .join(' · ')}
                  />
                  {!!activeWeek.dayScore.latest.rationale && (
                    <Text style={styles.note}>{activeWeek.dayScore.latest.rationale}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.note}>
                  {dayScoreAvailable
                    ? 'Scores are generated from your morning-to-night drawing via Gemini.'
                    : 'Set EXPO_PUBLIC_GEMINI_API_KEY in .env to score drawings automatically.'}
                </Text>
              )}
              {dayScoreAvailable && unscoredInWeek.length > 0 && onScoreEntries && (
                <GhostButton
                  title={scoring ? 'Scoring…' : `Score ${unscoredInWeek.length} unscored ${unscoredInWeek.length === 1 ? 'day' : 'days'}`}
                  onPress={handleScoreMissing}
                />
              )}
              {!!scoreError && <Text style={styles.note}>Gemini error: {scoreError}</Text>}
            </Card>
          )}

          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Remission baseline</Text>
              <Badge
                text={baseline.ready ? 'Active (k=0)' : `${baseline.baselineSessions}/${baseline.requiredSessions} sessions`}
                tone={baseline.ready ? 'ok' : 'neutral'}
              />
            </View>
            <Text style={styles.note}>
              First 5 sessions excluded (practice effect). Local MAD×1.4826 normalization requires{' '}
              {baseline.requiredSessions} valid sessions with PHQ-9 {'<'} 5.
              {baseline.extendRecommended ? ' Slope is significant: baseline window extended.' : ''}
            </Text>
          </Card>

          {activeWeek && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Finger drawing (v2)</Text>
                {activeWeek.drawing ? (
                  <Badge
                    text={
                      activeWeek.drawing.lowQualityCount === 0
                        ? `Valid (${Math.round(activeWeek.drawing.medianDtMs)} ms)`
                        : `${activeWeek.drawing.lowQualityCount} low-rate`
                    }
                    tone={activeWeek.drawing.lowQualityCount === 0 ? 'ok' : 'warn'}
                  />
                ) : (
                  <Badge text="No motion data" />
                )}
              </View>
              {activeWeek.drawing ? (
                <View style={styles.metrics}>
                  <MetricRow label="Movement time" value={fmtSec(activeWeek.drawing.movementTimeMs, 2)} />
                  <MetricRow
                    label="Mean speed"
                    value={`${fmtNum(activeWeek.drawing.meanSpeed)} mm/s`}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.drawingSpeed) : null}
                  />
                  <MetricRow label="Speed CV" value={fmtNum(activeWeek.drawing.speedCV, 2)} />
                  <MetricRow label="Speed reversals / 10 mm" value={fmtNum(activeWeek.drawing.speedReversalsPer10mm, 2)} />
                  <MetricRow label="Normalized jerk" value={fmtNum(activeWeek.drawing.normalizedJerk, 1)} />
                  <MetricRow
                    label="Pauses (< 5 mm/s, ≥ 100 ms)"
                    value={`${fmtNum(activeWeek.drawing.pauseCount, 0)} · ${fmtMs(activeWeek.drawing.totalPauseTimeMs)}`}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.drawingPauseTimeMs) : null}
                  />
                  <MetricRow label="Finger lifts" value={fmtNum(activeWeek.drawing.fingerLifts, 0)} />
                </View>
              ) : (
                <Text style={styles.note}>Draw a day line this week to compute Savitzky–Golay kinematics.</Text>
              )}
            </Card>
          )}

          {activeWeek && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Typing (v2)</Text>
                {activeWeek.typing ? (
                  <Badge
                    text={
                      activeWeek.typing.usableCount === 0
                        ? 'Dropped (< 10 keys)'
                        : activeWeek.typing.lowConfidenceCount > 0
                        ? `${activeWeek.typing.lowConfidenceCount} low_confidence`
                        : 'Valid'
                    }
                    tone={
                      activeWeek.typing.usableCount > 0 && activeWeek.typing.lowConfidenceCount === 0 ? 'ok' : 'warn'
                    }
                  />
                ) : (
                  <Badge text="No text entries" />
                )}
              </View>
              {activeWeek.typing && activeWeek.typing.usableCount > 0 ? (
                <View style={styles.metrics}>
                  <MetricRow
                    label="Median IKD"
                    value={fmtMs(activeWeek.typing.medianIkdMs)}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.ikdMedianMs, true) : null}
                  />
                  <MetricRow label="95th-pct IKD" value={fmtMs(activeWeek.typing.p95IkdMs)} />
                  <MetricRow
                    label="IKD MAD (variability)"
                    value={fmtMs(activeWeek.typing.ikdMadMs)}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.ikdMadMs) : null}
                  />
                  <MetricRow label="Backspace rate" value={fmtPct(activeWeek.typing.backspaceRate)} />
                  <MetricRow
                    label="Median session length"
                    value={fmtSec(activeWeek.typing.medianSessionLengthMs, 1)}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.typingSessionMs) : null}
                  />
                  <MetricRow label="Keys / day" value={fmtNum(activeWeek.typing.keysPerDay, 0)} />
                  <MetricRow label="Night typing (00:00–05:00)" value={fmtPct(activeWeek.typing.nightShare)} />
                  <Text style={styles.note}>
                    Hold time, autocorrect, swipe/paste & phone movement require the native keyboard extension.
                  </Text>
                </View>
              ) : (
                <Text style={styles.note}>Type a reflection (≥ 10 keys) this week to compute IKD & backspace metrics.</Text>
              )}
            </Card>
          )}

          {activeWeek && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Voice (v2)</Text>
                {activeWeek.voice ? (
                  <Badge
                    text={
                      activeWeek.voice.rejectedCount > 0
                        ? `${activeWeek.voice.rejectedCount} rejected`
                        : activeWeek.voice.lowConfidenceCount > 0
                        ? `${activeWeek.voice.lowConfidenceCount} low_confidence`
                        : 'Valid'
                    }
                    tone={
                      activeWeek.voice.rejectedCount === 0 && activeWeek.voice.lowConfidenceCount === 0 ? 'ok' : 'warn'
                    }
                  />
                ) : (
                  <Badge text="No voice entries" />
                )}
              </View>
              {activeWeek.voice ? (
                <View style={styles.metrics}>
                  <MetricRow label="VAD speech time" value={fmtSec(activeWeek.voice.speechTimeMs, 1)} />
                  <MetricRow
                    label="Pause ratio (≥ 250 ms)"
                    value={fmtPct(activeWeek.voice.pauseRatio)}
                    z={activeWeek.zScores ? fmtZ(activeWeek.zScores.voicePauseRatio) : null}
                  />
                  <MetricRow label="Median pause length" value={fmtMs(activeWeek.voice.medianPauseMs)} />
                  <MetricRow label="Long pauses / min (≥ 1 s)" value={fmtNum(activeWeek.voice.longPausesPerMin, 1)} />
                  <MetricRow label="Loudness CV" value={fmtNum(activeWeek.voice.loudnessCV, 2)} />
                  <MetricRow
                    label="Estimated SNR"
                    value={activeWeek.voice.snrDb !== null ? `${fmtNum(activeWeek.voice.snrDb, 1)} dB` : '—'}
                  />
                  <Text style={styles.note}>
                    F0 pitch (pyin), spectral slopes & word-count rate (gemini-3.5-transcribe EU) run on the EU server.
                  </Text>
                </View>
              ) : (
                <Text style={styles.note}>Record a voice reflection (≥ 20 s speech) this week for pause & loudness analysis.</Text>
              )}
            </Card>
          )}

          {activeWeek && (
            <StateCard
              title="How you sounded"
              field="voiceState"
              entries={activeWeek.entries}
              empty="No speech"
              note="Judged by Gemini from pitch, energy, speaking rate, pauses and voice quality. 0 is depleted or strained, 10 is calm and energised. An impression, not a diagnosis."
            />
          )}

          {activeWeek && (
            <StateCard
              title="What you said"
              field="contentState"
              entries={activeWeek.entries}
              empty="Too little"
              note="Judged by Gemini from the words of your reflection, typed or spoken. 0 is a very heavy day, 10 is a very good one. An impression, not a diagnosis."
            />
          )}

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>All evenings</Text>
            <Overlay entries={drawn} />
          </Card>

          <View style={styles.stats}>
            <Stat label="Evenings" value={drawn.length} unit={drawn.length === 1 ? 'line' : 'lines'} />
            <Stat label="In a row" value={run} unit={run === 1 ? 'day' : 'days'} />
            {activeWeek?.dayScore && (
              <Stat label="Day score" value={fmtNum(activeWeek.dayScore.meanScore, 1)} unit="/ 10" />
            )}
          </View>

          {canSample && <GhostButton title="Load sample weeks" onPress={onLoadSample} />}
          {onDeleteAll && <GhostButton title="Delete my data" onPress={confirmDelete} />}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  head: { alignItems: 'center', gap: 4, marginBottom: 4 },
  center: { textAlign: 'center' },

  weekBar: {
    ...card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  weekBtnDisabled: { opacity: 0.25 },
  weekBtnText: { fontFamily: font.semibold, fontSize: 20, color: colors.text, marginTop: -2 },
  weekCenter: { alignItems: 'center', gap: 2 },
  weekTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.text },
  weekSub: { fontFamily: font.medium, fontSize: 11, color: colors.faint },

  card: { ...card, borderRadius: radius.lg, padding: 18, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: font.medium, fontSize: 13, letterSpacing: 0.1, color: colors.text },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontFamily: font.medium, fontSize: 11 },
  note: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.faint },

  metrics: { gap: 8 },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metricLabel: { fontFamily: font.regular, fontSize: 13, color: colors.muted, flex: 1 },
  metricRight: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  metricZ: { fontFamily: font.medium, fontSize: 11, color: colors.lilac, fontVariant: ['tabular-nums'] },
  state: { gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  stateHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateText: { ...type.bodySm, color: colors.text },
  metricValue: { fontFamily: font.semibold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },

  plot: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(14,13,26,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    overflow: 'hidden',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  axis: { fontFamily: font.medium, fontSize: 11, color: colors.faint },
  dayRow: { flexDirection: 'row', marginTop: 6, marginHorizontal: 14 },
  day: { flex: 1, textAlign: 'center', fontFamily: font.medium, fontSize: 11, color: colors.faint },
  dayNow: { fontFamily: font.semibold, color: colors.lilacPale },

  stats: { flexDirection: 'row', gap: 12 },
  stat: { ...card, flex: 1, borderRadius: radius.md, padding: 16, gap: 6 },
  statLabel: { fontFamily: font.medium, fontSize: 11, color: colors.faint },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statValue: { fontFamily: font.semibold, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  statUnit: { fontFamily: font.medium, fontSize: 11, color: colors.lilacPale },
});

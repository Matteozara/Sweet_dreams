import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path } from 'react-native-svg';
import { Header } from '../components/Chrome';
import { GhostButton } from '../components/Buttons';
import { GlowLine, LineGradient } from '../components/LineArt';
import { dayKey, keyToDate, meanMood, smoothPath, streak, toPixels } from '../line';
import { card, colors, font, radius, type } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** Every line on one canvas: the oldest faintest, tonight in full light. */
function Overlay({ entries }) {
  const [w, onLayout] = useWidth();
  const h = 200;
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

/** The last seven lines joined end to end into one path through the week. */
function Week({ entries }) {
  const [w, onLayout] = useWidth();
  const h = 150;
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
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function AnalysisScreen({ entries, onLoadSample }) {
  const drawn = entries.filter((e) => e.line?.points?.length > 1);
  const run = streak(drawn);
  // Demo helper, development builds only.
  const canSample = __DEV__ && onLoadSample && !entries.some((e) => e.sample);

  return (
    <View style={styles.screen}>
      <Header chip="Analysis" />
      {drawn.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.display, styles.center]}>Your lines</Text>
          <Text style={[type.bodySm, styles.center]}>They gather here, one evening at a time.</Text>
          {canSample && <GhostButton title="Load a sample week" onPress={onLoadSample} style={{ marginTop: 24 }} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Text style={[type.display, styles.center]}>Your lines</Text>
            <Text style={[type.bodySm, styles.center]}>Every evening, layered.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>All evenings</Text>
            <Overlay entries={drawn} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>This week, end to end</Text>
            <Week entries={drawn} />
          </View>

          <View style={styles.stats}>
            <Stat label="Evenings" value={drawn.length} unit={drawn.length === 1 ? 'line' : 'lines'} />
            <Stat label="In a row" value={run} unit={run === 1 ? 'day' : 'days'} />
          </View>
          {canSample && <GhostButton title="Load a sample week" onPress={onLoadSample} />}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  head: { alignItems: 'center', gap: 4, marginBottom: 8 },
  center: { textAlign: 'center' },

  card: { ...card, borderRadius: radius.lg, padding: 20, gap: 14 },
  cardTitle: { fontFamily: font.medium, fontSize: 13, letterSpacing: 0.1, color: colors.text },
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

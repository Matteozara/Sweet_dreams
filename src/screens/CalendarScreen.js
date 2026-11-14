import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Header } from '../components/Chrome';
import { GhostButton } from '../components/Buttons';
import DayLine from '../components/DayLine';
import { dayKey, formatDuration, keyToDate } from '../line';
import { card, colors, font, radius, type } from '../theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthOf = (key) => key.slice(0, 7);

/** Shift a `YYYY-MM` month key by `delta` months. */
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return monthOf(dayKey(new Date(y, m - 1 + delta, 1)));
}

/** Monday-first rows of day keys for a month; `null` pads the first and last week. */
function monthRows(month) {
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => dayKey(new Date(y, m - 1, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}

function formatLongDate(key) {
  const d = keyToDate(key);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The words of an evening: what was typed, or what was heard. */
function entryWords(entry) {
  const answer = entry?.answer;
  if (!answer) return '';
  return (answer.type === 'audio' ? answer.transcript : answer.text) || '';
}

/** A month grid. Evenings that were closed carry a small dot. */
function Month({ month, byDate, selected, today, onSelect }) {
  const rows = useMemo(() => monthRows(month), [month]);
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key, c) => {
            if (!key) return <View key={c} style={styles.cell} />;
            const future = key > today;
            const filled = byDate.has(key);
            const active = key === selected;
            return (
              <Pressable
                key={key}
                style={styles.cell}
                disabled={future}
                onPress={() => onSelect(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: future }}
                accessibilityLabel={`${formatLongDate(key)}${filled ? ', has a line' : ''}`}
              >
                <View style={[styles.dayDisc, key === today && styles.dayToday, active && styles.dayActive]}>
                  <Text
                    style={[
                      styles.dayNum,
                      filled && styles.dayNumFilled,
                      future && styles.dayNumFuture,
                      active && styles.dayNumActive,
                    ]}
                  >
                    {keyToDate(key).getDate()}
                  </Text>
                </View>
                <View style={[styles.dot, filled && styles.dotOn]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** One evening: the line as it was drawn, and the words that went with it. */
function Day({ dateKey, entry }) {
  const words = entryWords(entry);
  const spoken = entry?.answer?.type === 'audio';
  const points = entry?.line?.points;
  return (
    <Card style={styles.card}>
      <Text style={type.eyebrow}>{formatLongDate(dateKey).toUpperCase()}</Text>
      {!entry ? (
        <Text style={type.bodySm}>Nothing was drawn this evening.</Text>
      ) : (
        <>
          {points?.length > 1 && (
            <View style={styles.plot}>
              <DayLine points={points} canvas={entry.line.canvas} maxHeight={150} showMidline />
              <View style={styles.axisRow}>
                <Text style={styles.axis}>Morning</Text>
                <Text style={styles.axis}>Night</Text>
              </View>
            </View>
          )}
          {words ? (
            <Text style={type.body}>{words}</Text>
          ) : (
            <Text style={type.bodySm}>{spoken ? 'You spoke this evening.' : 'No words this evening.'}</Text>
          )}
          {spoken && <Text style={styles.caption}>Spoken · {formatDuration(entry.answer.durationMs)}</Text>}
        </>
      )}
    </Card>
  );
}

export default function CalendarScreen({ entries, onLoadSample, onDeleteAll, onSettings }) {
  const today = dayKey();
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const latest = entries.length ? entries[entries.length - 1].date : today;
  const earliestMonth = monthOf(entries.length ? entries[0].date : today);
  const canSample = __DEV__ && onLoadSample && !entries.some((e) => e.sample);

  const [selected, setSelected] = useState(latest);
  const [month, setMonth] = useState(monthOf(latest));

  // Follow the newest evening when entries are added, loaded or cleared.
  useEffect(() => {
    setSelected(latest);
    setMonth(monthOf(latest));
  }, [latest]);

  const [year, monthNum] = month.split('-').map(Number);
  const canPrev = month > earliestMonth;
  const canNext = month < monthOf(today);

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.monthBar}>
            <Pressable
              onPress={() => setMonth((m) => shiftMonth(m, -1))}
              disabled={!canPrev}
              hitSlop={12}
              style={[styles.monthBtn, !canPrev && styles.monthBtnDisabled]}
              accessibilityLabel="Previous month"
            >
              <Text style={styles.monthBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS[monthNum - 1]} {year}
            </Text>
            <Pressable
              onPress={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={!canNext}
              hitSlop={12}
              style={[styles.monthBtn, !canNext && styles.monthBtnDisabled]}
              accessibilityLabel="Next month"
            >
              <Text style={styles.monthBtnText}>›</Text>
            </Pressable>
          </View>
          <Month month={month} byDate={byDate} selected={selected} today={today} onSelect={setSelected} />
        </Card>

        <Day dateKey={selected} entry={byDate.get(selected)} />

        {canSample && <GhostButton title="Load sample weeks" onPress={onLoadSample} />}
        {onDeleteAll && entries.length > 0 && <GhostButton title="Delete my data" onPress={confirmDelete} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  card: { ...card, borderRadius: radius.lg, padding: 18, gap: 14 },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  monthBtnDisabled: { opacity: 0.25 },
  monthBtnText: { fontFamily: font.semibold, fontSize: 20, color: colors.text, marginTop: -2 },
  monthTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.text },

  grid: { gap: 4 },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: font.medium, fontSize: 11, color: colors.faint, marginBottom: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, gap: 3 },
  dayDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: colors.outline },
  dayActive: { backgroundColor: colors.lilac, borderColor: colors.lilac },
  dayNum: { fontFamily: font.medium, fontSize: 13, color: colors.faint, fontVariant: ['tabular-nums'] },
  dayNumFilled: { color: colors.text },
  dayNumFuture: { opacity: 0.4 },
  dayNumActive: { fontFamily: font.semibold, color: colors.ink, opacity: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotOn: { backgroundColor: colors.pink },

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
  caption: { fontFamily: font.medium, fontSize: 11, color: colors.faint },
});

import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Header } from '../components/Chrome';
import { GlassButton, PrimaryButton, Press } from '../components/Buttons';
import Icon from '../components/Icon';
import Moon from '../components/Moon';
import ActivityIcon from '../components/ActivityIcon';
import { moodTierSummary, suggestionsFor, suggestionsForEntry } from '../activities';
import { keyToDate } from '../line';
import { addToCalendar, formatWhen, remindMe } from '../schedule';
import { colors, font, radius, space, type } from '../theme';

function TimeStepper({ value, onUp, onDown, label }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onUp} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${label} up`}>
        <Icon name="up" size={20} color={colors.muted} />
      </Pressable>
      <Text style={styles.digits}>{value}</Text>
      <Pressable onPress={onDown} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${label} down`}>
        <Icon name="down" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function nextRoundedSlot() {
  const d = new Date(Date.now() + 6 * 60000);
  const roundedMin = Math.ceil(d.getMinutes() / 5) * 5;
  if (roundedMin >= 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(roundedMin, 0, 0);
  }
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/** Choose when and how an activity comes back to you. */
function ScheduleSheet({ activity, onClose, onScheduled }) {
  const [dayOffset, setDayOffset] = useState(1); // 0 = Today, 1 = Tomorrow
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(null);

  const pm = hour >= 12;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const stepHour = (d) => setHour((v) => (v >= 12 ? 12 : 0) + (((v % 12) + d + 12) % 12));
  const stepMinute = (d) => setMinute((v) => (v + d + 60) % 60);
  const setPeriod = (toPm) => setHour((v) => (v % 12) + (toPm ? 12 : 0));

  const selectDay = (nextOffset) => {
    setDayOffset(nextOffset);
    if (nextOffset === 0) {
      const candidate = new Date();
      candidate.setHours(hour, minute, 0, 0);
      if (candidate.getTime() <= Date.now() + 60000) {
        const slot = nextRoundedSlot();
        setHour(slot.hour);
        setMinute(slot.minute);
      }
    }
  };

  const when = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [dayOffset, hour, minute]);

  const inPast = dayOffset === 0 && when.getTime() <= Date.now() + 15000;

  const run = async (kind) => {
    if (inPast) {
      Alert.alert('Choose a later time', 'Pick a time later today, or switch to Tomorrow.');
      return;
    }
    setBusy(kind);
    const ok =
      kind === 'remind'
        ? await remindMe(activity, when)
        : await addToCalendar(activity, when, { minutes: activity.minutes ?? 30 });
    setBusy(null);
    if (ok) {
      onScheduled(kind);
      return;
    }
    Alert.alert(
      kind === 'remind' ? 'Could not set a reminder' : 'Could not add to the calendar',
      kind === 'remind'
        ? 'Notifications need permission, and Expo Go cannot schedule them at all — a development build can.'
        : 'Calendar access was not granted, or there is no calendar to write to.'
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{activity.title}</Text>
          <Text style={styles.sheetWhen}>
            {formatWhen(when)}
            {activity.minutes ? ` · ${activity.minutes} min` : ''}
          </Text>

          <View style={styles.dayRow}>
            {[
              { offset: 0, label: 'Today' },
              { offset: 1, label: 'Tomorrow' },
            ].map((opt) => {
              const active = dayOffset === opt.offset;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => selectDay(opt.offset)}
                  style={[styles.dayPill, active && styles.dayPillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.dayPillText, active && styles.dayPillTextOn]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.picker}>
            <TimeStepper
              label="Hour"
              value={String(h12)}
              onUp={() => stepHour(1)}
              onDown={() => stepHour(-1)}
            />
            <Text style={styles.colon}>:</Text>
            <TimeStepper
              label="Minute"
              value={String(minute).padStart(2, '0')}
              onUp={() => stepMinute(5)}
              onDown={() => stepMinute(-5)}
            />
            <View style={styles.period}>
              {[false, true].map((isPm) => (
                <Pressable
                  key={String(isPm)}
                  onPress={() => setPeriod(isPm)}
                  style={[styles.periodBtn, pm === isPm && styles.periodOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: pm === isPm }}
                >
                  <Text style={[styles.periodText, pm === isPm && styles.periodTextOn]}>
                    {isPm ? 'PM' : 'AM'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {inPast && (
            <Text style={styles.pastHint}>That time has already passed today — pick a later time or Tomorrow.</Text>
          )}

          <View style={styles.sheetActions}>
            <PrimaryButton
              title={busy === 'remind' ? 'Setting…' : 'Remind me'}
              disabled={!!busy || inPast}
              onPress={() => run('remind')}
            />
            <GlassButton
              title={busy === 'calendar' ? 'Adding…' : 'Add to calendar'}
              disabled={!!busy || inPast}
              onPress={() => run('calendar')}
            />
            <Press onPress={onClose} haptic={false} innerStyle={styles.cancel}>
              <Text style={styles.cancelText}>Not now</Text>
            </Press>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SuggestionCard({ item, index, scheduled, onSchedule }) {
  const scheduledLabel =
    scheduled === 'calendar' ? 'Added to calendar' : scheduled ? 'Reminder set' : null;
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <ActivityIcon type={item.type} index={index} />
        <Text style={styles.cardTitle}>{item.title}</Text>
      </View>
      <GlassButton
        small
        title={scheduledLabel ?? (item.minutes ? `Schedule ${item.minutes} min` : 'Schedule this')}
        disabled={!!scheduled}
        onPress={() => onSchedule(item)}
        icon={<Icon name={scheduled ? 'arrow' : 'clock'} size={15} color={colors.lilac} />}
        style={styles.cardButton}
      />
    </Card>
  );
}

/**
 * Evening suggestions tailored to today's mood score and rotated daily.
 * Shown directly on the Reflection tab once today's check-in is complete,
 * topped with a compact sleeping moon and "Goodnight." greeting.
 */
export default function SuggestionsScreen({
  score,
  entry = null,
  completedToday = false,
  onMarkScheduled,
  onDone,
  onSettings,
}) {
  const { items, levelId } = useMemo(() => {
    const date = entry?.date ? keyToDate(entry.date) : new Date();
    if (entry) {
      const computed = suggestionsForEntry(entry, { fallbackPhq9: score, date });
      return {
        items: (entry.suggestions?.length ? entry.suggestions : computed.items).slice(0, 3),
        levelId: entry.suggestionLevel || computed.level.id,
      };
    }
    const fallback = suggestionsFor(score, { date });
    return { items: fallback.items.slice(0, 3), levelId: fallback.level.id };
  }, [entry, score]);
  const [sheetFor, setSheetFor] = useState(null);
  const [localScheduled, setLocalScheduled] = useState({});
  const scheduled = { ...(entry?.scheduledSuggestions || {}), ...localScheduled };
  const tierNote = moodTierSummary(levelId);

  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.goodnightRow}>
            <Moon zeds compact />
            <View style={styles.goodnightCopy}>
              <Text style={styles.goodnightTitle}>Goodnight.</Text>
              <Text style={styles.goodnightSub}>Thank you for sharing today.</Text>
            </View>
          </View>
          <Text style={styles.sub}>{tierNote}</Text>
        </View>

        {items.map((item, i) => (
          <SuggestionCard
            key={item.id}
            item={item}
            index={i}
            scheduled={scheduled[item.id]}
            onSchedule={setSheetFor}
          />
        ))}

        {!completedToday && onDone && (
          <PrimaryButton title="Close Today" onPress={onDone} style={styles.cta} />
        )}
      </ScrollView>

      {sheetFor && (
        <ScheduleSheet
          activity={sheetFor}
          onClose={() => setSheetFor(null)}
          onScheduled={(kind) => {
            setLocalScheduled((s) => ({ ...s, [sheetFor.id]: kind }));
            onMarkScheduled?.(sheetFor.id, kind);
            setSheetFor(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 12 },
  head: { marginBottom: 6 },
  goodnightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  goodnightCopy: { flex: 1 },
  goodnightTitle: { ...type.display, fontSize: 28, lineHeight: 34, color: colors.text },
  goodnightSub: { ...type.bodySm, color: colors.lilacPale, marginTop: 2 },
  sub: { ...type.bodySm, color: colors.muted, marginTop: 8 },

  card: { padding: 18, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardTitle: { ...type.headline, color: colors.text, flex: 1 },
  cardButton: { alignSelf: 'flex-start' },
  cta: { marginTop: 12 },

  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.glassStrong,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  sheetTitle: { ...type.headline, color: colors.text },
  sheetWhen: { ...type.bodySm, color: colors.lilacPale, marginTop: 4, marginBottom: space.md },

  dayRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(14,13,26,0.45)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dayPillOn: {
    backgroundColor: 'rgba(212,187,255,0.2)',
    borderColor: 'rgba(212,187,255,0.45)',
  },
  dayPillText: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },
  dayPillTextOn: { color: colors.lilacPale },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    alignSelf: 'stretch',
    paddingVertical: 14,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14,13,26,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepper: { alignItems: 'center', gap: 6, minWidth: 56 },
  digits: {
    fontFamily: font.semibold,
    fontSize: 30,
    lineHeight: 38,
    color: colors.lilacPale,
    fontVariant: ['tabular-nums'],
  },
  colon: { fontFamily: font.semibold, fontSize: 24, color: colors.muted, marginBottom: 4 },
  period: { gap: 6, marginLeft: 6 },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodOn: { backgroundColor: 'rgba(212,187,255,0.22)', borderColor: 'rgba(212,187,255,0.4)' },
  periodText: { fontFamily: font.semibold, fontSize: 12, color: colors.muted },
  periodTextOn: { color: colors.lilacPale },

  pastHint: { ...type.bodySm, fontSize: 12.5, color: colors.pink, textAlign: 'center', marginBottom: 12 },

  sheetActions: { gap: 10 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { ...type.label, color: colors.muted },
});

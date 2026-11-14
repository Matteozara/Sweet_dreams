import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Header } from '../components/Chrome';
import { GlassButton, PrimaryButton, Press } from '../components/Buttons';
import Icon from '../components/Icon';
import Moon from '../components/Moon';
import ActivityIcon from '../components/ActivityIcon';
import { moodTierSummary, suggestionsFor, suggestionsForEntry } from '../activities';
import { keyToDate } from '../line';
import { addToCalendar, formatWhen, remindMe, tomorrowAt } from '../schedule';
import { colors, radius, space, type } from '../theme';

/** Choose how an activity comes back to you. */
function ScheduleSheet({ activity, onClose, onScheduled }) {
  const when = useMemo(() => tomorrowAt(9), []);
  const [busy, setBusy] = useState(null);

  const run = async (kind) => {
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

          <View style={styles.sheetActions}>
            <PrimaryButton
              title={busy === 'remind' ? 'Setting…' : 'Remind me'}
              disabled={!!busy}
              onPress={() => run('remind')}
            />
            <GlassButton
              title={busy === 'calendar' ? 'Adding…' : 'Add to calendar'}
              disabled={!!busy}
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
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <ActivityIcon type={item.type} index={index} />
        <View style={styles.cardCopy}>
          <Text style={styles.cardMeta}>
            {item.type}
            {item.dose ? ` · ${item.dose}` : ''}
          </Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
      </View>
      <GlassButton
        small
        title={scheduled ? 'Scheduled' : item.minutes ? `Schedule ${item.minutes} min` : 'Schedule this'}
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
  cardCopy: { flex: 1, gap: 3 },
  cardMeta: { ...type.eyebrow, fontSize: 10.5, letterSpacing: 1.1, color: colors.subtle },
  cardTitle: { ...type.headline, color: colors.text },
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
    paddingBottom: 40,
  },
  sheetTitle: { ...type.headline, color: colors.text },
  sheetWhen: { ...type.bodySm, marginTop: 4, marginBottom: space.lg },
  sheetActions: { gap: 10 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { ...type.label, color: colors.muted },
});

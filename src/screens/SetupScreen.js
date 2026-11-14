import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Header, Toggle } from '../components/Chrome';
import { PrimaryButton } from '../components/Buttons';
import TimeSheet from '../components/TimeSheet';
import { requestMovement } from '../services';
import { formatTime } from '../line';
import { card, colors, font, radius, space, type } from '../theme';

/** What may we measure, and when should we remind you. */
export default function SetupScreen({ profile, onDone }) {
  const insets = useSafeAreaInsets();
  const [movement, setMovement] = useState(profile.movement);
  const [reminder, setReminder] = useState(profile.reminder);
  const [picking, setPicking] = useState(false);

  const toggleMovement = async (on) => {
    setMovement(on);
    if (on && !(await requestMovement())) setMovement(false);
  };

  return (
    <View style={styles.screen}>
      <Header chip="Setup" />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View>
          <Text style={[type.display, styles.title]}>May we notice?</Text>

          <Card style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>Movement</Text>
                <Text style={styles.rowHint}>Location</Text>
              </View>
              <Toggle label="Movement" value={movement} onChange={toggleMovement} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Pressable style={styles.reminder} onPress={() => setPicking(true)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.rowLabel}>Evening reminder</Text>
                <View style={[styles.badge, !reminder.enabled && { opacity: 0.4 }]}>
                  <Text style={styles.badgeText}>{formatTime(reminder.hour, reminder.minute)}</Text>
                </View>
              </Pressable>
              <Toggle
                label="Evening reminder"
                value={reminder.enabled}
                onChange={(enabled) => setReminder((r) => ({ ...r, enabled }))}
              />
            </View>
          </Card>
        </View>

        <PrimaryButton title="Continue" onPress={() => onDone({ movement, reminder })} />
      </View>

      <TimeSheet
        visible={picking}
        hour={reminder.hour}
        minute={reminder.minute}
        onCancel={() => setPicking(false)}
        onSave={(hour, minute) => {
          setReminder({ enabled: true, hour, minute });
          setPicking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  title: { marginTop: space.lg, marginBottom: 32 },
  card: { ...card, borderRadius: radius.lg, paddingHorizontal: 20, paddingVertical: 6 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: font.medium, fontSize: 15, color: colors.text },
  rowHint: { fontFamily: font.regular, fontSize: 12, color: colors.faint, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(212,187,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212,187,255,0.3)',
  },
  badgeText: { fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.3, color: colors.lilacPale },
});

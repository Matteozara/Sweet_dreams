import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { GlassButton, PrimaryButton } from './Buttons';
import { colors, font, radius } from '../theme';

function Stepper({ value, onUp, onDown, label }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onUp} hitSlop={12} accessibilityLabel={`${label} up`}>
        <Icon name="up" size={20} color={colors.muted} />
      </Pressable>
      <Text style={styles.digits}>{value}</Text>
      <Pressable onPress={onDown} hitSlop={12} accessibilityLabel={`${label} down`}>
        <Icon name="down" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/** Bottom sheet for choosing the evening reminder time. */
export default function TimeSheet({ visible, hour, minute, onCancel, onSave }) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  useEffect(() => {
    if (visible) {
      setH(hour);
      setM(minute);
    }
  }, [visible]);

  const pm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const stepHour = (d) => setH((v) => (pm ? 12 : 0) + (((v % 12) + d + 12) % 12));
  const stepMinute = (d) => setM((v) => (v + d + 60) % 60);
  const setPeriod = (toPm) => setH((v) => (v % 12) + (toPm ? 12 : 0));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Evening reminder</Text>
          <View style={styles.picker}>
            <Stepper label="Hour" value={String(h12)} onUp={() => stepHour(1)} onDown={() => stepHour(-1)} />
            <Text style={styles.colon}>:</Text>
            <Stepper label="Minute" value={String(m).padStart(2, '0')} onUp={() => stepMinute(5)} onDown={() => stepMinute(-5)} />
            <View style={styles.period}>
              {[false, true].map((isPm) => (
                <Pressable
                  key={String(isPm)}
                  onPress={() => setPeriod(isPm)}
                  style={[styles.periodBtn, pm === isPm && styles.periodOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: pm === isPm }}
                >
                  <Text style={[styles.periodText, pm === isPm && styles.periodTextOn]}>{isPm ? 'PM' : 'AM'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <GlassButton title="Cancel" onPress={onCancel} style={styles.action} />
            <PrimaryButton title="Set" onPress={() => onSave(h, m)} style={[styles.action, { height: 52 }]} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end', padding: 16, paddingBottom: 32 },
  sheet: {
    backgroundColor: colors.container,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    alignItems: 'center',
    gap: 24,
  },
  title: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.2, color: colors.text },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14,13,26,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stepper: { alignItems: 'center', gap: 6, minWidth: 56 },
  digits: { fontFamily: font.semibold, fontSize: 32, lineHeight: 40, color: colors.lilacPale, fontVariant: ['tabular-nums'] },
  colon: { fontFamily: font.semibold, fontSize: 26, color: colors.muted, marginBottom: 4 },
  period: { gap: 6, marginLeft: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  periodOn: { backgroundColor: 'rgba(212,187,255,0.22)', borderColor: 'rgba(212,187,255,0.4)' },
  periodText: { fontFamily: font.semibold, fontSize: 12, color: colors.muted },
  periodTextOn: { color: colors.lilacPale },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  action: { flex: 1, flexBasis: 0, minWidth: 0 },
});

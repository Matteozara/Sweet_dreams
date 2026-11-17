import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Header, FadeIn } from '../components/Chrome';
import { GlassButton } from '../components/Buttons';
import Icon from '../components/Icon';
import Moon from '../components/Moon';
import DayLine from '../components/DayLine';
import { colors, font, type } from '../theme';

/** Last step: the day is closed. */
export default function RestScreen({ entry, onCalendar, onRedo, onSettings }) {
  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
      <View style={styles.body}>
        <View style={styles.center}>
          <Moon zeds />
          <Text style={styles.title}>Goodnight.</Text>
          <Text style={styles.sub}>Today is closed.</Text>
          {entry?.line?.points?.length > 1 && (
            <FadeIn delay={500} duration={900} style={styles.todayWrap}>
              <DayLine points={entry.line.points} canvas={entry.line.canvas} style={styles.today} />
            </FadeIn>
          )}
        </View>
        <View style={styles.actions}>
          <GlassButton
            title="Your calendar"
            onPress={onCalendar}
            icon={<Icon name="calendar" size={18} color={colors.lilac} />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.display, fontSize: 36, lineHeight: 44 },
  sub: { ...type.bodySm, marginTop: 6 },
  todayWrap: { alignSelf: 'stretch', marginTop: 28 },
  today: { width: '100%' },
  actions: { gap: 10 },
});

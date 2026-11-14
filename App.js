import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';

import Backdrop from './src/components/Backdrop';
import { BottomNav, FadeIn } from './src/components/Chrome';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SetupScreen from './src/screens/SetupScreen';
import ReflectionScreen from './src/screens/ReflectionScreen';
import DayLineScreen from './src/screens/DayLineScreen';
import RestScreen from './src/screens/RestScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import { loadAll, sampleEntries, saveEntries, saveProfile, upsertEntry } from './src/storage';
import { sampleLocation, syncReminder } from './src/services';
import { dayKey } from './src/line';
import { colors } from './src/theme';

/**
 * Flow: welcome -> setup -> (reflection -> day line -> rest) every evening.
 * Analysis sits beside the evening ritual in the bottom bar.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('evening'); // 'evening' | 'analysis'
  const [draft, setDraft] = useState(null); // tonight's answer, while the line is being drawn
  const [redoing, setRedoing] = useState(false);

  useEffect(() => {
    loadAll().then((data) => {
      setEntries(data.entries);
      setProfile(data.profile);
    });
  }, []);

  if (!profile || !(fontsLoaded || fontError)) return <View style={styles.root} />;

  const updateProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
  };

  const updateEntries = (next) => {
    setEntries(next);
    saveEntries(next);
  };

  const today = entries.find((e) => e.date === dayKey());

  const finishSetup = ({ movement, reminder }) => {
    updateProfile({ movement, reminder, onboarded: true });
    syncReminder(reminder);
  };

  const closeDay = (line) => {
    const entry = {
      id: String(Date.now()),
      date: dayKey(),
      startedAt: draft.startedAt,
      finishedAt: new Date().toISOString(),
      answer: draft.answer,
      line,
    };
    const next = upsertEntry(entries, entry);
    updateEntries(next);
    setDraft(null);
    setRedoing(false);
    if (profile.movement) {
      sampleLocation().then((location) => {
        if (!location) return;
        setEntries((list) => {
          const withLocation = list.map((e) => (e.id === entry.id ? { ...e, location } : e));
          saveEntries(withLocation);
          return withLocation;
        });
      });
    }
  };

  let screen;
  let key;
  let nav = false;
  if (!profile.signedIn) {
    key = 'welcome';
    screen = <WelcomeScreen onSignIn={() => updateProfile({ signedIn: true })} />;
  } else if (!profile.onboarded) {
    key = 'setup';
    screen = <SetupScreen profile={profile} onDone={finishSetup} />;
  } else if (tab === 'analysis') {
    key = 'analysis';
    nav = true;
    screen = <AnalysisScreen entries={entries} onLoadSample={() => updateEntries(sampleEntries(entries))} />;
  } else if (draft) {
    key = 'line';
    screen = <DayLineScreen onSubmit={closeDay} onBack={() => setDraft(null)} />;
  } else if (today && !redoing) {
    key = 'rest';
    nav = true;
    screen = <RestScreen entry={today} onProgress={() => setTab('analysis')} onRedo={() => setRedoing(true)} />;
  } else {
    key = 'reflection';
    nav = true;
    screen = (
      <ReflectionScreen onSubmit={(answer) => setDraft({ answer, startedAt: new Date().toISOString() })} />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Backdrop />
        <FadeIn key={key} style={styles.root}>
          {screen}
        </FadeIn>
        {nav && (
          <BottomNav
            active={tab}
            onChange={setTab}
            items={[
              { key: 'evening', label: today && !redoing ? 'Rest' : 'Reflection', icon: 'moon' },
              { key: 'analysis', label: 'Analysis', icon: 'activity' },
            ]}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

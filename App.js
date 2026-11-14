import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';

import Backdrop from './src/components/Backdrop';
import { BottomNav, FadeIn } from './src/components/Chrome';
import SplashScreen from './src/screens/SplashScreen';
import SetupScreen from './src/screens/SetupScreen';
import ReflectionScreen from './src/screens/ReflectionScreen';
import DayLineScreen from './src/screens/DayLineScreen';
import RestScreen from './src/screens/RestScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import { clearAllData, defaultProfile, loadAll, sampleEntries, saveEntries, saveProfile, upsertEntry } from './src/storage';
import { sampleLocation, syncReminder } from './src/services';
import { dayKey } from './src/line';
import { colors } from './src/theme';

const TABS = [
  { key: 'reflection', label: 'Reflection', icon: 'moon' },
  { key: 'rest', label: 'Rest', icon: 'bed' },
  { key: 'analysis', label: 'Analysis', icon: 'activity' },
];

/** True while the on-screen keyboard is up, so the nav can step out of the way. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Splash on every launch, then setup once, then the evening itself:
 * question -> day line -> rest. Analysis sits beside them in the bottom bar,
 * and the header gear reopens setup to change permissions.
 */
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });
  const [splashDone, setSplashDone] = useState(false);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('reflection');
  const [draft, setDraft] = useState(null); // tonight's answer, while the line is being drawn
  const [settingsOpen, setSettingsOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    loadAll().then((data) => {
      setEntries(data.entries);
      setProfile(data.profile);
    });
  }, []);

  const updateProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
  };

  const updateEntries = (next) => {
    setEntries(next);
    saveEntries(next);
  };

  // The newest entry for today: with keepEveryTry there can be several.
  const today = [...entries].reverse().find((e) => e.date === dayKey());
  const latest = today ?? entries[entries.length - 1];

  const finishSetup = ({ movement, reminder, keepEveryTry }) => {
    updateProfile({ movement, reminder, keepEveryTry, onboarded: true });
    syncReminder(reminder);
  };

  const saveSettings = ({ movement, reminder, keepEveryTry }) => {
    updateProfile({ movement, reminder, keepEveryTry });
    syncReminder(reminder);
    setSettingsOpen(false);
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
    const next = upsertEntry(entries, entry, { keepEveryTry: __DEV__ && profile.keepEveryTry });
    updateEntries(next);
    setDraft(null);
    setTab('rest'); // the evening ends in the wind-down screen
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

  const openSettings = () => setSettingsOpen(true);

  let screen;
  let key;
  let nav = false;
  const ready = profile && (fontsLoaded || fontError);

  if (!splashDone || !ready) {
    key = 'splash';
    screen = <SplashScreen onDone={() => setSplashDone(true)} />;
  } else if (!profile.onboarded) {
    key = 'setup';
    screen = <SetupScreen profile={profile} onDone={finishSetup} />;
  } else if (settingsOpen) {
    key = 'settings';
    screen = (
      <SetupScreen
        editing
        profile={profile}
        onDone={saveSettings}
        onBack={() => setSettingsOpen(false)}
      />
    );
  } else if (draft) {
    // The day line is pushed on top of Reflection, so the tabs step aside.
    key = 'line';
    screen = (
      <DayLineScreen onSubmit={closeDay} onBack={() => setDraft(null)} onSettings={openSettings} />
    );
  } else if (tab === 'analysis') {
    key = 'analysis';
    nav = true;
    screen = (
      <AnalysisScreen
        entries={entries}
        onLoadSample={() => updateEntries(sampleEntries(entries))}
        onDeleteAll={async () => {
          await clearAllData();
          setEntries([]);
          setProfile(defaultProfile);
          setTab('reflection');
        }}
        onSettings={openSettings}
      />
    );
  } else if (tab === 'rest') {
    key = 'rest';
    nav = true;
    screen = (
      <RestScreen
        entry={latest}
        onProgress={() => setTab('analysis')}
        onSettings={openSettings}
      />
    );
  } else {
    key = 'reflection';
    nav = true;
    screen = (
      <ReflectionScreen
        onSubmit={(answer) => setDraft({ answer, startedAt: new Date().toISOString() })}
        onSettings={openSettings}
      />
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar style="light" />
          <Backdrop />
          <FadeIn key={key} style={styles.root}>
            {screen}
          </FadeIn>
          {nav && !keyboardOpen && <BottomNav active={tab} onChange={setTab} items={TABS} />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

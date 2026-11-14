import React, { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform, StyleSheet, View } from 'react-native';
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
import CalendarScreen from './src/screens/CalendarScreen';
import SuggestionsScreen from './src/screens/SuggestionsScreen';
import {
  CLEAR_TODAY_ONCE,
  clearAllData,
  clearTodayEntryOnce,
  defaultProfile,
  loadAll,
  removeTodayEntry,
  sampleEntries,
  saveEntries,
  saveProfile,
  upsertEntry,
} from './src/storage';
import { suggestionsForEntry } from './src/activities';
import { syncReminder } from './src/services';
import { analyzeVoiceState } from './src/voiceState';
import { analyzeContentState, answerText } from './src/contentState';
import { scoreDayLine, scoreDayLineDetailed } from './src/analysis/dayScore';
import { dayKey } from './src/line';
import { colors } from './src/theme';

const TABS = [
  { key: 'reflection', label: 'Reflection', icon: 'moon' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
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

/** Reactive `YYYY-MM-DD` key that rolls over automatically at local midnight and on app resume. */
function useTodayKey() {
  const [key, setKey] = useState(() => dayKey());
  useEffect(() => {
    let timer;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 100);
      timer = setTimeout(() => {
        setKey(dayKey());
        scheduleNextMidnight();
      }, Math.max(250, nextMidnight.getTime() - now.getTime()));
    };
    scheduleNextMidnight();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setKey(dayKey());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return key;
}

/**
 * Splash on every launch, then setup once, then the evening itself:
 * question -> day line -> rest. The calendar of past evenings sits beside them in the bottom bar,
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
  const currentDay = useTodayKey();

  useEffect(() => {
    loadAll().then((data) => {
      setEntries(data.entries);
      setProfile(data.profile);
    });
  }, []);

  // Also clear today's existing entry once under live Fast Refresh so testing starts fresh immediately.
  useEffect(() => {
    if (!profile) return;
    clearTodayEntryOnce(entries).then((filtered) => {
      if (!filtered) return;
      setEntries(filtered);
      setDraft(null);
      setTab('reflection');
    });
  }, [Boolean(profile), CLEAR_TODAY_ONCE]);

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
  const today = [...entries].reverse().find((e) => e.date === currentDay);

  const finishSetup = ({ reminder }) => {
    updateProfile({ reminder, onboarded: true });
    syncReminder(reminder);
  };

  const saveSettings = ({ reminder }) => {
    updateProfile({ reminder });
    syncReminder(reminder);
    setSettingsOpen(false);
  };

  const patchEntryById = (entryId, patch) =>
    setEntries((list) => {
      const patched = list.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
      saveEntries(patched);
      return patched;
    });

  const patchEntryWithSuggestions = (entryId, patch) =>
    setEntries((list) => {
      const patched = list.map((e) => {
        if (e.id !== entryId) return e;
        const merged = { ...e, ...patch };
        // Keep suggestions locked once the user has scheduled an activity; otherwise refine as scores arrive.
        const hasScheduled = Object.keys(merged.scheduledSuggestions || {}).length > 0;
        if (hasScheduled) return merged;
        const picked = suggestionsForEntry(merged, { fallbackPhq9: profile?.simulatedPhq9 ?? 12 });
        return {
          ...merged,
          moodScore: picked.moodScore,
          suggestionLevel: picked.level.id,
          suggestions: picked.items,
        };
      });
      saveEntries(patched);
      return patched;
    });

  const markSuggestionScheduled = (entryObj, activityId, kind) => {
    if (!entryObj) return;
    patchEntryById(entryObj.id, {
      scheduledSuggestions: { ...(entryObj.scheduledSuggestions || {}), [activityId]: kind },
    });
  };

  // Start analyzing words/voice immediately while the user draws their Day Line.
  const startReflection = (answer) => {
    const contentPromise = analyzeContentState(answerText(answer));
    const voicePromise = answer.type === 'audio' ? analyzeVoiceState(answer.uri) : Promise.resolve(null);
    setDraft({ answer, startedAt: new Date().toISOString(), contentPromise, voicePromise });
  };

  const closeDay = (line) => {
    const baseEntry = {
      id: String(Date.now()),
      date: dayKey(),
      startedAt: draft.startedAt,
      finishedAt: new Date().toISOString(),
      answer: draft.answer,
      line,
      scheduledSuggestions: {},
    };
    const initialPick = suggestionsForEntry(baseEntry, { fallbackPhq9: profile.simulatedPhq9 });
    const entry = {
      ...baseEntry,
      moodScore: initialPick.moodScore,
      suggestionLevel: initialPick.level.id,
      suggestions: initialPick.items,
    };
    const next = upsertEntry(entries, entry, { keepEveryTry: __DEV__ && profile.keepEveryTry });
    updateEntries(next);
    const pendingContent = draft.contentPromise;
    const pendingVoice = draft.voicePromise;
    setDraft(null);
    setTab('reflection');

    // Merge word, voice, and Gemini Day Line scores as soon as each finishes, updating the suggestion tier.
    if (pendingVoice) {
      pendingVoice.then((voiceState) => voiceState && patchEntryWithSuggestions(entry.id, { voiceState }));
    }
    if (pendingContent) {
      pendingContent.then((contentState) => contentState && patchEntryWithSuggestions(entry.id, { contentState }));
    }
    scoreDayLine(line).then((dayScore) => {
      if (!dayScore) return;
      patchEntryWithSuggestions(entry.id, { dayScore });
    });
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
        onResetToday={
          today
            ? async () => {
                const cleaned = await removeTodayEntry(entries);
                setEntries(cleaned);
                setDraft(null);
                setSettingsOpen(false);
                setTab('reflection');
              }
            : undefined
        }
        onBack={() => setSettingsOpen(false)}
      />
    );
  } else if (draft) {
    // The day line is pushed on top of Reflection, so the tabs step aside.
    key = 'line';
    screen = (
      <DayLineScreen onSubmit={closeDay} onBack={() => setDraft(null)} onSettings={openSettings} />
    );
  } else if (tab === 'calendar') {
    key = 'calendar';
    nav = true;
    screen = (
      <CalendarScreen
        entries={entries}
        onLoadSample={() => updateEntries(sampleEntries(entries))}
        onScoreEntries={async (targetEntries) => {
          const results = await Promise.all(
            targetEntries.map(async (e) => ({ id: e.id, res: await scoreDayLineDetailed(e.line) }))
          );
          const map = new Map(results.filter((r) => r.res.ok).map((r) => [r.id, r.res.data]));
          if (map.size > 0) {
            setEntries((list) => {
              const nextList = list.map((e) => (map.has(e.id) ? { ...e, dayScore: map.get(e.id) } : e));
              saveEntries(nextList);
              return nextList;
            });
          }
          const firstErr = results.find((r) => !r.res.ok)?.res.error;
          return firstErr || null;
        }}
        onDeleteAll={async () => {
          await clearAllData();
          setEntries([]);
          setProfile(defaultProfile);
          setTab('reflection');
        }}
        onSettings={openSettings}
      />
    );
  } else if (today && !(__DEV__ && profile.keepEveryTry)) {
    key = 'reflection-done';
    nav = true;
    screen = (
      <SuggestionsScreen
        completedToday
        entry={today}
        score={profile.simulatedPhq9}
        onMarkScheduled={(activityId, kind) => markSuggestionScheduled(today, activityId, kind)}
        onSettings={openSettings}
      />
    );
  } else {
    key = 'reflection';
    nav = true;
    screen = (
      <ReflectionScreen
        onSubmit={startReflection}
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

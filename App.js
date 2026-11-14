import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import QuestionScreen from './src/screens/QuestionScreen';
import DrawScreen from './src/screens/DrawScreen';
import DoneScreen from './src/screens/DoneScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import { colors } from './src/theme';

// Today's question. Later this can come from a list / backend.
const QUESTION = 'How are you feeling right now, and what was the most important moment of your day?';

/**
 * Minimal screen switching with React state (no navigation library needed yet).
 * Flow: home -> question -> draw -> done -> home
 *       home -> analysis -> home
 */
export default function App() {
  const [screen, setScreen] = useState('home');
  const [draft, setDraft] = useState(null);      // answer being built during a test
  const [entries, setEntries] = useState([]);    // completed tests (in memory for now)

  const startTest = () => {
    setDraft({ question: QUESTION, startedAt: new Date().toISOString() });
    setScreen('question');
  };

  const saveAnswer = (answer) => {
    // answer = { type: 'text', text } | { type: 'audio', audioUri, durationMs }
    setDraft((d) => ({ ...d, answer }));
    setScreen('draw');
  };

  const saveDrawing = (moodLine) => {
    // moodLine = array of { t: 0..1 (time of day), mood: -1..1 }
    const entry = { ...draft, moodLine, finishedAt: new Date().toISOString(), id: String(Date.now()) };
    setEntries((list) => [entry, ...list]);
    setDraft(null);
    setScreen('done');
  };

  const goHome = () => {
    setDraft(null);
    setScreen('home');
  };

  let content;
  switch (screen) {
    case 'question':
      content = <QuestionScreen question={QUESTION} onSubmit={saveAnswer} onBack={goHome} />;
      break;
    case 'draw':
      content = <DrawScreen onSubmit={saveDrawing} onBack={() => setScreen('question')} />;
      break;
    case 'done':
      content = <DoneScreen entry={entries[0]} onHome={goHome} onAnalysis={() => setScreen('analysis')} />;
      break;
    case 'analysis':
      content = <AnalysisScreen entries={entries} onBack={goHome} />;
      break;
    default:
      content = <HomeScreen onTest={startTest} onAnalysis={() => setScreen('analysis')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
});

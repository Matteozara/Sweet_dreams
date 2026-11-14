import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BigButton from '../components/BigButton';
import MoodLinePreview from '../components/MoodLinePreview';
import { colors } from '../theme';

export default function DoneScreen({ entry, onHome, onAnalysis }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🌙</Text>
      <Text style={styles.title}>Thank you!</Text>
      <Text style={styles.subtitle}>Your check-in for today has been saved.</Text>
      {entry && (
        <View style={styles.card}>
          <MoodLinePreview points={entry.moodLine} />
        </View>
      )}
      <BigButton title="Back to home" onPress={onHome} style={{ alignSelf: 'stretch' }} />
      <BigButton title="See analysis" onPress={onAnalysis} outline color={colors.secondary} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 56 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 8 },
  subtitle: { color: colors.muted, marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
});

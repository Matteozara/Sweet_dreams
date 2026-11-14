import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import MoodLinePreview from '../components/MoodLinePreview';
import { colors } from '../theme';

// Placeholder analysis: lists past check-ins with their mood line and an average mood.
// Real analysis (trends, NLP on answers, speech features) can be plugged in here later.
function averageMood(points = []) {
  if (!points.length) return 0;
  return points.reduce((s, p) => s + p.mood, 0) / points.length;
}

export default function AnalysisScreen({ entries, onBack }) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Analysis</Text>

      {entries.length === 0 ? (
        <Text style={styles.empty}>No check-ins yet. Do a test first and your results will appear here.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const avg = averageMood(item.moodLine);
            return (
              <View style={styles.card}>
                <Text style={styles.date}>{new Date(item.finishedAt).toLocaleString()}</Text>
                <Text style={styles.answer} numberOfLines={3}>
                  {item.answer?.type === 'text'
                    ? `“${item.answer.text}”`
                    : `🎙️ Audio answer (${Math.round((item.answer?.durationMs ?? 0) / 1000)} s)`}
                </Text>
                <MoodLinePreview points={item.moodLine} />
                <Text style={[styles.avg, { color: avg >= 0 ? colors.good : colors.bad }]}>
                  Average mood: {(avg * 100).toFixed(0)} / 100
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  back: { color: colors.primary, fontSize: 17, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  answer: { color: colors.text, fontSize: 15, marginBottom: 10 },
  avg: { marginTop: 8, fontWeight: '600' },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BigButton from '../components/BigButton';
import { colors } from '../theme';

export default function HomeScreen({ onTest, onAnalysis }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sweet Dreams</Text>
        <Text style={styles.subtitle}>A small daily check-in with yourself</Text>
      </View>
      <View style={styles.buttons}>
        <BigButton title="Test" onPress={onTest} />
        <BigButton title="Analysis" onPress={onAnalysis} color={colors.secondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 56 },
  title: { fontSize: 40, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 8 },
  buttons: { width: '100%' },
});

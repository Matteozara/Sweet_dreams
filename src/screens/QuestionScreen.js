import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import BigButton from '../components/BigButton';
import { colors } from '../theme';

function formatMs(ms = 0) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function QuestionScreen({ question, onSubmit, onBack }) {
  const [mode, setMode] = useState('text'); // 'text' | 'audio'
  const [text, setText] = useState('');

  // --- audio recording ---
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [audioUri, setAudioUri] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  // --- playback of the recording ---
  const player = useAudioPlayer(audioUri);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    // When playback reaches the end, rewind so it can be replayed.
    if (playerStatus?.didJustFinish) {
      player.seekTo(0);
      player.pause();
    }
  }, [playerStatus?.didJustFinish]);

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access to record your answer.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      setAudioUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert('Could not start recording', String(e?.message ?? e));
    }
  };

  const stopRecording = async () => {
    try {
      const duration = recState.durationMillis;
      await recorder.stop();
      // Switch audio mode back so playback goes through the loudspeaker on iOS.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      setAudioDuration(duration);
      setAudioUri(recorder.uri);
    } catch (e) {
      Alert.alert('Could not stop recording', String(e?.message ?? e));
    }
  };

  const togglePlay = () => {
    if (playerStatus?.playing) player.pause();
    else player.play();
  };

  const canContinue = mode === 'text' ? text.trim().length > 0 : !!audioUri && !recState.isRecording;

  const submit = () => {
    if (mode === 'text') onSubmit({ type: 'text', text: text.trim() });
    else onSubmit({ type: 'audio', audioUri, durationMs: audioDuration });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>

        <Text style={styles.step}>Step 1 of 2</Text>
        <Text style={styles.question}>{question}</Text>

        {/* Choice: text or audio */}
        <View style={styles.toggle}>
          {['text', 'audio'].map((m) => (
            <Pressable
              key={m}
              onPress={() => !recState.isRecording && setMode(m)}
              style={[styles.toggleItem, mode === m && styles.toggleItemActive]}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'text' ? '✍️  Write' : '🎙️  Record'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'text' ? (
          <TextInput
            style={styles.input}
            multiline
            placeholder="Type your answer here…"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
        ) : (
          <View style={styles.audioCard}>
            <Text style={styles.timer}>
              {recState.isRecording ? formatMs(recState.durationMillis) : audioUri ? formatMs(audioDuration) : '0:00'}
            </Text>
            <Text style={styles.audioHint}>
              {recState.isRecording
                ? 'Recording… tap stop when you are done'
                : audioUri
                ? 'Recording saved. Listen back or record again.'
                : 'Tap the button and speak your answer'}
            </Text>

            <Pressable
              onPress={recState.isRecording ? stopRecording : startRecording}
              style={[styles.recButton, recState.isRecording && styles.recButtonActive]}
            >
              <View style={recState.isRecording ? styles.stopIcon : styles.recIcon} />
            </Pressable>

            {audioUri && !recState.isRecording && (
              <BigButton
                title={playerStatus?.playing ? 'Pause' : 'Play recording'}
                onPress={togglePlay}
                outline
                style={{ alignSelf: 'stretch' }}
              />
            )}
          </View>
        )}

        <BigButton title="Continue" onPress={submit} disabled={!canContinue} style={{ marginTop: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1 },
  back: { color: colors.primary, fontSize: 17, marginBottom: 16 },
  step: { color: colors.muted, fontSize: 14, marginBottom: 6 },
  question: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 24, lineHeight: 30 },
  toggle: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleItemActive: { backgroundColor: colors.card },
  toggleText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  toggleTextActive: { color: colors.text },
  input: {
    minHeight: 180,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  audioCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  timer: { fontSize: 40, fontWeight: '300', color: colors.text, fontVariant: ['tabular-nums'] },
  audioHint: { color: colors.muted, marginTop: 6, marginBottom: 20, textAlign: 'center' },
  recButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  recButtonActive: { backgroundColor: '#FCE8EB' },
  recIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger },
  stopIcon: { width: 30, height: 30, borderRadius: 6, backgroundColor: colors.danger },
});

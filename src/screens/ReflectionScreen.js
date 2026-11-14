import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Header } from '../components/Chrome';
import { GlassButton, PrimaryButton } from '../components/Buttons';
import Icon from '../components/Icon';
import { formatDuration } from '../line';
import { tap } from '../services';
import { colors, font, radius, type } from '../theme';

const BARS = 26;
const IDLE = [0.2, 0.3, 0.5, 0.8, 1, 0.65, 0.75, 0.4, 0.25];
const barColors = [colors.blue, colors.lilac, colors.lilacPale, colors.pink];

function Waveform({ levels, live }) {
  const shown = levels.length ? levels.slice(-BARS) : IDLE;
  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: 4 + v * 28,
              backgroundColor: barColors[i % barColors.length],
              opacity: levels.length ? (live ? 0.95 : 0.75) : 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Step one: "How was your day?" answered by voice, or by keyboard. */
export default function ReflectionScreen({ onSubmit }) {
  const [mode, setMode] = useState('voice'); // 'voice' | 'text'
  const [text, setText] = useState('');
  const [audio, setAudio] = useState(null); // { uri, durationMs }
  const [levels, setLevels] = useState([]);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 100);
  const recording = rec.isRecording;

  // Typing dynamics, kept alongside the text for later analysis.
  const typing = useRef({ startedAt: null, events: [], deletions: 0, last: 0 });

  // Breathing halo around the record orb.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const half = recording ? 700 : 1600;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording]);

  // Feed the waveform from the microphone level while recording.
  useEffect(() => {
    if (!recording) return;
    const db = rec.metering;
    const level =
      typeof db === 'number'
        ? Math.min(1, Math.max(0.05, (db + 55) / 55))
        : 0.25 + 0.45 * Math.abs(Math.sin(rec.durationMillis / 170));
    setLevels((l) => [...l.slice(-(BARS - 1)), level]);
  }, [rec.durationMillis]);

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone is off', 'Allow microphone access in Settings, or type instead.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      setAudio(null);
      setLevels([]);
      await recorder.prepareToRecordAsync();
      recorder.record();
      tap();
    } catch (e) {
      Alert.alert('Recording is unavailable', 'You can type instead.');
    }
  };

  const stop = async () => {
    try {
      const durationMs = rec.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setAudio({ uri: recorder.uri, durationMs });
      tap();
    } catch (e) {
      Alert.alert('Could not save the recording', 'Please try again, or type instead.');
    }
  };

  const onChangeText = (value) => {
    const now = Date.now();
    const t = typing.current;
    if (t.startedAt === null) t.startedAt = now;
    if (value.length < t.last) t.deletions += 1;
    t.last = value.length;
    if (t.events.length < 2000) t.events.push([now - t.startedAt, value.length]);
    setText(value);
  };

  const canContinue = mode === 'text' ? text.trim().length > 0 : !!audio && !recording;

  const submit = () => {
    if (mode === 'text') {
      const t = typing.current;
      onSubmit({
        type: 'text',
        text: text.trim(),
        typing: {
          durationMs: t.events.length ? t.events[t.events.length - 1][0] : 0,
          changes: t.events.length,
          deletions: t.deletions,
          events: t.events, // [ms since first key, text length]
        },
      });
    } else {
      onSubmit({ type: 'audio', uri: audio.uri, durationMs: audio.durationMs });
    }
  };

  const status = recording
    ? formatDuration(rec.durationMillis)
    : audio
    ? `${formatDuration(audio.durationMs)} recorded`
    : 'Tap to speak';

  return (
    <View style={styles.screen}>
      <Header chip="Evening Reflection" />
        {/* automaticallyAdjustKeyboardInsets uses the real keyboard frame, which
            KeyboardAvoidingView cannot do from inside a nested layout. */}
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View style={styles.eyebrowRow}>
              <View style={styles.dot} />
              <Text style={type.eyebrow}>TONIGHT</Text>
            </View>
            <Text style={[type.display, styles.question]}>How was your day?</Text>

            <View style={styles.card}>
              {mode === 'voice' ? (
                <>
                  <View style={styles.orbWrap}>
                    <Animated.View
                      style={[
                        styles.halo,
                        {
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
                          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
                        },
                      ]}
                    />
                    <View style={styles.ring} />
                    <Pressable
                      onPress={recording ? stop : start}
                      accessibilityRole="button"
                      accessibilityLabel={recording ? 'Stop recording' : audio ? 'Record again' : 'Record'}
                      style={({ pressed }) => [styles.orb, pressed && { transform: [{ scale: 0.95 }] }]}
                    >
                      <Icon name={recording ? 'stop' : 'mic'} size={recording ? 30 : 32} color={colors.lilacPale} />
                    </Pressable>
                  </View>
                  <View style={styles.waveWrap}>
                    <Waveform levels={levels} live={recording} />
                    <Text style={styles.status}>{status}</Text>
                  </View>
                  <GlassButton
                    small
                    title="Type instead"
                    disabled={recording}
                    onPress={() => setMode('text')}
                    icon={<Icon name="keyboard" size={16} color={colors.lilac} />}
                    style={recording && { opacity: 0.4 }}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    multiline
                    autoFocus
                    value={text}
                    onChangeText={onChangeText}
                    placeholder="Let it settle here."
                    placeholderTextColor={colors.faint}
                    selectionColor={colors.lilac}
                    textAlignVertical="top"
                  />
                  <GlassButton
                    small
                    title="Speak instead"
                    onPress={() => setMode('voice')}
                    icon={<Icon name="mic" size={16} color={colors.lilac} />}
                  />
                </>
              )}
            </View>
          </View>

          <PrimaryButton
            title="Draw Day Line"
            onPress={submit}
            disabled={!canContinue}
            iconRight={<Icon name="arrow" size={18} color={colors.ink} strokeWidth={2} />}
            style={styles.cta}
          />
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pink },
  question: { marginBottom: 32 },

  card: {
    backgroundColor: colors.glassStrong,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 32,
    alignItems: 'center',
    gap: 28,
  },
  orbWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(212,187,255,0.28)' },
  ring: { position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(241,181,215,0.3)' },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#221f36',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: colors.lilac,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  waveWrap: { alignItems: 'center', gap: 10 },
  wave: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bar: { width: 4, borderRadius: 2 },
  status: { fontFamily: font.medium, fontSize: 12, letterSpacing: 0.3, color: colors.muted, fontVariant: ['tabular-nums'] },

  input: {
    alignSelf: 'stretch',
    minHeight: 190,
    padding: 0,
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 27,
    color: colors.text,
    borderRadius: radius.md,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  cta: { marginTop: 32 },
});

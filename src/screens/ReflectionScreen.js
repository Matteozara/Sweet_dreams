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
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { Header } from '../components/Chrome';
import { GlassButton, PrimaryButton } from '../components/Buttons';
import Icon from '../components/Icon';
import { formatDuration } from '../line';
import { tap } from '../services';
import { createTranscriber, transcriptionAvailable } from '../transcribe';
import { colors, font, radius, type } from '../theme';

const BARS = 26;
const IDLE = [0.2, 0.3, 0.5, 0.8, 1, 0.65, 0.75, 0.4, 0.25];
const barColors = [colors.blue, colors.lilac, colors.lilacPale, colors.pink];

/**
 * Waveform and timer. They update themselves through `feed` so that the ten
 * updates a second while recording never re-render the rest of the screen:
 * a slow render there would back up the microphone buffers and delay the words.
 */
function Meter({ feed, recording, idleStatus }) {
  const [levels, setLevels] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    feed.current = {
      push: (level, ms) => {
        setLevels((l) => [...l.slice(-(BARS - 1)), level]);
        setElapsed(ms);
      },
      reset: () => {
        setLevels([]);
        setElapsed(0);
      },
    };
    return () => {
      feed.current = null;
    };
  }, []);
  const shown = levels.length ? levels : IDLE;
  return (
    <View style={styles.waveWrap}>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {shown.map((v, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 4 + v * 28,
                backgroundColor: barColors[i % barColors.length],
                opacity: levels.length ? (recording ? 0.95 : 0.75) : 0.35,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.status}>{recording ? formatDuration(elapsed) : idleStatus}</Text>
    </View>
  );
}

/**
 * The live transcript. Also self-updating, for the same reason as the meter.
 * Once recording has stopped it turns into a text field, so mistakes can be corrected.
 */
function Words({ feed, recording, visible, debug, editable, onEdit }) {
  const [words, setWords] = useState({ final: '', interim: '' });
  const [info, setInfo] = useState('');
  const scroll = useRef(null);
  useEffect(() => {
    feed.current = setWords;
    return () => {
      feed.current = null;
    };
  }, []);
  // Development read-out: where the time goes between the microphone and the words.
  useEffect(() => {
    if (!__DEV__ || !recording) return;
    const id = setInterval(() => setInfo(debug()), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const has = !!(words.final || words.interim);
  if (!visible || !(recording || has || editable)) return null;
  if (editable) {
    return (
      <TextInput
        style={styles.wordsInput}
        multiline
        scrollEnabled
        value={[words.final, words.interim].filter(Boolean).join(' ')}
        onChangeText={(value) => {
          setWords({ final: value, interim: '' });
          onEdit(value);
        }}
        placeholder="Add your words."
        placeholderTextColor={colors.faint}
        selectionColor={colors.lilac}
        textAlignVertical="top"
        accessibilityLabel="What you said. Edit to correct it."
      />
    );
  }
  return (
    <>
      <ScrollView
        ref={scroll}
        style={styles.words}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        accessibilityLiveRegion="polite"
      >
        {has ? (
          <Text style={styles.wordsText}>
            {words.final}
            {words.final && words.interim ? ' ' : ''}
            <Text style={styles.wordsInterim}>{words.interim}</Text>
          </Text>
        ) : (
          <Text style={[styles.wordsText, styles.wordsInterim]}>Listening…</Text>
        )}
      </ScrollView>
      {__DEV__ && !!info && <Text style={styles.debug}>{info}</Text>}
    </>
  );
}

/** Step one: "How was your day?" answered by voice, or by keyboard. */
export default function ReflectionScreen({ onSubmit, onSettings }) {
  const [mode, setMode] = useState('voice'); // 'voice' | 'text'
  const [text, setText] = useState('');
  const [audio, setAudio] = useState(null); // { uri, durationMs }

  const [recording, setRecording] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const live = useRef(false);
  const lastTick = useRef(0);
  const transcriber = useRef(null);
  const meter = useRef(null); // Meter's feed
  const wordsFeed = useRef(null); // Words' feed
  const words = useRef({ final: '', interim: '' }); // latest transcript, for submit
  const heard = useRef(''); // the transcript as recognised, before any correction
  const clock = useRef({ startedAt: 0, audioMs: 0 });
  const onWords = (w) => {
    words.current = w;
    wordsFeed.current?.(w);
  };
  const debug = () => {
    const s = transcriber.current?.stats();
    if (!s) return '';
    const sec = (ms) => (ms == null ? '–' : (ms / 1000).toFixed(1) + 's');
    // lag: how far the audio we have handled is behind the wall clock.
    const lag = Date.now() - clock.current.startedAt - clock.current.audioMs;
    return `link ${sec(s.readyMs)} · lag ${sec(lag)} · sent ${s.sent} · queued ${s.queued} · in ${s.received}${s.closed ? ' · closed' : ''}`;
  };

  // Raw microphone audio: written to a WAV file, metered for the waveform,
  // and streamed to the transcriber, all from the same buffers.
  const onBuffer = (buffer) => {
    if (!live.current) return;
    let samples = new Int16Array(buffer.data);
    if (buffer.channels > 1) samples = samples.filter((_, i) => i % buffer.channels === 0);
    transcriber.current?.send({ data: samples.buffer, sampleRate: buffer.sampleRate });

    const ms = buffer.timestamp * 1000;
    clock.current.audioMs = ms + (samples.length / buffer.sampleRate) * 1000;
    if (ms - lastTick.current < 120) return;
    lastTick.current = ms;
    let sum = 0;
    for (let i = 0; i < samples.length; i += 4) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, samples.length / 4)) / 32768;
    const db = 20 * Math.log10(rms || 1e-6);
    if (meteringLog.current.length < 3000) {
      meteringLog.current.push([Math.round(ms), Math.round(db * 10) / 10]);
    }
    meter.current?.push(Math.min(1, Math.max(0.05, (db + 55) / 55)), ms);
  };
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16', onBuffer });

  useEffect(() => () => transcriber.current?.close(), []);

  // Typing dynamics & audio metering, kept alongside the reflection for v2 analysis.
  const typing = useRef({ startedAt: null, events: [], keystrokes: [], deletions: 0, last: 0 });
  const meteringLog = useRef([]);

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

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone is off', 'Allow microphone access in Settings, or type instead.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      setAudio(null);
      meteringLog.current = [];
      meter.current?.reset();
      onWords({ final: '', interim: '' });
      lastTick.current = 0;
      transcriber.current?.close();
      transcriber.current = createTranscriber({ onText: onWords });
      await stream.start();
      clock.current = { startedAt: Date.now(), audioMs: 0 };
      // Not available on web: there we keep the transcript only.
      await stream.startFileRecordingAsync().catch(() => {});
      live.current = true;
      setRecording(true);
      tap();
    } catch (e) {
      transcriber.current?.close();
      Alert.alert('Recording is unavailable', 'You can type instead.');
    }
  };

  const stop = async () => {
    live.current = false;
    setRecording(false);
    setFinishing(true);
    try {
      const file = await stream.stopFileRecordingAsync().catch(() => null);
      stream.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      setAudio({
        uri: file?.uri ?? null,
        durationMs: file ? Math.round(file.duration * 1000) : Math.round(clock.current.audioMs),
        metering: meteringLog.current,
      });
      tap();
      // Give the last words a moment to arrive before the answer can be submitted.
      await transcriber.current?.finish();
      heard.current = [words.current.final, words.current.interim].filter(Boolean).join(' ').trim();
    } catch (e) {
      Alert.alert('Could not save the recording', 'Please try again, or type instead.');
    } finally {
      setFinishing(false);
    }
  };

  const onChangeText = (value) => {
    const now = Date.now();
    const t = typing.current;
    if (t.startedAt === null) t.startedAt = now;
    const dt = now - t.startedAt;
    const isDelete = value.length < t.last;
    if (isDelete) t.deletions += 1;
    // Store only timing and key category ('char' | 'backspace' | 'other') — never the character itself.
    let category = 'char';
    if (isDelete) {
      category = 'backspace';
    } else if (value.length > t.last) {
      const ch = value.slice(-1);
      if (ch === ' ' || ch === '\n') category = 'other';
    }
    t.last = value.length;
    if (t.events.length < 2000) t.events.push([dt, value.length]);
    if (t.keystrokes.length < 2000) t.keystrokes.push([dt, category]);
    setText(value);
  };

  const canContinue = mode === 'text' ? text.trim().length > 0 : !!audio && !recording && !finishing;

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
          keystrokes: t.keystrokes, // [ms since first key, category]
        },
      });
    } else {
      const transcript = [words.current.final, words.current.interim].filter(Boolean).join(' ').trim();
      onSubmit({
        type: 'audio',
        uri: audio.uri,
        durationMs: audio.durationMs,
        transcript,
        // Kept only when the user corrected the text: what recognition originally heard.
        ...(transcript !== heard.current && { transcriptHeard: heard.current }),
        metering: audio.metering || [],
        audioSource: Platform.OS === 'ios' ? 'AVAudioSession.measurement' : 'MediaRecorder',
      });
    }
  };

  const idleStatus = audio ? `${formatDuration(audio.durationMs)} recorded` : 'Tap to speak';

  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
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
                  <Meter feed={meter} recording={recording} idleStatus={idleStatus} />
                  {transcriptionAvailable && (
                    <Words
                      feed={wordsFeed}
                      recording={recording}
                      visible={showWords}
                      debug={debug}
                      editable={!!audio && !recording && !finishing}
                      onEdit={(value) => (words.current = { final: value, interim: '' })}
                    />
                  )}
                  <View style={styles.pills}>
                    <GlassButton
                      small
                      title="Type instead"
                      disabled={recording}
                      onPress={() => setMode('text')}
                      icon={<Icon name="keyboard" size={16} color={colors.lilac} />}
                      style={recording && { opacity: 0.4 }}
                    />
                    {transcriptionAvailable && (
                      <GlassButton
                        small
                        title={showWords ? 'Hide words' : 'Show words'}
                        onPress={() => setShowWords((v) => !v)}
                      />
                    )}
                  </View>
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
  words: { alignSelf: 'stretch', maxHeight: 132, flexGrow: 0 },
  wordsText: { fontFamily: font.regular, fontSize: 16, lineHeight: 26, color: colors.text, textAlign: 'center' },
  wordsInput: {
    alignSelf: 'stretch',
    maxHeight: 156,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(14,13,26,0.45)',
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  wordsInterim: { color: colors.faint },
  debug: { fontFamily: font.regular, fontSize: 10, color: colors.faint, textAlign: 'center', marginTop: -16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
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

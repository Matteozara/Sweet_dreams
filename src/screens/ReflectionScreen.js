import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
} from 'expo-audio';
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

/** Safely extract signed 16-bit mono PCM samples from ArrayBuffer, TypedArray, or Float32 data. */
function extractInt16Mono(buffer) {
  const raw = buffer?.data;
  if (!raw) return null;
  const channels = Math.max(1, buffer.channels || 1);

  let mono;
  if (raw instanceof Float32Array) {
    const len = Math.floor(raw.length / channels);
    mono = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, raw[i * channels]));
      mono[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return mono;
  }

  let view;
  if (raw instanceof Int16Array) {
    view = raw;
  } else if (ArrayBuffer.isView(raw)) {
    const evenBytes = raw.byteLength - (raw.byteLength % 2);
    if (evenBytes <= 0) return null;
    view = new Int16Array(raw.buffer, raw.byteOffset, evenBytes / 2);
  } else if (raw instanceof ArrayBuffer) {
    const evenBytes = raw.byteLength - (raw.byteLength % 2);
    if (evenBytes <= 0) return null;
    view = new Int16Array(raw, 0, evenBytes / 2);
  } else {
    return null;
  }

  if (channels === 1) return view;
  const len = Math.floor(view.length / channels);
  mono = new Int16Array(len);
  for (let i = 0; i < len; i++) mono[i] = view[i * channels];
  return mono;
}

/** Downsample signed 16-bit mono PCM to 16 kHz for low-latency speech recognition. */
function resampleTo16k(samples, inputRate) {
  if (!samples?.length || !inputRate || inputRate === 16000) return samples;
  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = samples[Math.min(samples.length - 1, Math.floor(i * ratio))];
  }
  return out;
}

/**
 * Waveform and wall-clock timer.
 * Uses wall-clock `Date.now()` for elapsed time so the counter always advances
 * smoothly (`0:00 -> 0:01 -> 0:02...`) regardless of native audio hostTime units.
 */
function Meter({ feed, recording, startedAtRef, idleStatus }) {
  const [levels, setLevels] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const lastPushAt = useRef(0);

  useEffect(() => {
    feed.current = {
      push: (level, ms) => {
        lastPushAt.current = Date.now();
        setLevels((l) => [...l.slice(-(BARS - 1)), level]);
        if (typeof ms === 'number' && ms >= 0) setElapsed(ms);
      },
      reset: () => {
        lastPushAt.current = 0;
        setLevels([]);
        setElapsed(0);
      },
    };
    return () => {
      feed.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const tick = () => {
      const now = Date.now();
      const base = startedAtRef.current || now;
      setElapsed(Math.max(0, now - base));
      // Keep a gentle living motion during mic session warm-up before buffers arrive
      if (now - lastPushAt.current > 220) {
        const gentle = 0.12 + 0.1 * Math.abs(Math.sin(now / 170));
        setLevels((l) => [...l.slice(-(BARS - 1)), gentle]);
      }
    };
    tick();
    const id = setInterval(tick, 140);
    return () => clearInterval(id);
  }, [recording]);

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
                opacity: recording ? 0.95 : levels.length ? 0.75 : 0.35,
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
 * The live transcript. Self-updating while speaking; turns into an editable
 * text field once recording stops so recognition mistakes can be corrected.
 */
function Words({ feed, recording, finishing, visible, debug, editable, onEdit }) {
  const [words, setWords] = useState({ final: '', interim: '' });
  const [info, setInfo] = useState('');
  const scroll = useRef(null);
  useEffect(() => {
    feed.current = setWords;
    return () => {
      feed.current = null;
    };
  }, []);

  useEffect(() => {
    if (!__DEV__ || !recording) return;
    const id = setInterval(() => setInfo(debug()), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const has = !!(words.final || words.interim);
  if (!visible || !(recording || finishing || has || editable)) return null;

  if (!transcriptionAvailable) {
    if (!__DEV__) return null;
    return (
      <Text style={[styles.wordsText, styles.wordsInterim]}>
        Restart ./run.sh --clear to load EXPO_PUBLIC_GEMINI_API_KEY from .env
      </Text>
    );
  }

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
          <Text style={[styles.wordsText, styles.wordsInterim]}>
            {finishing ? 'Transcribing…' : 'Listening…'}
          </Text>
        )}
      </ScrollView>
      {__DEV__ && !!info && <Text style={styles.debug}>{info}</Text>}
    </>
  );
}

/** Step one: "How did you feel today?" answered by voice, or by keyboard. */
export default function ReflectionScreen({ onSubmit, onSettings }) {
  const [mode, setMode] = useState('voice'); // 'voice' | 'text'
  const [text, setText] = useState('');
  const [audio, setAudio] = useState(null); // { uri, durationMs }

  const [recording, setRecording] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const live = useRef(false);
  const busyRef = useRef(false);
  const lastTick = useRef(-1000);
  const buffersSeen = useRef(0);
  const usingFallbackRecorder = useRef(false);
  const fallbackPollRef = useRef(null);
  const fallbackWatchdogRef = useRef(null);
  const webSessionRef = useRef(null);

  const startedAtWallRef = useRef(0);
  const shouldStopOnRelease = useRef(false);

  const transcriber = useRef(null);
  const meter = useRef(null); // Meter's feed
  const wordsFeed = useRef(null); // Words' feed
  const words = useRef({ final: '', interim: '' }); // latest transcript, for submit
  const heard = useRef(''); // the transcript as recognised, before any correction
  const clock = useRef({ startedAt: 0, audioMs: 0 });

  // Reanimated shared values for 60fps microphone orb & voice-reactive rings
  const breath = useSharedValue(0);
  const voiceBoost = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(breath);
    breath.set(0);
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: recording ? 650 : 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: recording ? 650 : 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
    if (!recording) {
      voiceBoost.set(withTiming(0, { duration: 240 }));
    }
  }, [recording]);

  const haloStyle = useAnimatedStyle(() => {
    const b = breath.get();
    const v = voiceBoost.get();
    const baseScale = recording ? 1.08 + b * 0.24 + v * 0.26 : 1 + b * 0.12;
    const baseOpacity = recording ? 0.36 + b * 0.3 + v * 0.28 : 0.22 + b * 0.22;
    return {
      opacity: Math.min(0.95, baseOpacity),
      transform: [{ scale: baseScale }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const b = breath.get();
    const v = voiceBoost.get();
    const scale = recording ? 1.02 + (1 - b) * 0.16 + v * 0.28 : 1 + b * 0.05;
    const opacity = recording ? 0.42 + (1 - b) * 0.25 + v * 0.3 : 0.28;
    return {
      opacity: Math.min(0.95, opacity),
      transform: [{ scale }],
    };
  });

  const micIconStyle = useAnimatedStyle(() => {
    const b = breath.get();
    const v = voiceBoost.get();
    const scale = recording ? 1 + b * 0.06 + v * 0.18 : 1;
    return { transform: [{ scale }] };
  });

  const onWords = (w) => {
    words.current = w;
    wordsFeed.current?.(w);
  };

  const debug = () => {
    const s = transcriber.current?.stats();
    if (!s) return '';
    const sec = (ms) => (ms == null ? '–' : (ms / 1000).toFixed(1) + 's');
    return `${s.mode || 'ws'} · link ${sec(s.readyMs)} · sent ${s.sent} · queued ${s.queued} · in ${s.received}${s.closed ? ' · closed' : ''}`;
  };

  // Raw microphone audio: metered for the waveform & mic animation, and streamed to the transcriber.
  const onBuffer = (buffer) => {
    if (!live.current) return;
    const mono = extractInt16Mono(buffer);
    if (!mono?.length) return;
    buffersSeen.current += 1;

    const sr = buffer.sampleRate || 16000;
    const pcm16k = resampleTo16k(mono, sr);
    const pcmCopy = pcm16k.buffer.slice(pcm16k.byteOffset, pcm16k.byteOffset + pcm16k.byteLength);
    transcriber.current?.send({ data: pcmCopy, sampleRate: 16000 });

    const now = Date.now();
    const ms = Math.max(0, now - (clock.current.startedAt || now));
    clock.current.audioMs = ms;
    if (ms - lastTick.current < 85) return;
    lastTick.current = ms;

    let sum = 0;
    const step = Math.max(1, Math.floor(mono.length / 256));
    let count = 0;
    for (let i = 0; i < mono.length; i += step) {
      sum += mono[i] * mono[i];
      count += 1;
    }
    const rms = Math.sqrt(sum / Math.max(1, count)) / 32768;
    const db = 20 * Math.log10(rms || 1e-6);
    if (meteringLog.current.length < 3000) {
      meteringLog.current.push([Math.round(ms), Math.round(db * 10) / 10]);
    }
    const normLevel = Math.min(1, Math.max(0.08, (db + 55) / 52));
    voiceBoost.set(withSpring(normLevel, { damping: 14, stiffness: 220 }));
    meter.current?.push(normLevel, ms);
  };

  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16', onBuffer });
  const fallbackRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const cleanupTimers = () => {
    if (fallbackWatchdogRef.current) {
      clearTimeout(fallbackWatchdogRef.current);
      fallbackWatchdogRef.current = null;
    }
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    }
  };

  useEffect(
    () => () => {
      cleanupTimers();
      transcriber.current?.close();
    },
    []
  );

  // Typing dynamics & audio metering, kept alongside the reflection for v2 analysis.
  const typing = useRef({ startedAt: null, events: [], keystrokes: [], deletions: 0, last: 0 });
  const meteringLog = useRef([]);

  const startWebAudioSession = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Web microphone unavailable');
    }
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(mediaStream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (ev) => {
      if (!live.current) return;
      const input = ev.inputBuffer.getChannelData(0);
      onBuffer({ data: new Float32Array(input), sampleRate: ctx.sampleRate, channels: 1 });
    };
    source.connect(processor);
    processor.connect(ctx.destination);

    let mediaRecorder = null;
    const chunks = [];
    if (typeof MediaRecorder !== 'undefined') {
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data?.size > 0) chunks.push(ev.data);
      };
      mediaRecorder.start();
    }

    // Also use browser SpeechRecognition on web if available and no words arrived yet
    let speechRec = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && !transcriptionAvailable) {
      try {
        speechRec = new SR();
        speechRec.continuous = true;
        speechRec.interimResults = true;
        speechRec.onresult = (ev) => {
          let fin = '';
          let inter = '';
          for (let i = 0; i < ev.results.length; i++) {
            const txt = ev.results[i][0]?.transcript || '';
            if (ev.results[i].isFinal) fin += (fin ? ' ' : '') + txt.trim();
            else inter += (inter ? ' ' : '') + txt;
          }
          onWords({ final: fin, interim: inter });
        };
        speechRec.start();
      } catch {}
    }

    webSessionRef.current = { mediaStream, ctx, source, processor, mediaRecorder, chunks, speechRec };
  };

  const stopWebAudioSession = async () => {
    const sess = webSessionRef.current;
    webSessionRef.current = null;
    if (!sess) return null;
    try {
      sess.speechRec?.stop();
    } catch {}
    try {
      sess.processor.disconnect();
      sess.source.disconnect();
      await sess.ctx.close();
    } catch {}

    let blobUri = null;
    if (sess.mediaRecorder && sess.mediaRecorder.state !== 'inactive') {
      blobUri = await new Promise((resolve) => {
        sess.mediaRecorder.onstop = () => {
          const blob = new Blob(sess.chunks, { type: sess.mediaRecorder.mimeType || 'audio/webm' });
          resolve(blob.size > 0 ? URL.createObjectURL(blob) : null);
        };
        sess.mediaRecorder.stop();
      });
    }
    sess.mediaStream.getTracks().forEach((t) => t.stop());
    return blobUri;
  };

  const start = async () => {
    if (busyRef.current || live.current) return;
    busyRef.current = true;
    try {
      if (Platform.OS !== 'web') {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Microphone is off', 'Allow microphone access in Settings, or type instead.');
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }

      cleanupTimers();
      setAudio(null);
      meteringLog.current = [];
      buffersSeen.current = 0;
      usingFallbackRecorder.current = false;
      meter.current?.reset();
      onWords({ final: '', interim: '' });
      lastTick.current = -1000;

      transcriber.current?.close();
      transcriber.current = createTranscriber({ onText: onWords });

      const now = Date.now();
      startedAtWallRef.current = now;
      clock.current = { startedAt: now, audioMs: 0 };
      live.current = true;
      setRecording(true);
      tap();

      if (Platform.OS === 'web' || !stream) {
        await startWebAudioSession();
      } else {
        await stream.start();
        await stream.startFileRecordingAsync().catch(() => {});

        // Safety watchdog: if AudioStream emits 0 buffers within 700ms on a device,
        // seamlessly switch to AudioRecorder with live dB metering + file transcription.
        fallbackWatchdogRef.current = setTimeout(async () => {
          if (!live.current || buffersSeen.current > 0) return;
          try {
            usingFallbackRecorder.current = true;
            try {
              await stream.stopFileRecordingAsync().catch(() => null);
              stream.stop();
            } catch {}
            await fallbackRecorder.prepareToRecordAsync();
            fallbackRecorder.record();
            fallbackPollRef.current = setInterval(() => {
              if (!live.current) return;
              const st = fallbackRecorder.getStatus?.() || {};
              const nowMs = Date.now() - (clock.current.startedAt || Date.now());
              clock.current.audioMs = nowMs;
              const db = typeof st.metering === 'number' ? st.metering : -38 + 14 * Math.abs(Math.sin(nowMs / 160));
              if (meteringLog.current.length < 3000) {
                meteringLog.current.push([Math.round(nowMs), Math.round(db * 10) / 10]);
              }
              const normLevel = Math.min(1, Math.max(0.08, (db + 55) / 52));
              voiceBoost.set(withSpring(normLevel, { damping: 14, stiffness: 220 }));
              meter.current?.push(normLevel, nowMs);
            }, 100);
          } catch {}
        }, 700);
      }
    } catch (e) {
      live.current = false;
      setRecording(false);
      cleanupTimers();
      transcriber.current?.close();
      Alert.alert('Recording is unavailable', 'You can type instead.');
    } finally {
      busyRef.current = false;
    }
  };

  const stop = async () => {
    if (!live.current || busyRef.current) return;
    busyRef.current = true;
    live.current = false;
    cleanupTimers();
    setRecording(false);
    setFinishing(true);

    const wallDurationMs = Math.max(0, Date.now() - (startedAtWallRef.current || Date.now()));
    try {
      let uri = null;
      let durationMs = wallDurationMs;

      if (Platform.OS === 'web' || !stream) {
        uri = await stopWebAudioSession();
      } else if (usingFallbackRecorder.current) {
        await fallbackRecorder.stop().catch(() => {});
        uri = fallbackRecorder.uri ?? null;
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      } else {
        const file = await stream.stopFileRecordingAsync().catch(() => null);
        stream.stop();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        uri = file?.uri ?? null;
        if (file?.duration > 0) durationMs = Math.round(file.duration * 1000);
      }

      setAudio({
        uri,
        durationMs: Math.max(durationMs, wallDurationMs),
        metering: meteringLog.current,
      });
      tap();

      await transcriber.current?.finish({ fileUri: uri });
      heard.current = [words.current.final, words.current.interim].filter(Boolean).join(' ').trim();
    } catch (e) {
      Alert.alert('Could not save the recording', 'Please try again, or type instead.');
    } finally {
      setFinishing(false);
      busyRef.current = false;
    }
  };

  const resetToInitialVoice = () => {
    transcriber.current?.close();
    setAudio(null);
    meteringLog.current = [];
    heard.current = '';
    meter.current?.reset();
    onWords({ final: '', interim: '' });
    tap();
  };

  // Supports both tap-to-record/tap-to-stop AND press-and-hold-to-record seamlessly.
  const handleOrbPressIn = () => {
    if (finishing) return;
    if (recording) {
      shouldStopOnRelease.current = true;
      return;
    }
    if (audio) return;
    shouldStopOnRelease.current = false;
    start();
  };

  const handleOrbPressOut = () => {
    if (shouldStopOnRelease.current) {
      shouldStopOnRelease.current = false;
      stop();
      return;
    }
    // If the user held the button down while speaking (>= 650 ms), stop automatically on release
    if (live.current && startedAtWallRef.current > 0 && Date.now() - startedAtWallRef.current >= 650) {
      stop();
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
        ...(transcript !== heard.current && { transcriptHeard: heard.current }),
        metering: audio.metering || [],
        audioSource: Platform.OS === 'ios' ? 'AVAudioSession.measurement' : 'MediaRecorder',
      });
    }
  };

  const recordedDone = !!audio && !recording && !finishing;
  const idleStatus = finishing
    ? 'Finishing…'
    : audio
      ? `${formatDuration(audio.durationMs)} recorded`
      : 'Tap or hold to speak';

  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        scrollEnabled={!recording}
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
          <Text style={[type.display, styles.question]}>How did you feel today?</Text>

          <View style={styles.card}>
            {mode === 'voice' ? (
              <>
                <View style={styles.orbWrap}>
                  <Animated.View style={[styles.halo, recording && styles.haloLive, haloStyle]} />
                  <Animated.View style={[styles.ring, recording && styles.ringLive, ringStyle]} />
                  <Pressable
                    onPressIn={handleOrbPressIn}
                    onPressOut={handleOrbPressOut}
                    disabled={recordedDone}
                    accessibilityRole="button"
                    accessibilityLabel={recording ? 'Stop recording' : audio ? 'Audio recorded' : 'Record'}
                    style={({ pressed }) => [
                      styles.orb,
                      recording && styles.orbLive,
                      pressed && !recordedDone && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    <Animated.View style={micIconStyle}>
                      <Icon
                        name={recording ? 'stop' : 'mic'}
                        size={recording ? 30 : 32}
                        color={recording ? colors.pink : colors.lilacPale}
                      />
                    </Animated.View>
                  </Pressable>
                </View>
                <Meter
                  feed={meter}
                  recording={recording}
                  startedAtRef={startedAtWallRef}
                  idleStatus={idleStatus}
                />
                <Words
                  feed={wordsFeed}
                  recording={recording}
                  finishing={finishing}
                  visible={showWords}
                  debug={debug}
                  editable={recordedDone && transcriptionAvailable}
                  onEdit={(value) => (words.current = { final: value, interim: '' })}
                />
                <View style={styles.pills}>
                  {recordedDone ? (
                    <GlassButton
                      small
                      title="Record audio again"
                      onPress={resetToInitialVoice}
                      icon={<Icon name="mic" size={16} color={colors.lilac} />}
                    />
                  ) : (
                    <>
                      <GlassButton
                        small
                        title="Type instead"
                        disabled={recording || finishing}
                        onPress={() => setMode('text')}
                        icon={<Icon name="keyboard" size={16} color={colors.lilac} />}
                        style={(recording || finishing) && { opacity: 0.4 }}
                      />
                      {transcriptionAvailable && (
                        <GlassButton
                          small
                          title={showWords ? 'Hide words' : 'Show words'}
                          onPress={() => setShowWords((v) => !v)}
                        />
                      )}
                    </>
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
  orbWrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(212,187,255,0.28)',
  },
  haloLive: {
    backgroundColor: 'rgba(241,181,215,0.34)',
  },
  ring: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(241,181,215,0.28)',
  },
  ringLive: {
    backgroundColor: 'rgba(212,187,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(241,181,215,0.55)',
  },
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
  orbLive: {
    borderColor: 'rgba(241,181,215,0.75)',
    backgroundColor: '#2a223e',
    shadowColor: colors.pink,
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
  liveDot: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pink,
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

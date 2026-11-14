import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import Moon from '../components/Moon';
import { colors, font, motion } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A deeper wash than the app-wide Backdrop: the opening screen carries more
 * colour than the screens you work in, and settles back once you are inside.
 */
function SplashBackdrop() {
  const blob = (id, color, opacity, cx, cy, rx, ry) => (
    <React.Fragment key={id}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.42} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </React.Fragment>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={400} height={800} fill={colors.bg} />
        {blob('sp1', colors.lilac, 0.3, 60, 90, 300, 280)}
        {blob('sp2', colors.pink, 0.2, 420, 360, 280, 300)}
        {blob('sp3', colors.blueDim, 0.18, 120, 720, 300, 250)}
        {blob('sp4', colors.lilac, 0.12, 330, 690, 240, 200)}
      </Svg>
    </View>
  );
}

/**
 * The opening screen, shown on every launch. It waits: `onDone` fires only
 * when the screen is tapped, anywhere, never on a timer.
 */
export default function SplashScreen({ onDone }) {
  const reduced = useReducedMotion();
  const moon = useSharedValue(reduced ? 1 : 0);
  const word = useSharedValue(reduced ? 1 : 0);
  const hint = useSharedValue(reduced ? 0.55 : 0);

  useEffect(() => {
    if (reduced) return;
    moon.set(withTiming(1, { duration: 700, easing: EASE_OUT }));
    word.set(withDelay(420, withTiming(1, { duration: motion.slow, easing: EASE_OUT })));
    // the hint breathes, slowly, so it reads as waiting rather than stuck
    hint.set(
      withDelay(
        1100,
        withRepeat(
          withSequence(
            withTiming(0.55, { duration: 1400, easing: EASE_OUT }),
            withTiming(0.22, { duration: 1400, easing: EASE_OUT })
          ),
          -1,
          true
        )
      )
    );
  }, []);

  const moonStyle = useAnimatedStyle(() => ({
    opacity: moon.get(),
    // never from nothing: 0.94 -> 1, so it settles rather than pops
    transform: [{ scale: 0.94 + moon.get() * 0.06 }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.get(),
    transform: [{ translateY: (1 - word.get()) * 8 }],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.get() }));

  return (
    <Pressable
      style={styles.root}
      onPress={onDone}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <SplashBackdrop />
      <View style={styles.center}>
        <Animated.View style={moonStyle}>
          <Moon />
        </Animated.View>

        <Animated.View style={wordStyle}>
          <Text style={styles.wordmark}>Sweet Dreams</Text>
          <Text style={styles.tagline}>Draw a line under today.</Text>
        </Animated.View>
      </View>

      <Animated.Text style={[styles.hint, hintStyle]}>Continue</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  wordmark: {
    fontFamily: font.semibold,
    fontSize: 34,
    letterSpacing: -0.6,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.lilacPale,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.85,
  },
  hint: {
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.faint,
    textAlign: 'center',
    marginBottom: 52,
  },
});

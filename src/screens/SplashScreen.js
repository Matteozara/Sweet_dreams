import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import Moon from '../components/Moon';
import { colors, font, motion } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The splash, shown on every launch: the sleeping moon settles in, then the
 * name and the line underneath it. It calls `onDone` when the animation
 * finishes — App keeps it on screen until the stored profile has loaded too.
 */
export default function SplashScreen({ onDone }) {
  const reduced = useReducedMotion();
  const moon = useSharedValue(reduced ? 1 : 0);
  const word = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(t);
    }
    moon.set(withTiming(1, { duration: 700, easing: EASE_OUT }));
    word.set(withDelay(420, withTiming(1, { duration: motion.slow, easing: EASE_OUT })));
    const t = setTimeout(() => onDone?.(), 1700);
    return () => clearTimeout(t);
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

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={moonStyle}>
          <Moon />
        </Animated.View>

        <Animated.View style={wordStyle}>
          <Text style={styles.wordmark}>Sweet Dreams</Text>
          <Text style={styles.tagline}>Draw a line under today.</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: font.semibold,
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.text,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});

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
import { PrimaryButton } from '../components/Buttons';
import { colors, font, motion } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The opening screen, shown on every launch: the sleeping moon settles in,
 * then the name and the way in. It waits for a tap — `onDone` is only called
 * when the button is pressed, never on a timer.
 */
export default function SplashScreen({ onDone }) {
  const reduced = useReducedMotion();
  const moon = useSharedValue(reduced ? 1 : 0);
  const word = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    moon.set(withTiming(1, { duration: 700, easing: EASE_OUT }));
    word.set(withDelay(420, withTiming(1, { duration: motion.slow, easing: EASE_OUT })));
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

        <Animated.View style={[styles.below, wordStyle]}>
          <Text style={styles.wordmark}>Sweet Dreams</Text>
          <PrimaryButton title="Draw a line under today." onPress={onDone} style={styles.cta} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  below: { alignSelf: 'stretch', alignItems: 'center' },
  wordmark: {
    fontFamily: font.semibold,
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.text,
    textAlign: 'center',
  },
  cta: { alignSelf: 'stretch', marginTop: 28 },
});

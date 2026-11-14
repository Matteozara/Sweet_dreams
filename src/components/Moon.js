import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import Icon from './Icon';
import { colors, font } from '../theme';

const ease = Easing.inOut(Easing.sin);

function useLoop(duration, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return v;
}

/** A small "z" that drifts up from the moon and fades. */
function Zed({ size, delay, x, top = 44, rise = 46, drift = 16 }) {
  const v = useLoop(3600, delay);
  return (
    <Animated.Text
      style={[
        styles.zed,
        { fontSize: size, left: x, top },
        {
          opacity: v.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 0.9, 0.5, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          ],
        },
      ]}
    >
      z
    </Animated.Text>
  );
}

function Star({ x, y, size, delay }) {
  const v = useLoop(2800, delay);
  return (
    <Animated.View
      style={[
        styles.star,
        { left: x, top: y, width: size, height: size, borderRadius: size / 2 },
        { opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.9, 0.15] }) },
      ]}
    />
  );
}

/**
 * The sleeping moon: slow breathing, a gentle rock, a few twinkling stars.
 * Pass `zeds` for the drifting z's and `compact` for the cozy header version
 * shown beside "Goodnight." on the suggestions view.
 */
export default function Moon({ zeds = false, compact = false }) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2600, easing: ease, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2600, easing: ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (compact) {
    return (
      <View style={styles.compactStage} accessibilityLabel="Sleeping moon" accessible>
        <Star x={4} y={14} size={2.5} delay={0} />
        <Star x={66} y={10} size={3} delay={900} />
        <Star x={70} y={50} size={2.5} delay={1700} />
        <Star x={10} y={54} size={3} delay={500} />

        <Animated.View
          style={[
            styles.compactHalo,
            {
              opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.45] }),
              transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.compactOrb,
            {
              transform: [
                { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
                { rotate: breath.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
              ],
            },
          ]}
        >
          <Icon name="moon" size={22} color={colors.lilacPale} filled />
        </Animated.View>

        {zeds && (
          <>
            <Zed size={9.5} delay={0} x={52} top={18} rise={20} drift={8} />
            <Zed size={12} delay={1200} x={58} top={16} rise={22} drift={10} />
            <Zed size={14.5} delay={2400} x={64} top={14} rise={24} drift={11} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.stage} accessibilityLabel="Sleeping moon" accessible>
      <Star x={14} y={34} size={3} delay={0} />
      <Star x={188} y={22} size={4} delay={900} />
      <Star x={204} y={112} size={3} delay={1700} />
      <Star x={30} y={130} size={4} delay={500} />
      <Star x={70} y={8} size={2} delay={1300} />

      <Animated.View
        style={[
          styles.halo,
          {
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }),
            transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            transform: [
              { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
              { rotate: breath.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
            ],
          },
        ]}
      >
        <Icon name="moon" size={44} color={colors.lilacPale} filled />
      </Animated.View>

      {zeds && (
        <>
          <Zed size={13} delay={0} x={142} />
          <Zed size={17} delay={1200} x={152} />
          <Zed size={22} delay={2400} x={162} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 220, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  halo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: colors.lilac },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25233a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: colors.lilac,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  zed: { position: 'absolute', top: 44, fontFamily: font.semibold, color: colors.lilacPale },
  star: { position: 'absolute', backgroundColor: colors.blue },

  compactStage: { width: 80, height: 68, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compactHalo: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: colors.lilac },
  compactOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25233a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: colors.lilac,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
});

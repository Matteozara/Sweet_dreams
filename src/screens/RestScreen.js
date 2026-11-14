import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs } from 'react-native-svg';
import { Header, FadeIn } from '../components/Chrome';
import { GhostButton, GlassButton } from '../components/Buttons';
import Icon from '../components/Icon';
import { GlowLine, LineGradient } from '../components/LineArt';
import { smoothPath, toPixels } from '../line';
import { colors, font, type } from '../theme';

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
function Zed({ size, delay, x }) {
  const v = useLoop(3600, delay);
  return (
    <Animated.Text
      style={[
        styles.zed,
        { fontSize: size, left: x },
        {
          opacity: v.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 0.9, 0.5, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
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

/** The sleeping moon: slow breathing, a gentle rock, drifting z's. */
function SleepingMoon() {
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

  return (
    <View style={styles.moonStage} accessibilityLabel="Sleeping moon" accessible>
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

      <Zed size={13} delay={0} x={142} />
      <Zed size={17} delay={1200} x={152} />
      <Zed size={22} delay={2400} x={162} />
    </View>
  );
}

function TodayLine({ points }) {
  const [w, setW] = useState(0);
  const h = 64;
  const px = toPixels(points, w, h, { pad: 6 });
  return (
    <View style={styles.today} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LineGradient x2={w} />
          </Defs>
          <GlowLine d={smoothPath(px)} end={px[px.length - 1]} width={2.5} />
        </Svg>
      )}
    </View>
  );
}

/** Last step: the day is closed. */
export default function RestScreen({ entry, onProgress, onRedo }) {
  return (
    <View style={styles.screen}>
      <Header chip="Rest" />
      <View style={styles.body}>
        <View style={styles.center}>
          <SleepingMoon />
          <Text style={styles.title}>Goodnight.</Text>
          <Text style={styles.sub}>Today is closed.</Text>
          {entry?.line?.points?.length > 1 && (
            <FadeIn delay={500} duration={900} style={styles.todayWrap}>
              <TodayLine points={entry.line.points} />
            </FadeIn>
          )}
        </View>
        <View style={styles.actions}>
          <GlassButton
            title="Your progress"
            onPress={onProgress}
            icon={<Icon name="activity" size={18} color={colors.lilac} />}
          />
          <GhostButton title="Draw again" onPress={onRedo} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moonStage: { width: 220, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  title: { ...type.display, fontSize: 36, lineHeight: 44 },
  sub: { ...type.bodySm, marginTop: 6 },
  todayWrap: { alignSelf: 'stretch', marginTop: 28 },
  today: { height: 64, marginHorizontal: 24 },
  actions: { gap: 10 },
});

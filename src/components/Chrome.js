import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { GradientFill, Press } from './Buttons';
import { card, colors, font, radius } from '../theme';

/**
 * A frosted panel. iOS gets a real backdrop blur; Android keeps the flat
 * translucent fill, because its blur re-renders every frame and is the
 * fastest way to lose the frame budget on a mid-range phone.
 */
export function Card({ children, style, intensity = 22 }) {
  const flat = StyleSheet.flatten([card, styles.cardBase, style]);
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={[flat, styles.cardBlur]}>
        {children}
      </BlurView>
    );
  }
  return <View style={flat}>{children}</View>;
}

/** Top bar: wordmark on the left, a small settings gear on the right. */
export function Header({ onBack, onSettings }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.headerLeft}>
        {onBack && (
          <Press onPress={onBack} hitSlop={14} scaleTo={0.9} accessibilityLabel="Back">
            <Icon name="back" size={20} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </Press>
        )}
        <Text style={styles.wordmark}>Sweet Dreams</Text>
      </View>
      {onSettings && (
        <Press
          onPress={onSettings}
          hitSlop={16}
          scaleTo={0.88}
          innerStyle={styles.gearBtn}
          accessibilityLabel="Settings"
        >
          <Icon name="gear" size={23} color={colors.muted} strokeWidth={1.75} />
        </Press>
      )}
    </View>
  );
}

/**
 * Tabs are peers, so switching does not animate — a slide would imply a
 * hierarchy that isn't there, and it is paid for dozens of times a session.
 * The feedback is the active tint, its glow, and one haptic.
 */
export function BottomNav({ items, active, onChange }) {
  const insets = useSafeAreaInsets();
  const row = (
    <View style={[styles.navRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Press
            key={item.key}
            onPress={() => onChange(item.key)}
            scaleTo={0.94}
            style={styles.navItem}
            innerStyle={styles.navItemInner}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
          >
            <View style={styles.iconWrap}>
              {on && <View style={styles.iconGlow} pointerEvents="none" />}
              <Icon
                name={item.icon}
                size={22}
                color={on ? colors.lilacPale : colors.faint}
                filled={on && item.icon === 'moon'}
              />
            </View>
            <Text style={[styles.navLabel, on && styles.navLabelOn]}>{item.label}</Text>
          </Press>
        );
      })}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={30} tint="dark" style={styles.nav}>
        {row}
      </BlurView>
    );
  }
  return <View style={[styles.nav, styles.navAndroid]}>{row}</View>;
}

/** iOS-proportioned switch with a pastel track. */
export function Toggle({ value, onChange, label }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [value]);
  return (
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={styles.track}
    >
      <Animated.View style={[styles.trackOn, { opacity: anim }]}>
        <GradientFill from={colors.lilac} via={colors.lilac} to={colors.pink} />
      </Animated.View>
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: value ? colors.lowest : colors.muted },
          { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] },
        ]}
      />
    </Pressable>
  );
}

/** Fades its children in when mounted; key it by screen for calm transitions. */
export function FadeIn({ children, style, duration = 450, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  cardBase: { overflow: 'hidden' },
  // On iOS the blur supplies most of the surface, so the fill steps back.
  cardBlur: { backgroundColor: 'rgba(31,30,44,0.38)' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: font.medium, fontSize: 14, letterSpacing: 0.3, color: 'rgba(255,255,255,0.9)' },
  gearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -6 },

  nav: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(14,13,26,0.55)' : undefined,
  },
  navAndroid: { backgroundColor: 'rgba(14,13,26,0.96)' },
  navRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 24 },
  navItem: { flex: 1 },
  navItemInner: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(235,221,255,0.12)',
    boxShadow: '0 0 12px rgba(235,221,255,0.45)',
  },
  navLabel: { fontFamily: font.medium, fontSize: 11, color: colors.faint },
  navLabelOn: { fontFamily: font.semibold, color: colors.lilacPale },

  track: { width: 50, height: 30, borderRadius: 15, padding: 2, backgroundColor: 'rgba(53,51,66,0.9)', justifyContent: 'center' },
  // Explicit size, not absoluteFill: an absolutely positioned overlay with no
  // dimensions of its own does not paint its children here.
  trackOn: { position: 'absolute', top: 0, left: 0, width: 50, height: 30, borderRadius: 15, overflow: 'hidden' },
  thumb: { width: 26, height: 26, borderRadius: 13 },
});

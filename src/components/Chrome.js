import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { GradientFill } from './Buttons';
import { colors, font, radius } from '../theme';

/** Top bar: wordmark on the left, a quiet chip naming the screen on the right. */
export function Header({ chip, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.headerLeft}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={14} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="back" size={20} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </Pressable>
        )}
        <Text style={styles.wordmark}>Sweet Dreams</Text>
      </View>
      {chip && (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
      )}
    </View>
  );
}

export function BottomNav({ items, active, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={styles.navItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Icon name={item.icon} size={22} color={on ? colors.lilacPale : colors.faint} filled={on && item.icon === 'moon'} />
            <Text style={[styles.navLabel, on && styles.navLabelOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: font.medium, fontSize: 14, letterSpacing: 0.3, color: 'rgba(255,255,255,0.9)' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
  chipText: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(14,13,26,0.85)',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  navItem: { minWidth: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navLabel: { fontFamily: font.medium, fontSize: 11, color: colors.faint },
  navLabelOn: { fontFamily: font.semibold, color: colors.lilacPale },

  track: { width: 50, height: 30, borderRadius: 15, padding: 2, backgroundColor: 'rgba(53,51,66,0.9)', justifyContent: 'center' },
  trackOn: { ...StyleSheet.absoluteFillObject, borderRadius: 15, overflow: 'hidden' },
  thumb: { width: 26, height: 26, borderRadius: 13 },
});

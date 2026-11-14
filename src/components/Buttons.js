import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, font, radius } from '../theme';

export function GradientFill({ from = colors.lilacPale, via = colors.lilac, to = colors.pink }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={from} />
          <Stop offset="0.5" stopColor={via} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#fill)" />
    </Svg>
  );
}

/** Luminous pastel pill: the one primary action on a screen. */
export function PrimaryButton({ title, onPress, disabled, icon, iconRight, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.clip}>
        <GradientFill />
      </View>
      {icon && <View>{icon}</View>}
      <Text style={styles.primaryText}>{title}</Text>
      {iconRight && <View>{iconRight}</View>}
    </Pressable>
  );
}

/** Frosted pill: secondary actions. */
export function GlassButton({ title, onPress, icon, small, style, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.glass, small && styles.glassSmall, pressed && styles.pressed, style]}
    >
      {icon}
      <Text style={[styles.glassText, small && styles.glassTextSmall]}>{title}</Text>
    </Pressable>
  );
}

/** Text-only action. */
export function GhostButton({ title, onPress, icon, style }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }, style]}
    >
      {icon}
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.lilac,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: radius.full, overflow: 'hidden' },
  primaryText: { fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  glass: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassSmall: { height: 38, paddingHorizontal: 16, gap: 6, backgroundColor: 'rgba(42,40,54,0.6)' },
  glassText: { fontFamily: font.medium, fontSize: 15, letterSpacing: -0.2, color: colors.text },
  glassTextSmall: { fontSize: 13 },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  ghostText: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
});

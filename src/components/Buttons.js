import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { tap } from '../services';
import { colors, font, motion, radius } from '../theme';

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Shared press behaviour: the visual settles in on press-IN (that is the
 * latency a finger actually feels) and a haptic fires on commit, paired with
 * the visual, never on its own. Reduced motion drops the scale for a fade.
 */
export function Press({
  children,
  onPress,
  disabled,
  scaleTo = 0.97,
  haptic = true,
  style,
  innerStyle,
  hitSlop,
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={style}
      {...rest}
    >
      <Animated.View
        style={[
          {
            transform: [{ scale: pressed && !reduced ? scaleTo : 1 }],
            opacity: disabled ? 0.35 : pressed && reduced ? 0.7 : 1,
            transitionProperty: ['transform', 'opacity'],
            transitionDuration: motion.fast,
            transitionTimingFunction: EASE_OUT,
          },
          innerStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The pastel fill behind a pill.
 *
 * This is a native gradient view rather than an SVG one: an `<Svg>` sized in
 * percentages has to resolve its parent's layout, and inside an animated view
 * it can resolve to nothing and paint an invisible button. A LinearGradient
 * just fills the box it is given.
 */
export function GradientFill({ from = colors.lilacPale, via = colors.lilac, to = colors.pink }) {
  return (
    <LinearGradient
      colors={[from, via, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

/** Luminous pastel pill: the one primary action on a screen. */
export function PrimaryButton({ title, onPress, disabled, icon, iconRight, style }) {
  return (
    <Press onPress={onPress} disabled={disabled} scaleTo={0.98} style={style} innerStyle={styles.primary}>
      <View style={styles.clip}>
        <GradientFill />
      </View>
      {icon && <View>{icon}</View>}
      <Text style={styles.primaryText}>{title}</Text>
      {iconRight && <View>{iconRight}</View>}
    </Press>
  );
}

/** Frosted pill: secondary actions. */
export function GlassButton({ title, onPress, icon, small, style, disabled }) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      style={style}
      innerStyle={[styles.glass, small && styles.glassSmall]}
    >
      {icon}
      <Text style={[styles.glassText, small && styles.glassTextSmall]}>{title}</Text>
    </Press>
  );
}

/** Text-only action. */
export function GhostButton({ title, onPress, icon, style }) {
  return (
    <Press onPress={onPress} hitSlop={10} scaleTo={0.96} style={style} innerStyle={styles.ghost}>
      {icon}
      <Text style={styles.ghostText}>{title}</Text>
    </Press>
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
    // A solid floor under the gradient: if the fill ever fails to paint, the
    // pill is still lavender and the ink text on it is still readable.
    backgroundColor: colors.lilac,
    boxShadow: '0 0 24px rgba(212,187,255,0.35)',
  },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: radius.full, overflow: 'hidden' },
  primaryText: { fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.2, color: colors.ink },
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

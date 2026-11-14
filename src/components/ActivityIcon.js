import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { iconPaths } from './Icon';
import { colors } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Longer than any path in the set, so the gap always outruns the glyph.
const DASH = 170;
// The length of the travelling highlight.
const SPAN = 26;

// Each type gets a mark and a colour. Types that mean the same kind of
// thing share both, so the set stays small and legible.
const ICONS = {
  Care: ['heart', colors.pink],
  'Relapse prevention': ['heart', colors.pink],
  Rhythm: ['sunrise', colors.lilacPale],
  Routine: ['sunrise', colors.lilacPale],
  Connection: ['people', colors.blue],
  Contact: ['people', colors.blue],
  Community: ['people', colors.blue],
  Body: ['droplet', colors.blueDim],
  Calm: ['breathe', colors.lilac],
  Relax: ['breathe', colors.lilac],
  'Mind-body': ['breathe', colors.lilac],
  Diary: ['pencil', colors.lilacPale],
  'Gentle movement': ['walk', colors.blue],
  'Structured exercise': ['walk', colors.blue],
  Fitness: ['walk', colors.blue],
  'Green exercise': ['leaf', colors.mint],
  Nature: ['leaf', colors.mint],
  'Small task': ['steps', colors.lilac],
  'Avoidance step': ['steps', colors.lilac],
  'Activity planning': ['steps', colors.lilac],
  'Small pleasure': ['sparkle', colors.pink],
  Gratitude: ['sparkle', colors.pink],
  'Thinking skill': ['bulb', colors.lilacPale],
  Learning: ['bulb', colors.lilacPale],
  Sleep: ['moon', colors.blue],
  Food: ['bowl', colors.mint],
};

function Stroke({ d, color, progress }) {
  // A short bright segment travels along the glyph, over a dim copy of it.
  // The icon is always legible; only the light moves.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: SPAN - progress.get() * (SPAN + DASH),
  }));
  return (
    <>
      <Path
        d={d}
        stroke={color}
        strokeOpacity={0.55}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <AnimatedPath
        animatedProps={animatedProps}
        d={d}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[SPAN, DASH]}
      />
    </>
  );
}

/**
 * The mark on a suggestion card: a coloured line glyph with a bright
 * segment travelling along its own stroke. The icon itself animates and is
 * always legible — nothing slides around, nothing disappears. Reduced
 * motion leaves the highlight parked at the start.
 */
export default function ActivityIcon({ type, index = 0, size = 30 }) {
  const reduced = useReducedMotion();
  const [name, color] = ICONS[type] ?? ['sparkle', colors.lilac];
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    progress.set(
      withDelay(
        index * 600,
        withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1)
      )
    );
  }, []);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {iconPaths[name].map((d) => (
        <Stroke key={d} d={d} color={color} progress={progress} />
      ))}
    </Svg>
  );
}

import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { colors } from '../theme';

const glows = [
  { id: 'lilac', color: colors.lilac, opacity: 0.3, cx: 0.1, cy: 0.08, r: 0.8 },
  { id: 'pink', color: colors.pink, opacity: 0.22, cx: 1.0, cy: 0.42, r: 0.75 },
  { id: 'blue', color: colors.blueDim, opacity: 0.24, cx: 0.3, cy: 0.95, r: 0.75 },
];

/** Soft nebula washes behind every screen. */
export default function Backdrop() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {glows.map((g) => (
          <RadialGradient key={g.id} id={g.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
            <Stop offset="1" stopColor={g.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {glows.map((g) => (
        <Circle key={g.id} cx={g.cx * width} cy={g.cy * height} r={g.r * width} fill={`url(#${g.id})`} />
      ))}
    </Svg>
  );
}

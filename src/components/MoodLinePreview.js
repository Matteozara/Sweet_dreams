import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { colors } from '../theme';

/** Small read-only rendering of a saved mood line (points with t in 0..1, mood in -1..1). */
export default function MoodLinePreview({ points, width = 280, height = 90 }) {
  if (!points || points.length < 2) return null;
  const toX = (t) => t * width;
  const toY = (m) => ((1 - m) / 2) * height;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.mood).toFixed(1)}`).join(' ');
  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={colors.border} strokeDasharray="4 4" />
        <Path d={d} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

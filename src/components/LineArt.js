import React from 'react';
import { LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { colors, lineStops } from '../theme';

/** Horizontal pastel gradient in user space (works for flat lines too). Place inside <Defs>. */
export function LineGradient({ id = 'line', x1 = 0, x2 }) {
  return (
    <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={0} x2={x2} y2={0}>
      {lineStops.map((s) => (
        <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
      ))}
    </LinearGradient>
  );
}

/** A day line with a soft glow underneath and an optional glowing end node. */
export function GlowLine({ d, end, gradient = 'line', width = 3.5 }) {
  if (!d) return null;
  return (
    <>
      <Path d={d} stroke={colors.lilac} strokeOpacity={0.14} strokeWidth={width * 3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={colors.lilac} strokeOpacity={0.18} strokeWidth={width * 2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={`url(#${gradient})`} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {end && (
        <>
          <Circle cx={end.x} cy={end.y} r={13} fill={colors.lilacPale} fillOpacity={0.16} />
          <Circle cx={end.x} cy={end.y} r={8} fill={colors.lilacPale} fillOpacity={0.3} />
          <Circle cx={end.x} cy={end.y} r={4.5} fill="#ffffff" />
        </>
      )}
    </>
  );
}

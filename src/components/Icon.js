import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Minimal line icons on a 24px grid.
const paths = {
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 11v1a7 7 0 0 1-14 0v-1', 'M12 19v3'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  back: ['M15 18l-6-6 6-6'],
  redo: ['M1 4v6h6', 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  bed: ['M2 4v16', 'M2 8h18a2 2 0 0 1 2 2v10', 'M2 17h20', 'M6 8v9'],
  gear: [
    'M12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z',
    'M19.3 12c0-.4 0-.8-.1-1.2l1.9-1.4-1.9-3.3-2.2 1a7.2 7.2 0 0 0-2-1.2L14.6 3.3h-3.8l-.4 2.6a7.2 7.2 0 0 0-2 1.2l-2.2-1-1.9 3.3 1.9 1.4a7.2 7.2 0 0 0 0 2.4l-1.9 1.4 1.9 3.3 2.2-1a7.2 7.2 0 0 0 2 1.2l.4 2.6h3.8l.4-2.6a7.2 7.2 0 0 0 2-1.2l2.2 1 1.9-3.3-1.9-1.4c.1-.4.1-.8.1-1.2z',
  ],
  keyboard: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M6.5 10h.01', 'M10.2 10h.01', 'M13.8 10h.01', 'M17.5 10h.01', 'M8 14h8'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
};

export default function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.8, filled = false }) {
  if (name === 'stop') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="5" y="5" width="14" height="14" rx="4" fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? color : 'none'}
        />
      ))}
    </Svg>
  );
}

export function GoogleMark({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </Svg>
  );
}

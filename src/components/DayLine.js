import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line } from 'react-native-svg';

import { GlowLine, LineGradient } from './LineArt';
import { smoothPath, toPixels } from '../line';
import { colors } from '../theme';

/**
 * One day's line stretched across the full horizontal plot from Morning to Night.
 */
export default function DayLine({ points, maxHeight = 150, insetX = 14, showMidline = false, style }) {
  const [w, setW] = useState(0);
  const h = maxHeight;
  const drawW = Math.max(0, w - insetX * 2);
  const px = toPixels(points, drawW, h, { x0: insetX, pad: 14, spanX: true });
  return (
    <View style={[styles.box, { height: h }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && px.length > 1 && (
        <Svg width={w} height={h}>
          <Defs>
            <LineGradient x1={insetX} x2={w - insetX} />
          </Defs>
          {showMidline && (
            <Line
              x1={insetX}
              x2={w - insetX}
              y1={h / 2}
              y2={h / 2}
              stroke={colors.muted}
              strokeOpacity={0.14}
              strokeDasharray="3 6"
            />
          )}
          <GlowLine d={smoothPath(px)} end={px[px.length - 1]} width={2.5} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', justifyContent: 'center' },
});

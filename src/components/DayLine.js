import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs } from 'react-native-svg';

import { GlowLine, LineGradient } from './LineArt';
import { smoothPath, toPixels } from '../line';

/**
 * One day's line, in the shape it was actually drawn.
 *
 * The stored points are 0..1 on both axes, so dropping them into a box of a
 * different proportion flattens every rise. Instead we scale uniformly to the
 * canvas they were drawn on and centre the result.
 */
export default function DayLine({ points, canvas, maxHeight = 170, style }) {
  const [w, setW] = useState(0);
  const ratio = canvas?.w && canvas?.h ? canvas.h / canvas.w : 0.5;
  const drawW = Math.min(w, Math.round(maxHeight / ratio));
  const h = Math.round(drawW * ratio);
  const px = toPixels(points, drawW, h, { x0: (w - drawW) / 2, pad: 6 });
  return (
    <View style={[styles.box, { height: maxHeight }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <LineGradient x1={(w - drawW) / 2} x2={(w + drawW) / 2} />
          </Defs>
          <GlowLine d={smoothPath(px)} end={px[px.length - 1]} width={2.5} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs } from 'react-native-svg';
import { Header, FadeIn } from '../components/Chrome';
import { GlassButton } from '../components/Buttons';
import Icon from '../components/Icon';
import Moon from '../components/Moon';
import { GlowLine, LineGradient } from '../components/LineArt';
import { smoothPath, toPixels } from '../line';
import { colors, font, type } from '../theme';

const TODAY_MAX_H = 170;

/**
 * Tonight's line, in the shape it was actually drawn.
 *
 * The stored points are 0..1 on both axes, so dropping them into a box of a
 * different proportion flattens every rise. Instead we scale uniformly to the
 * canvas they were drawn on and centre the result.
 */
function TodayLine({ points, canvas }) {
  const [w, setW] = useState(0);
  const ratio = canvas?.w && canvas?.h ? canvas.h / canvas.w : 0.5;
  const drawW = Math.min(w, Math.round(TODAY_MAX_H / ratio));
  const h = Math.round(drawW * ratio);
  const px = toPixels(points, drawW, h, { x0: (w - drawW) / 2, pad: 6 });
  return (
    <View style={styles.today} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
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

/** Last step: the day is closed. */
export default function RestScreen({ entry, onProgress, onSettings }) {
  return (
    <View style={styles.screen}>
      <Header onSettings={onSettings} />
      <View style={styles.body}>
        <View style={styles.center}>
          <Moon zeds />
          <Text style={styles.title}>Goodnight.</Text>
          <Text style={styles.sub}>Today is closed.</Text>
          {entry?.line?.points?.length > 1 && (
            <FadeIn delay={500} duration={900} style={styles.todayWrap}>
              <TodayLine points={entry.line.points} canvas={entry.line.canvas} />
            </FadeIn>
          )}
        </View>
        <View style={styles.actions}>
          <GlassButton
            title="Your progress"
            onPress={onProgress}
            icon={<Icon name="activity" size={18} color={colors.lilac} />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.display, fontSize: 36, lineHeight: 44 },
  sub: { ...type.bodySm, marginTop: 6 },
  todayWrap: { alignSelf: 'stretch', marginTop: 28 },
  today: { height: TODAY_MAX_H, marginHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 10 },
});

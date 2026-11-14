import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/Chrome';
import { GhostButton, PrimaryButton } from '../components/Buttons';
import Icon from '../components/Icon';
import { GlowLine, LineGradient } from '../components/LineArt';
import { smoothPath, thin } from '../line';
import { tap } from '../services';
import { card, colors, font, type } from '../theme';

const clamp = (v, max) => Math.max(0, Math.min(max, v));

/**
 * Step two: one line across the day.
 * Left to right is morning to night; top is light, bottom is heavy.
 * Besides the visible line we keep the raw finger motion (every sample, with timing).
 */
export default function DayLineScreen({ onSubmit, onBack }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [points, setPoints] = useState([]);
  const [drawing, setDrawing] = useState(false);

  const sizeRef = useRef(size);
  const line = useRef([]); // visible line: only moves forward in time
  const raw = useRef([]); // every touch sample [x, y, ms]
  const startedAt = useRef(0);
  const attempts = useRef(0);

  const responder = useMemo(() => {
    const add = (e) => {
      const { w, h } = sizeRef.current;
      if (!w) return;
      const x = clamp(e.nativeEvent.locationX, w);
      const y = clamp(e.nativeEvent.locationY, h);
      const t = Date.now() - startedAt.current;
      if (raw.current.length < 3000) raw.current.push([x, y, t]);
      const last = line.current[line.current.length - 1];
      if (last && x < last.x + 2) return;
      line.current = [...line.current, { x, y, t }];
      setPoints(line.current);
    };
    const end = () => setDrawing(false);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startedAt.current = Date.now();
        attempts.current += 1;
        line.current = [];
        raw.current = [];
        setDrawing(true);
        add(e);
      },
      onPanResponderMove: add,
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, []);

  const onLayout = (e) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    sizeRef.current = { w, h };
    setSize({ w, h });
  };

  const redraw = () => {
    line.current = [];
    raw.current = [];
    setPoints([]);
  };

  const first = points[0];
  const last = points[points.length - 1];
  const complete = points.length >= 6 && last.x - first.x > size.w * 0.25;

  const close = () => {
    const { w, h } = size;
    tap();
    onSubmit({
      points: thin(points).map((p) => ({ x: p.x / w, y: p.y / h, t: p.t })),
      motion: thin(raw.current, 600).map(([x, y, t]) => [+(x / w).toFixed(4), +(y / h).toFixed(4), t]),
      durationMs: last.t,
      attempts: attempts.current,
      canvas: { w: Math.round(w), h: Math.round(h) },
    });
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
      <Header chip="The Day Line" onBack={onBack} />
      <View style={styles.body}>
        <Text style={type.display}>Draw your day</Text>
        <Text style={styles.sub}>Morning to evening.</Text>

        <View style={styles.card}>
          <Text style={[styles.axis, { color: colors.pink }]}>+  Light</Text>
          <View style={styles.canvas} onLayout={onLayout} {...responder.panHandlers}>
            {size.w > 0 && (
              <Svg width={size.w} height={size.h} pointerEvents="none">
                <Defs>
                  <LineGradient x2={size.w} />
                </Defs>
                <Line
                  x1={0}
                  x2={size.w}
                  y1={size.h / 2}
                  y2={size.h / 2}
                  stroke={colors.muted}
                  strokeOpacity={0.18}
                  strokeDasharray="4 7"
                />
                <GlowLine d={smoothPath(points)} end={points.length > 1 ? last : null} />
              </Svg>
            )}
            {points.length === 0 && !drawing && (
              <View style={styles.hint} pointerEvents="none">
                <Text style={styles.hintText}>One line, left to right.</Text>
              </View>
            )}
          </View>
          <Text style={styles.axis}>−  Heavy</Text>
          <View style={styles.time}>
            <Text style={[styles.axis, { color: colors.pink }]}>Morning</Text>
            <Text style={[styles.axis, { color: colors.blue }]}>Night</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton title="Close Today" onPress={close} disabled={!complete || drawing} />
          <GhostButton
            title="Redraw"
            onPress={redraw}
            icon={<Icon name="redo" size={15} color={colors.muted} />}
            style={points.length === 0 && { opacity: 0 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  sub: { ...type.body, color: colors.muted, marginTop: 2, marginBottom: 20 },
  card: { ...card, flex: 1, padding: 20 },
  canvas: { flex: 1, marginVertical: 8 },
  axis: { fontFamily: font.medium, fontSize: 13, color: colors.faint },
  time: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 48 },
  hintText: { fontFamily: font.regular, fontSize: 14, color: colors.faint },
  actions: { marginTop: 24, gap: 10 },
});

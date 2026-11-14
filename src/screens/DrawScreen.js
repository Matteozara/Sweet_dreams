import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Pressable } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import BigButton from '../components/BigButton';
import { colors } from '../theme';

/**
 * The user draws one line across the canvas:
 *   x axis = time of day (morning -> night)
 *   y axis = how they felt (bad at the bottom -> good at the top)
 * The line is stored normalised: { t: 0..1, mood: -1..1 }.
 */
export default function DrawScreen({ onSubmit, onBack }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [points, setPoints] = useState([]); // pixel coords {x, y}
  const pointsRef = useRef([]);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const addPoint = (evt, reset = false) => {
    const { locationX, locationY } = evt.nativeEvent;
    const { w, h } = sizeRef.current;
    const p = { x: clamp(locationX, 0, w), y: clamp(locationY, 0, h) };
    const prev = reset ? [] : pointsRef.current;
    const last = prev[prev.length - 1];
    // skip points that are too close together to keep the path light
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    pointsRef.current = [...prev, p];
    setPoints(pointsRef.current);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      // every new touch starts a fresh line (one line per day)
      onPanResponderGrant: (evt) => addPoint(evt, true),
      onPanResponderMove: (evt) => addPoint(evt),
    })
  ).current;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const clear = () => {
    pointsRef.current = [];
    setPoints([]);
  };

  const submit = () => {
    const { w, h } = size;
    const normalised = points.map((p) => ({
      t: +(p.x / w).toFixed(4),
      mood: +(1 - (2 * p.y) / h).toFixed(4),
    }));
    onSubmit(normalised);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.step}>Step 2 of 2</Text>
      <Text style={styles.title}>Draw a line that shows how your day went</Text>
      <Text style={styles.hint}>Start on the left (morning) and move to the right (night). Higher means you felt better.</Text>

      <View style={styles.canvasRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>😊</Text>
          <Text style={styles.axisLabel}>😐</Text>
          <Text style={styles.axisLabel}>😞</Text>
        </View>

        <View
          style={styles.canvas}
          onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          {...pan.panHandlers}
        >
          {/* pointerEvents none so touches' locationX/Y are relative to this View */}
          <Svg width={size.w} height={size.h} pointerEvents="none">
            <Rect x={0} y={0} width={size.w} height={size.h / 2} fill="#EEF8F4" />
            <Rect x={0} y={size.h / 2} width={size.w} height={size.h / 2} fill="#FBEFF1" />
            <Line x1={0} y1={size.h / 2} x2={size.w} y2={size.h / 2} stroke={colors.border} strokeWidth={1.5} strokeDasharray="6 6" />
            {points.length > 1 && (
              <Path d={pathD} stroke={colors.primary} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </Svg>
        </View>
      </View>

      <View style={styles.xAxis}>
        <Text style={styles.axisText}>Morning</Text>
        <Text style={styles.axisText}>Afternoon</Text>
        <Text style={styles.axisText}>Night</Text>
      </View>

      <View style={styles.actions}>
        <BigButton title="Clear" onPress={clear} outline color={colors.muted} style={{ flex: 1, marginRight: 8 }} />
        <BigButton title="Save" onPress={submit} disabled={points.length < 5} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  back: { color: colors.primary, fontSize: 17, marginBottom: 16 },
  step: { color: colors.muted, fontSize: 14, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  hint: { color: colors.muted, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  canvasRow: { flex: 1, flexDirection: 'row' },
  yAxis: { justifyContent: 'space-between', paddingVertical: 8, marginRight: 6 },
  axisLabel: { fontSize: 22 },
  canvas: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 36, marginTop: 6 },
  axisText: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: 12 },
});

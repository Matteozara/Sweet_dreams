import React, { useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, G, Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Header } from '../components/Chrome';
import { GhostButton, PrimaryButton } from '../components/Buttons';
import Icon from '../components/Icon';
import { LineGradient } from '../components/LineArt';
import { thin } from '../line';
import { tap } from '../services';
import { colors, font, radius, type } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/** The UI-thread twin of smoothPath() in src/line.js — keep the two in step. */
function smoothPathWorklet(pts) {
  'worklet';
  if (!pts || pts.length < 2) return '';
  const f = (n) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${f(pts[i].x)} ${f(pts[i].y)} ${f(xc)} ${f(yc)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${f(last.x)} ${f(last.y)}`;
}

/**
 * Step two: one line across the day.
 * Left to right is morning to night; top is good, bottom is bad.
 *
 * The finger is on the element, so the line lives on the UI thread: the pan
 * gesture writes into shared values and `useAnimatedProps` hands the SVG its
 * `d` string directly. React renders once, on release — not once per frame.
 * Besides the visible line we keep the raw finger motion (every sample, with
 * timing), which is the part worth analysing later.
 */
export default function DayLineScreen({ onSubmit, onBack, onSettings }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [committed, setCommitted] = useState([]); // settled line, only on release
  const [started, setStarted] = useState(false);

  const line = useSharedValue([]); // visible line: only moves forward in time
  const raw = useSharedValue([]); // every touch sample [x, y, ms, strokeId]
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const attempts = useSharedValue(0);
  const startedAt = useSharedValue(0);
  const strokeActive = useSharedValue(false);

  // The only React render the drawing causes: one, on release.
  const settle = (points) => setCommitted(points);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => {
          'worklet';
          const w = width.get();
          const h = height.get();
          if (!w) return;
          const x = Math.max(0, Math.min(w, e.x));
          const y = Math.max(0, Math.min(h, e.y));
          const list = line.get();

          // First stroke must begin at the left edge (Morning) so no part of the day is skipped.
          const startZone = Math.min(56, w * 0.16);
          if (list.length === 0 && x > startZone) {
            strokeActive.set(false);
            return;
          }

          strokeActive.set(true);
          const now = Date.now();
          if (startedAt.get() === 0) {
            startedAt.set(now);
            scheduleOnRN(setStarted, true);
          }
          const strokeId = attempts.get() + 1;
          attempts.set(strokeId);
          const t = now - startedAt.get();

          raw.modify((arr) => {
            'worklet';
            if (arr.length < 3000) arr.push([x, y, t, strokeId]);
            return arr;
          });

          const last = list[list.length - 1];
          if (!last) {
            // Anchor the visual start at x = 0 so the day line begins cleanly at the left edge.
            line.modify((arr) => {
              'worklet';
              if (x > 0) arr.push({ x: 0, y, t });
              arr.push({ x, y, t });
              return arr;
            });
          } else if (x >= last.x + 2) {
            line.modify((arr) => {
              'worklet';
              arr.push({ x, y, t });
              return arr;
            });
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (!strokeActive.get()) return;
          const w = width.get();
          const h = height.get();
          if (!w) return;
          const x = Math.max(0, Math.min(w, e.x));
          const y = Math.max(0, Math.min(h, e.y));
          const t = Date.now() - startedAt.get();
          const strokeId = attempts.get();

          // modify() mutates in place; copying these arrays every frame would
          // make a long drawing quadratic.
          raw.modify((arr) => {
            'worklet';
            if (arr.length < 3000) arr.push([x, y, t, strokeId]);
            return arr;
          });

          const list = line.get();
          const last = list[list.length - 1];
          // the day only runs one way: never let the line double back
          if (last && x < last.x + 2) return;
          line.modify((arr) => {
            'worklet';
            arr.push({ x, y, t });
            return arr;
          });
        })
        .onEnd(() => {
          'worklet';
          if (!strokeActive.get()) return;
          strokeActive.set(false);
          scheduleOnRN(settle, line.get());
        }),
    []
  );

  const pathProps = useAnimatedProps(() => ({ d: smoothPathWorklet(line.get()) }));
  const nodeProps = useAnimatedProps(() => {
    const list = line.get();
    const end = list[list.length - 1];
    return { cx: end ? end.x : -40, cy: end ? end.y : -40, opacity: list.length > 1 ? 1 : 0 };
  });
  // An empty `d` does not draw nothing — react-native-svg paints the stroke
  // gradient across the whole box. So the line only exists once there is one.
  const lineProps = useAnimatedProps(() => ({ opacity: line.get().length > 1 ? 1 : 0 }));

  const onLayout = (e) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    width.set(w);
    height.set(h);
    setSize({ w, h });
  };

  const redraw = () => {
    line.set([]);
    raw.set([]);
    attempts.set(0);
    startedAt.set(0);
    strokeActive.set(false);
    setStarted(false);
    setCommitted([]);
    setTouched(false);
  };

  const first = committed[0];
  const last = committed[committed.length - 1];
  const complete = committed.length >= 6 && first.x <= Math.min(56, size.w * 0.16) && last.x >= size.w * 0.8;

  const close = () => {
    const { w, h } = size;
    const rawArr = raw.get();
    const totalMs = rawArr.length ? rawArr[rawArr.length - 1][2] : last.t;
    tap();
    onSubmit({
      points: thin(committed).map((p) => ({ x: p.x / w, y: p.y / h, t: p.t })),
      motion: thin(rawArr, 600).map(([x, y, t, strokeId]) => [+(x / w).toFixed(4), +(y / h).toFixed(4), t, strokeId]),
      durationMs: totalMs,
      attempts: attempts.get(),
      fingerLifts: Math.max(0, attempts.get() - 1),
      canvas: {
        w: Math.round(w),
        h: Math.round(h),
        dpPerMm: +(160 / 25.4).toFixed(4),
        pixelRatio: PixelRatio.get(),
      },
    });
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
      <Header onBack={onBack} onSettings={onSettings} />
      <View style={styles.body}>
        <Text style={type.display}>Draw your day</Text>
        <Text style={styles.sub}>Morning to evening.</Text>

        <Card style={styles.card}>
          <Text style={[styles.axis, { color: colors.pink }]}>+ Good</Text>
          <GestureDetector gesture={pan}>
            <View style={styles.canvas} onLayout={onLayout}>
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
                  {/* the glow layers of LineArt's GlowLine, driven from the UI thread */}
                  <AnimatedG animatedProps={lineProps} opacity={0}>
                    <AnimatedPath
                      animatedProps={pathProps}
                      d=""
                      stroke={colors.lilac}
                      strokeOpacity={0.14}
                      strokeWidth={11.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <AnimatedPath
                      animatedProps={pathProps}
                      d=""
                      stroke={colors.lilac}
                      strokeOpacity={0.18}
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <AnimatedPath
                      animatedProps={pathProps}
                      d=""
                      stroke="url(#line)"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {/* cx/cy/opacity are also set statically: animated props do not
                        always land on mount, and without them these would paint at
                        0,0 — a lilac halo in the corner until the first touch. */}
                    <AnimatedCircle
                      animatedProps={nodeProps}
                      cx={-40}
                      cy={-40}
                      opacity={0}
                      r={13}
                      fill={colors.lilacPale}
                      fillOpacity={0.16}
                    />
                    <AnimatedCircle
                      animatedProps={nodeProps}
                      cx={-40}
                      cy={-40}
                      opacity={0}
                      r={8}
                      fill={colors.lilacPale}
                      fillOpacity={0.3}
                    />
                    <AnimatedCircle
                      animatedProps={nodeProps}
                      cx={-40}
                      cy={-40}
                      opacity={0}
                      r={4.5}
                      fill="#ffffff"
                    />
                  </AnimatedG>
                </Svg>
              )}
              {!started && (
                <>
                  <View style={styles.startBand} pointerEvents="none">
                    <View style={styles.startLine} />
                  </View>
                  <View style={[styles.hint, { width: size.w, height: size.h }]} pointerEvents="none">
                    <Text style={styles.hintText}>Start at the red line, then draw to Night.</Text>
                  </View>
                </>
              )}
            </View>
          </GestureDetector>
          <Text style={styles.axis}>− Bad</Text>
          <View style={styles.time}>
            <Text style={[styles.axis, { color: colors.pink }]}>Morning</Text>
            <Text style={[styles.axis, { color: colors.blue }]}>Night</Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <PrimaryButton title="Close Today" onPress={close} disabled={!complete} />
          <GhostButton
            title="Redraw"
            onPress={redraw}
            icon={<Icon name="redo" size={15} color={colors.muted} />}
            style={committed.length === 0 && { opacity: 0 }}
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
  card: { flex: 1, padding: 20 },
  // Flat and opaque: no nebula wash showing through behind the line.
  canvas: {
    flex: 1,
    marginVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.lowest,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  axis: { fontFamily: font.medium, fontSize: 13, color: colors.faint },
  time: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  // Sized by the caller, never by absoluteFillObject alone: an overlay with
  // no dimensions of its own does not paint its children here.
  hint: { position: 'absolute', top: 0, left: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center', paddingBottom: 48, paddingHorizontal: 24 },
  startBand: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    justifyContent: 'center',
  },
  startLine: {
    position: 'absolute',
    left: 4,
    top: 10,
    bottom: 10,
    width: 6,
    borderRadius: 3,
    backgroundColor: '#ff3b30',
  },
  hintText: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.faint, textAlign: 'center' },
  actions: { marginTop: 24, gap: 10 },
});

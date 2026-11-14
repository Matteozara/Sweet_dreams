// Helpers for day lines. A stored line is a list of points
// { x: 0..1 (morning -> night), y: 0..1 (0 = top = good, 1 = bottom = bad), t: ms since touch down }.

const f = (n) => Math.round(n * 10) / 10;

/** Smooth SVG path through pixel points (quadratic curves through midpoints). */
export function smoothPath(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${f(pts[i].x)} ${f(pts[i].y)} ${f(xc)} ${f(yc)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${f(last.x)} ${f(last.y)}`;
}

/** Map normalized points into a pixel box. */
export function toPixels(points, w, h, { x0 = 0, pad = 0 } = {}) {
  return points.map((p) => ({ x: x0 + p.x * w, y: pad + p.y * (h - pad * 2) }));
}

/** Keep at most `max` points, always keeping the first and the last. */
export function thin(points, max = 160) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/** Average height of a line as a mood in -1 (bad) .. 1 (good). */
export function meanMood(points) {
  if (!points?.length) return 0;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return 1 - 2 * y;
}

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Consecutive evenings ending today (or yesterday, if today is still open). */
export function streak(entries) {
  const days = new Set(entries.map((e) => e.date));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function formatTime(hour, minute) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDuration(ms = 0) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

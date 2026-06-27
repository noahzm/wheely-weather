/**
 * Pure geometry helpers for the hourly ride-condition chart.
 * Keeping these out of the render component lets them be unit-tested and
 * prevents the component from holding domain knowledge (condition → score).
 */
import type { Condition } from '@/types/weather';

/** Numeric score for each ride condition (higher = better). */
const CONDITION_SCORE: Record<Condition, number> = {
  bad: 1,
  poor: 2,
  marginal: 3,
  fair: 4,
  good: 5,
};

/**
 * Reads an array value that is in-bounds by construction, throwing loudly on a
 * future off-by-one rather than silently producing NaN downstream.
 */
function elementAt(arr: number[], i: number): number {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`hourlyChart: index ${i} out of range`);
  return v;
}

export const CHART_X_ORIGIN = 24;
export const CHART_X_STEP = 44;

export const DOT_RADIUS_MAX = 8;
export const DOT_RADIUS_MIN = 5;
export const DOT_RADIUS_NOW_FLOOR = 7;
const DOT_OPACITY_MUTED = 0.58;

/** Horizontal pixel offset for a given data index. Worklet-safe. */
export function chartX(idx: number): number {
  'worklet';
  return CHART_X_ORIGIN + idx * CHART_X_STEP;
}

/** Side padding so the first/last hour can scroll to the viewport center. */
export function chartContentPadding(viewportWidth: number): number {
  return Math.max(0, viewportWidth / 2 - CHART_X_ORIGIN);
}

/** Maximum scroll offset for a chart with `maxIndex` as the last data index. */
export function chartMaxScrollOffset(maxIndex: number, viewportWidth: number): number {
  const padding = chartContentPadding(viewportWidth);
  return Math.max(0, padding + chartX(maxIndex) - viewportWidth / 2);
}

/** Clamps a scroll offset to the valid range (guards web overscroll). Worklet-safe. */
export function chartClampScrollOffset(
  scrollX: number,
  viewportWidth: number,
  maxIndex: number,
): number {
  'worklet';
  if (viewportWidth <= 0) return Math.max(0, scrollX);
  return Math.min(Math.max(0, scrollX), chartMaxScrollOffset(maxIndex, viewportWidth));
}

/** Scroll offset that centers `idx` in a viewport of the given width. */
export function chartScrollOffsetForIndex(
  idx: number,
  viewportWidth: number,
  maxIndex: number,
): number {
  const padding = chartContentPadding(viewportWidth);
  const raw = padding + chartX(idx) - viewportWidth / 2;
  return Math.min(Math.max(0, raw), chartMaxScrollOffset(maxIndex, viewportWidth));
}

/** Nearest data index to the viewport center at `scrollX`. */
export function chartIndexFromScrollOffset(
  scrollX: number,
  viewportWidth: number,
  maxIndex: number,
): number {
  const padding = chartContentPadding(viewportWidth);
  const centerChart = scrollX + viewportWidth / 2 - padding;
  const idx = Math.round((centerChart - CHART_X_ORIGIN) / CHART_X_STEP);
  return Math.min(Math.max(0, idx), maxIndex);
}

/** Snap offsets for a magnetized horizontal hour picker. */
export function chartSnapOffsets(count: number, viewportWidth: number): number[] {
  if (count <= 0 || viewportWidth <= 0) return [];
  const maxIndex = count - 1;
  return Array.from({ length: count }, (_, idx) =>
    chartScrollOffsetForIndex(idx, viewportWidth, maxIndex),
  );
}

/** Nearest magnet snap offset to a raw scroll position. */
export function chartNearestSnapOffset(offsetX: number, offsets: readonly number[]): number {
  let nearest = offsetX;
  let minDist = Infinity;
  for (const offset of offsets) {
    const dist = Math.abs(offsetX - offset);
    if (dist < minDist) {
      minDist = dist;
      nearest = offset;
    }
  }
  return nearest;
}

/**
 * Vertical pixel offset for a given condition string.
 * Maps the 1–5 score range onto the chart's usable height (34–146 px).
 */
export function chartY(condition: string): number {
  const score = (CONDITION_SCORE as Record<string, number>)[condition] ?? 3;
  return 146 - ((score - 1) / 4) * 112;
}

/**
 * Builds the SVG `points` string for the condition polyline.
 */
export function chartPolylinePoints(data: { idx: number; condition: string }[]): string {
  return data.map((d) => `${chartX(d.idx)},${chartY(d.condition)}`).join(' ');
}

export interface ChartSplineSegment {
  x0: number;
  y0: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x1: number;
  y1: number;
}

function cubicBezierComponent(t: number, p0: number, p1: number, p2: number, p3: number): number {
  'worklet';
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Chart-space X at the horizontal center of the scroll viewport. Worklet-safe. */
export function chartCenterXFromScroll(scrollX: number, viewportWidth: number): number {
  'worklet';
  const padding = Math.max(0, viewportWidth / 2 - CHART_X_ORIGIN);
  return scrollX + viewportWidth / 2 - padding;
}

/** Viewport-center chart X from a scroll offset, clamped to the data domain. Worklet-safe. */
export function chartCenterXFromClampedScroll(
  scrollX: number,
  viewportWidth: number,
  maxIndex: number,
): number {
  'worklet';
  const clamped = chartClampScrollOffset(scrollX, viewportWidth, maxIndex);
  const centerX = chartCenterXFromScroll(clamped, viewportWidth);
  return Math.min(Math.max(chartX(0), centerX), chartX(maxIndex));
}

/** Dot radius from horizontal distance to the viewport center. Worklet-safe. */
export function chartDotRadiusAtDistance(distance: number): number {
  'worklet';
  const t = Math.min(1, Math.abs(distance) / CHART_X_STEP);
  return DOT_RADIUS_MAX - t * (DOT_RADIUS_MAX - DOT_RADIUS_MIN);
}

/** Dot radius for a data index at the given viewport center X. Worklet-safe. */
export function chartDotRadiusForIndex(idx: number, centerX: number, isNow: boolean): number {
  'worklet';
  const radius = chartDotRadiusAtDistance(chartX(idx) - centerX);
  if (isNow) return Math.max(radius, DOT_RADIUS_NOW_FLOOR);
  return radius;
}

/** Smooth 0→1 easing for scroll-linked badge motion. Worklet-safe. */
function chartSmoothStep(t: number): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, t));
  return (1 - Math.cos(clamped * Math.PI)) / 2;
}

/** Inverse of chartY — score 1 (bad) … 5 (good). Worklet-safe. */
export function chartScoreFromY(y: number): number {
  'worklet';
  return 1 + ((146 - y) / 112) * 4;
}

/** Fractional index blend between adjacent hours at viewport center. Worklet-safe. */
export function chartScrollBlendAtCenter(centerX: number, count: number): { i: number; t: number } {
  'worklet';
  if (count <= 1) return { i: 0, t: 0 };
  const fracIndex = (centerX - CHART_X_ORIGIN) / CHART_X_STEP;
  const i = Math.min(Math.max(0, Math.floor(fracIndex)), count - 2);
  return { i, t: chartSmoothStep(fracIndex - i) };
}

/** Linearly interpolate a numeric series at viewport center. Worklet-safe. */
export function chartInterpolateAtCenter(centerX: number, values: readonly number[]): number {
  'worklet';
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0] ?? 0;
  const { i, t } = chartScrollBlendAtCenter(centerX, values.length);
  const v0 = values[i] ?? values[0] ?? 0;
  const v1 = values[i + 1] ?? v0;
  return v0 + (v1 - v0) * t;
}

/** Dot opacity with smooth brightening as a past hour approaches center. Worklet-safe. */
export function chartDotOpacityAtDistance(
  distance: number,
  isPast: boolean,
  isNow: boolean,
): number {
  'worklet';
  if (!isPast || isNow) return 1;
  const t = Math.min(1, Math.abs(distance) / (CHART_X_STEP / 2));
  return DOT_OPACITY_MUTED + (1 - DOT_OPACITY_MUTED) * (1 - t);
}

/** Discrete dot radius for reduced-motion fallback. Worklet-safe. */
export function chartDiscreteDotRadius(isSelected: boolean, isNow: boolean): number {
  'worklet';
  if (isSelected) return DOT_RADIUS_MAX;
  if (isNow) return DOT_RADIUS_NOW_FLOOR;
  return DOT_RADIUS_MIN;
}

/** Discrete dot opacity for reduced-motion fallback. Worklet-safe. */
export function chartDiscreteDotOpacity(
  isPast: boolean,
  isNow: boolean,
  isSelected: boolean,
): number {
  'worklet';
  return isPast && !isNow && !isSelected ? DOT_OPACITY_MUTED : 1;
}

/** Builds monotone cubic bezier segments for the condition line. */
export function buildChartSpline(data: { idx: number; condition: string }[]): ChartSplineSegment[] {
  if (data.length === 0) return [];
  const xs = data.map((d) => chartX(d.idx));
  const ys = data.map((d) => chartY(d.condition));
  const n = data.length;

  if (n === 1) {
    const x = elementAt(xs, 0);
    const y = elementAt(ys, 0);
    return [{ x0: x, y0: y, cp1x: x, cp1y: y, cp2x: x, cp2y: y, x1: x, y1: y }];
  }

  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    delta.push(
      (elementAt(ys, i + 1) - elementAt(ys, i)) / (elementAt(xs, i + 1) - elementAt(xs, i)),
    );
  }

  const m: number[] = Array.from({ length: n }, () => 0);
  m[0] = elementAt(delta, 0);
  for (let i = 1; i < n - 1; i++) m[i] = (elementAt(delta, i - 1) + elementAt(delta, i)) / 2;
  m[n - 1] = elementAt(delta, n - 2);

  for (let i = 0; i < n - 1; i++) {
    if (elementAt(delta, i) === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = elementAt(m, i) / elementAt(delta, i);
      const beta = elementAt(m, i + 1) / elementAt(delta, i);
      const h = alpha * alpha + beta * beta;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * alpha * elementAt(delta, i);
        m[i + 1] = t * beta * elementAt(delta, i);
      }
    }
  }

  const segments: ChartSplineSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = elementAt(xs, i + 1) - elementAt(xs, i);
    segments.push({
      x0: elementAt(xs, i),
      y0: elementAt(ys, i),
      cp1x: elementAt(xs, i) + dx / 3,
      cp1y: elementAt(ys, i) + (elementAt(m, i) * dx) / 3,
      cp2x: elementAt(xs, i + 1) - dx / 3,
      cp2y: elementAt(ys, i + 1) - (elementAt(m, i + 1) * dx) / 3,
      x1: elementAt(xs, i + 1),
      y1: elementAt(ys, i + 1),
    });
  }
  return segments;
}

function yOnSegment(segment: ChartSplineSegment, x: number): number {
  'worklet';
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const mx = cubicBezierComponent(mid, segment.x0, segment.cp1x, segment.cp2x, segment.x1);
    if (mx < x) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return cubicBezierComponent(t, segment.y0, segment.cp1y, segment.cp2y, segment.y1);
}

function lastChartSegment(segments: ChartSplineSegment[]): ChartSplineSegment | undefined {
  'worklet';
  const n = segments.length;
  return n > 0 ? segments[n - 1] : undefined;
}

/** Evaluates Y on precomputed spline segments at chart-space X. Worklet-safe. */
export function chartSmoothYAtSegments(segments: ChartSplineSegment[], x: number): number {
  'worklet';
  if (segments.length === 0) return 90;
  const first = segments[0];
  const last = lastChartSegment(segments);
  if (first == null || last == null) return 90;
  if (x <= first.x0) return first.y0;
  if (x >= last.x1) return last.y1;

  for (const segment of segments) {
    if (x >= segment.x0 && x <= segment.x1) {
      return yOnSegment(segment, x);
    }
  }
  return last.y1;
}

/** Evaluates Y on the smooth condition line at chart-space X. */
export function chartSmoothYAtX(data: { idx: number; condition: string }[], x: number): number {
  return chartSmoothYAtSegments(buildChartSpline(data), x);
}

/**
 * Builds a smooth SVG path using Fritsch-Carlson monotone cubic interpolation —
 * same algorithm as Apple Charts' `.interpolationMethod(.monotone)`.
 */
export function chartSmoothPath(data: { idx: number; condition: string }[]): string {
  const segments = buildChartSpline(data);
  if (segments.length === 0) return '';
  const first = segments[0];
  if (!first) return '';
  if (segments.length === 1 && first.x0 === first.x1) {
    return `M ${first.x0.toFixed(1)},${first.y0.toFixed(1)}`;
  }

  const parts = [`M ${first.x0.toFixed(1)},${first.y0.toFixed(1)}`];
  for (const segment of segments) {
    parts.push(
      `C ${segment.cp1x.toFixed(1)},${segment.cp1y.toFixed(1)} ${segment.cp2x.toFixed(1)},${segment.cp2y.toFixed(1)} ${segment.x1.toFixed(1)},${segment.y1.toFixed(1)}`,
    );
  }
  return parts.join(' ');
}

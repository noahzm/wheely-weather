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

/** Horizontal pixel offset for a given data index. */
export function chartX(idx: number): number {
  return 24 + idx * 44;
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

/**
 * Builds a smooth SVG path using Fritsch-Carlson monotone cubic interpolation —
 * same algorithm as Apple Charts' `.interpolationMethod(.monotone)`.
 */
export function chartSmoothPath(data: { idx: number; condition: string }[]): string {
  if (data.length === 0) return '';
  const xs = data.map((d) => chartX(d.idx));
  const ys = data.map((d) => chartY(d.condition));
  const n = data.length;

  if (n === 1) return `M ${elementAt(xs, 0)},${elementAt(ys, 0)}`;

  // Inter-point slopes
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    delta.push(
      (elementAt(ys, i + 1) - elementAt(ys, i)) / (elementAt(xs, i + 1) - elementAt(xs, i)),
    );
  }

  // Initial tangents: average of neighboring slopes for interior points
  const m: number[] = Array.from({ length: n }, () => 0);
  m[0] = elementAt(delta, 0);
  for (let i = 1; i < n - 1; i++) m[i] = (elementAt(delta, i - 1) + elementAt(delta, i)) / 2;
  m[n - 1] = elementAt(delta, n - 2);

  // Fritsch-Carlson monotonicity constraint
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

  // Cubic bezier segments
  const parts = [`M ${elementAt(xs, 0).toFixed(1)},${elementAt(ys, 0).toFixed(1)}`];
  for (let i = 0; i < n - 1; i++) {
    const dx = elementAt(xs, i + 1) - elementAt(xs, i);
    const cp1x = elementAt(xs, i) + dx / 3;
    const cp1y = elementAt(ys, i) + (elementAt(m, i) * dx) / 3;
    const cp2x = elementAt(xs, i + 1) - dx / 3;
    const cp2y = elementAt(ys, i + 1) - (elementAt(m, i + 1) * dx) / 3;
    parts.push(
      `C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${elementAt(xs, i + 1).toFixed(1)},${elementAt(ys, i + 1).toFixed(1)}`,
    );
  }
  return parts.join(' ');
}

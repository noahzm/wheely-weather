import { describe, it, expect } from 'vitest';
import {
  CHART_X_ORIGIN,
  CHART_X_STEP,
  chartClampScrollOffset,
  chartCenterXFromClampedScroll,
  chartInterpolateAtCenter,
  chartCenterXFromScroll,
  chartContentPadding,
  chartDotOpacity,
  chartDotRadius,
  chartIndexFromScrollOffset,
  chartMaxScrollOffset,
  chartNearestSnapOffset,
  chartScrollOffsetForIndex,
  chartSmoothYAtX,
  chartSnapOffsets,
  chartX,
  chartY,
  chartPolylinePoints,
  chartSmoothYAtSegments,
  chartSmoothPath,
  type ChartSplineSegment,
} from './hourlyChart';

describe('chartX', () => {
  it('offsets by 24px + 44px per index', () => {
    expect(CHART_X_ORIGIN).toBe(24);
    expect(CHART_X_STEP).toBe(44);
    expect(chartX(0)).toBe(24);
    expect(chartX(1)).toBe(68);
    expect(chartX(10)).toBe(464);
  });
});

describe('chart scroll picker', () => {
  const viewportWidth = 320;
  const maxIndex = 35;

  it('centers index 0 at scroll offset 0', () => {
    expect(chartContentPadding(viewportWidth)).toBe(136);
    expect(chartScrollOffsetForIndex(0, viewportWidth, maxIndex)).toBe(0);
    expect(chartIndexFromScrollOffset(0, viewportWidth, maxIndex)).toBe(0);
  });

  it('round-trips scroll offset and index for Now-like middle hours', () => {
    const idx = 12;
    const offset = chartScrollOffsetForIndex(idx, viewportWidth, maxIndex);
    expect(chartIndexFromScrollOffset(offset, viewportWidth, maxIndex)).toBe(idx);
  });

  it('clamps index at the ends', () => {
    const maxOffset = chartScrollOffsetForIndex(maxIndex, viewportWidth, maxIndex);
    expect(chartIndexFromScrollOffset(maxOffset + 200, viewportWidth, maxIndex)).toBe(maxIndex);
    expect(chartIndexFromScrollOffset(-50, viewportWidth, maxIndex)).toBe(0);
  });

  it('builds one snap offset per hour', () => {
    const offsets = chartSnapOffsets(36, viewportWidth);
    expect(offsets).toHaveLength(36);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(chartScrollOffsetForIndex(35, viewportWidth, 35));
  });

  it('clamps overscroll offsets to valid scroll range', () => {
    const maxOffset = chartMaxScrollOffset(maxIndex, viewportWidth);
    expect(chartClampScrollOffset(-40, viewportWidth, maxIndex)).toBe(0);
    expect(chartClampScrollOffset(maxOffset + 80, viewportWidth, maxIndex)).toBe(maxOffset);
  });

  it('clamps viewport center X to chart data bounds during overscroll', () => {
    expect(chartCenterXFromClampedScroll(-40, viewportWidth, maxIndex)).toBe(chartX(0));
    const maxOffset = chartMaxScrollOffset(maxIndex, viewportWidth);
    expect(chartCenterXFromClampedScroll(maxOffset + 80, viewportWidth, maxIndex)).toBe(
      chartX(maxIndex),
    );
  });

  it('finds nearest magnet snap offset', () => {
    const offsets = chartSnapOffsets(36, viewportWidth);
    expect(chartNearestSnapOffset(10, offsets)).toBe(0);
    expect(chartNearestSnapOffset(550, offsets)).toBe(offsets[12]);
  });
});

describe('chartY', () => {
  it('maps "good" to top (small y)', () => {
    expect(chartY('good')).toBe(34); // 146 - (4/4)*112
  });
  it('maps "bad" to bottom (large y)', () => {
    expect(chartY('bad')).toBe(146); // 146 - (0/4)*112
  });
  it('maps "fair" correctly', () => {
    expect(chartY('fair')).toBe(62); // 146 - (3/4)*112 = 146-84 = 62
  });
  it('defaults unknown condition to "marginal" mid-point', () => {
    expect(chartY('unknown')).toBe(chartY('marginal'));
  });
});

describe('chartInterpolateAtCenter', () => {
  const values = [60, 80];

  it('returns the first value when centered on an hour', () => {
    expect(chartInterpolateAtCenter(chartX(0), values)).toBe(60);
  });

  it('interpolates midway between hours', () => {
    const mid = chartInterpolateAtCenter(chartX(0) + CHART_X_STEP / 2, values);
    expect(mid).toBeGreaterThan(60);
    expect(mid).toBeLessThan(80);
  });

  it('returns a single value for length-1 arrays', () => {
    expect(chartInterpolateAtCenter(chartX(0), [42])).toBe(42);
  });
});

describe('chartPolylinePoints', () => {
  it('produces space-separated x,y pairs', () => {
    const result = chartPolylinePoints([
      { idx: 0, condition: 'good' },
      { idx: 1, condition: 'bad' },
    ]);
    expect(result).toBe(`${chartX(0)},${chartY('good')} ${chartX(1)},${chartY('bad')}`);
  });
  it('returns empty string for empty input', () => {
    expect(chartPolylinePoints([])).toBe('');
  });
});

describe('chartDotRadius', () => {
  it('gives the Now dot a slightly larger radius', () => {
    expect(chartDotRadius(true)).toBe(7);
    expect(chartDotRadius(false)).toBe(5);
  });
});

describe('chartDotOpacity', () => {
  it('mutes past non-Now dots', () => {
    expect(chartDotOpacity(true, false)).toBeCloseTo(0.58);
    expect(chartDotOpacity(true, true)).toBe(1);
    expect(chartDotOpacity(false, false)).toBe(1);
  });
});

describe('chartSmoothYAtX', () => {
  const data = [
    { idx: 0, condition: 'good' },
    { idx: 1, condition: 'fair' },
    { idx: 2, condition: 'bad' },
  ];

  it('matches chartY at each hour anchor', () => {
    for (const point of data) {
      expect(chartSmoothYAtX(data, chartX(point.idx))).toBeCloseTo(chartY(point.condition), 0);
    }
  });

  it('stays between endpoint Y values at mid-segment X', () => {
    const midX = (chartX(0) + chartX(1)) / 2;
    const y = chartSmoothYAtX(data, midX);
    expect(y).toBeGreaterThanOrEqual(Math.min(chartY('good'), chartY('fair')));
    expect(y).toBeLessThanOrEqual(Math.max(chartY('good'), chartY('fair')));
  });

  it('maps scroll center X consistently with chartCenterXFromScroll', () => {
    const viewportWidth = 320;
    const scrollX = chartScrollOffsetForIndex(1, viewportWidth, 2);
    const centerX = chartCenterXFromScroll(scrollX, viewportWidth);
    expect(chartSmoothYAtX(data, centerX)).toBeCloseTo(chartY('fair'), 0);
  });
});

describe('chartContentPadding', () => {
  it('returns 0 if viewport is very narrow', () => {
    // viewportWidth = 20 -> viewportWidth/2 = 10. 10 - 24 (CHART_X_ORIGIN) = -14. Math.max(0, -14) = 0.
    expect(chartContentPadding(20)).toBe(0);
  });
});

describe('chartSmoothYAtSegments', () => {
  it('returns 90 for empty segments', () => {
    expect(chartSmoothYAtSegments([], 100)).toBe(90);
  });

  it('returns last y1 if x falls in a gap between segments', () => {
    const segments: ChartSplineSegment[] = [
      { x0: 0, y0: 10, cp1x: 5, cp1y: 10, cp2x: 5, cp2y: 10, x1: 10, y1: 10 },
      { x0: 20, y0: 20, cp1x: 25, cp1y: 20, cp2x: 25, cp2y: 20, x1: 30, y1: 20 },
    ];
    // x = 15 is > first.x0 (0) and < last.x1 (30), but not in any segment's [x0, x1] range.
    expect(chartSmoothYAtSegments(segments, 15)).toBe(20); // last.y1
  });
});

describe('chartSmoothPath', () => {
  it('returns empty string for empty data', () => {
    expect(chartSmoothPath([])).toBe('');
  });

  it('returns move command for single data point', () => {
    const data = [{ idx: 0, condition: 'good' }];
    expect(chartSmoothPath(data)).toMatch(/^M 24\.0,34\.0$/);
  });

  it('returns path with curve commands for multiple data points', () => {
    const data = [
      { idx: 0, condition: 'good' },
      { idx: 1, condition: 'bad' },
    ];
    const path = chartSmoothPath(data);
    expect(path).toContain('M 24.0,34.0');
    expect(path).toContain('C'); // Should contain a curve command
  });
});

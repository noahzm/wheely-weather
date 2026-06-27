import { describe, it, expect } from 'vitest';
import {
  CHART_X_ORIGIN,
  CHART_X_STEP,
  chartClampScrollOffset,
  chartCenterXFromClampedScroll,
  chartInterpolateAtCenter,
  chartCenterXFromScroll,
  chartContentPadding,
  chartDotOpacityAtDistance,
  chartDotRadiusAtDistance,
  chartDotRadiusForIndex,
  chartDiscreteDotOpacity,
  chartDiscreteDotRadius,
  chartIndexFromScrollOffset,
  chartMaxScrollOffset,
  chartNearestSnapOffset,
  chartScrollOffsetForIndex,
  chartSmoothYAtX,
  chartSnapOffsets,
  chartX,
  chartY,
  chartPolylinePoints,
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

describe('chartDotRadiusAtDistance', () => {
  it('is max at center', () => {
    expect(chartDotRadiusAtDistance(0)).toBe(8);
  });

  it('is min one step away', () => {
    expect(chartDotRadiusAtDistance(CHART_X_STEP)).toBe(5);
    expect(chartDotRadiusAtDistance(-CHART_X_STEP)).toBe(5);
  });

  it('interpolates at mid-step', () => {
    expect(chartDotRadiusAtDistance(CHART_X_STEP / 2)).toBe(6.5);
  });
});

describe('chartDotRadiusForIndex', () => {
  it('uses the Now floor when off-center', () => {
    const centerX = chartX(0);
    expect(chartDotRadiusForIndex(2, centerX, true)).toBe(7);
  });

  it('uses max radius when Now is centered', () => {
    const centerX = chartX(3);
    expect(chartDotRadiusForIndex(3, centerX, true)).toBe(8);
  });
});

describe('chartDotOpacityAtDistance', () => {
  it('is full opacity at center for past hours', () => {
    expect(chartDotOpacityAtDistance(0, true, false)).toBe(1);
  });

  it('is muted far from center for past hours', () => {
    expect(chartDotOpacityAtDistance(CHART_X_STEP, true, false)).toBeCloseTo(0.58);
  });

  it('is always full opacity for Now and future hours', () => {
    expect(chartDotOpacityAtDistance(CHART_X_STEP, true, true)).toBe(1);
    expect(chartDotOpacityAtDistance(CHART_X_STEP, false, false)).toBe(1);
  });
});

describe('chartDiscreteDotRadius', () => {
  it('matches discrete sizing for selected, Now, and default', () => {
    expect(chartDiscreteDotRadius(true, false)).toBe(8);
    expect(chartDiscreteDotRadius(false, true)).toBe(7);
    expect(chartDiscreteDotRadius(false, false)).toBe(5);
  });
});

describe('chartDiscreteDotOpacity', () => {
  it('mutes past non-Now dots unless selected', () => {
    expect(chartDiscreteDotOpacity(true, false, false)).toBeCloseTo(0.58);
    expect(chartDiscreteDotOpacity(true, false, true)).toBe(1);
    expect(chartDiscreteDotOpacity(true, true, false)).toBe(1);
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

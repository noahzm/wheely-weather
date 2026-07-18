import { useMemo } from 'react';

import { getHourConditionReasons } from '@/utils';
import { fullHourLabel } from '@/utils/timeFormat';
import {
  CHART_X_ORIGIN,
  buildChartSpline,
  chartScrollOffsetForIndex,
  chartSmoothPath,
  chartX,
} from '@/utils/hourlyChart';
import { CONDITION_DISPLAY } from '@/domain';
import type { HourlyWeather } from '@/types/weather';

import { useExpandAnimation } from './animated-expand';
import { asCondition } from './primitives';
import { useHourlyScrollPicker } from './use-hourly-scroll-picker';

export type ChartHour = HourlyWeather & { isPast: boolean; idx: number };

export function useHourlyForecastChart(data: ChartHour[], nowIdx: number) {
  const {
    scrollRef,
    scrollX,
    liveScrollX,
    isScrollIdle,
    selectedIdx,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler,
    onWebScroll,
    onViewportLayout,
    onContentSizeChange,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  } = useHourlyScrollPicker(nowIdx, data.length);

  const selected = data[selectedIdx] ?? data[nowIdx];
  const selectedReasons = selected == null ? [] : getHourConditionReasons(selected);
  const selectedReason = selectedReasons.join(' • ') || null;
  const reasonOpen = selectedReason != null;
  const reasonOpenProgress = useExpandAnimation(reasonOpen);

  const chartWidth = data.length > 0 ? chartX(data.length - 1) + CHART_X_ORIGIN : CHART_X_ORIGIN;
  const splineSegments = useMemo(() => buildChartSpline(data), [data]);
  const smoothPath = useMemo(() => chartSmoothPath(data), [data]);

  // All hooks above run unconditionally. `data` is guaranteed non-empty by the
  // caller (HourlyForecast bails out when there are no hours), so `selected` is
  // always defined here; the guard narrows the type and documents the invariant.
  if (selected == null) {
    throw new Error('useHourlyForecastChart requires at least one hour');
  }

  const hourLabelText = selectedIdx === nowIdx ? 'Now' : fullHourLabel(selected.hour);
  const conditionLabel = CONDITION_DISPLAY[asCondition(selected.condition)];
  const initialScrollX =
    viewportWidth > 0
      ? chartScrollOffsetForIndex(nowIdx, viewportWidth, Math.max(0, data.length - 1))
      : 0;

  return {
    scrollRef,
    scrollX,
    liveScrollX,
    isScrollIdle,
    selectedIdx,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler,
    onWebScroll,
    onViewportLayout,
    onContentSizeChange,
    chartWidth,
    splineSegments,
    smoothPath,
    selected,
    selectedReason,
    reasonOpen,
    reasonOpenProgress,
    hourLabelText,
    conditionLabel,
    initialScrollX,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}

// Native hourly chart scrolling: the ScrollView snaps to hours itself
// (`snapToOffsets`), and a UI-thread worklet tracks the hour under the needle.
// Web drives scrolling from JS instead (use-hourly-scroll-picker.web.ts).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  CHART_SCROLL_UNSET,
  chartIndexFromScrollOffset,
  chartScrollOffsetForIndex,
} from '@/utils/hourlyChart';
import { selectionFeedback } from '@/utils/haptics';
import {
  useChartViewport,
  useScrollSelection,
  type HourlyScrollPicker,
} from './hourly-scroll-selection';

/**
 * Centers the "Now" hour once on mount. iOS can apply the first scrollTo
 * against a stale content size and land short, so the initial offset is
 * re-asserted on content-size changes until the user scrolls themselves.
 */
function useInitialChartScroll(params: {
  nowIdx: number;
  count: number;
  maxIndex: number;
  viewportWidth: number;
  scrollRef: RefObject<Animated.ScrollView | null>;
  scrollX: SharedValue<number>;
  lastNotifiedIdx: SharedValue<number>;
  syncSelectionFromScroll: (offsetX: number, haptic: boolean) => void;
  selectionHapticEnabledRef: RefObject<boolean>;
}) {
  const {
    nowIdx,
    count,
    maxIndex,
    viewportWidth,
    scrollRef,
    scrollX,
    lastNotifiedIdx,
    syncSelectionFromScroll,
    selectionHapticEnabledRef,
  } = params;
  const hasInitialScroll = useRef(false);

  const applyInitialScroll = useCallback(() => {
    if (viewportWidth <= 0 || count === 0) return;
    const x = chartScrollOffsetForIndex(nowIdx, viewportWidth, maxIndex);
    scrollRef.current?.scrollTo({ x, animated: false });
    scrollX.set(x);
    lastNotifiedIdx.set(nowIdx);
    syncSelectionFromScroll(x, false);
  }, [
    viewportWidth,
    nowIdx,
    maxIndex,
    count,
    syncSelectionFromScroll,
    scrollRef,
    scrollX,
    lastNotifiedIdx,
  ]);

  useEffect(() => {
    if (viewportWidth <= 0 || count === 0 || hasInitialScroll.current) return;
    hasInitialScroll.current = true;
    applyInitialScroll();
  }, [viewportWidth, count, applyInitialScroll]);

  return useCallback(() => {
    if (!hasInitialScroll.current || selectionHapticEnabledRef.current) return;
    applyInitialScroll();
  }, [applyInitialScroll, selectionHapticEnabledRef]);
}

/** Drag and momentum callbacks: they re-sync the selection as a safety net. */
function useDragHandlers(
  syncSelectionFromScroll: (offsetX: number, haptic: boolean) => void,
  selectionHapticEnabledRef: RefObject<boolean>,
) {
  const [isScrolling, setIsScrolling] = useState(false);

  const onScrollBeginDrag = useCallback(() => {
    selectionHapticEnabledRef.current = true;
    setIsScrolling(true);
  }, [selectionHapticEnabledRef]);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionFromScroll(event.nativeEvent.contentOffset.x, false);
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) < 0.01) setIsScrolling(false);
    },
    [syncSelectionFromScroll],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionFromScroll(event.nativeEvent.contentOffset.x, false);
      setIsScrolling(false);
    },
    [syncSelectionFromScroll],
  );

  return { isScrolling, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd };
}

export function useHourlyScrollPicker(
  nowIdx: number,
  count: number,
  onSelectedChange?: (nextIdx: number, prevIdx: number) => void,
): HourlyScrollPicker {
  const { viewportWidth, onViewportLayout, maxIndex, contentPadding, snapOffsets } =
    useChartViewport(count);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(CHART_SCROLL_UNSET);
  // Last index dispatched to React from the scroll worklet, so the UI→JS hop
  // happens once per hour-crossing instead of on every scroll frame.
  const lastNotifiedIdx = useSharedValue(-1);

  const { selectedIdx, syncSelectionFromScroll, selectionHapticEnabledRef } = useScrollSelection(
    nowIdx,
    maxIndex,
    viewportWidth,
    onSelectedChange,
  );

  const onContentSizeChange = useInitialChartScroll({
    nowIdx,
    count,
    maxIndex,
    viewportWidth,
    scrollRef,
    scrollX,
    lastNotifiedIdx,
    syncSelectionFromScroll,
    selectionHapticEnabledRef,
  });

  const dragHandlers = useDragHandlers(syncSelectionFromScroll, selectionHapticEnabledRef);

  const scrollToIndex = useCallback(
    (targetIdx: number) => {
      if (viewportWidth <= 0) return;
      const clamped = Math.min(Math.max(0, targetIdx), maxIndex);
      selectionFeedback();
      scrollRef.current?.scrollTo({
        x: chartScrollOffsetForIndex(clamped, viewportWidth, maxIndex),
        animated: true,
      });
    },
    [maxIndex, viewportWidth],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
      if (viewportWidth <= 0) return;
      // Only hop to the JS thread when the hour under the needle changes; the
      // end-drag/momentum handlers re-sync unconditionally as a safety net.
      const idx = chartIndexFromScrollOffset(event.contentOffset.x, viewportWidth, maxIndex);
      if (idx === lastNotifiedIdx.get()) return;
      lastNotifiedIdx.set(idx);
      scheduleOnRN(syncSelectionFromScroll, event.contentOffset.x, true);
    },
  });

  return {
    scrollRef,
    scrollX,
    liveScrollX: -1,
    isScrollIdle: true,
    selectedIdx,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler,
    onWebScroll: undefined,
    onViewportLayout,
    onContentSizeChange,
    scrollToIndex,
    ...dragHandlers,
  };
}

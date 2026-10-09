// Pieces of the hourly chart's scroll picker shared by the native
// (use-hourly-scroll-picker.ts) and web (use-hourly-scroll-picker.web.ts) hooks.
import { useCallback, useRef, useState, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type Animated from 'react-native-reanimated';
import type { SharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import {
  chartContentPadding,
  chartIndexFromScrollOffset,
  chartSnapOffsets,
} from '@/utils/hourlyChart';
import { selectionFeedback } from '@/utils/haptics';

type ScrollEventHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** What both platform hooks return; each leaves the other platform's handlers undefined. */
export interface HourlyScrollPicker {
  scrollRef: RefObject<Animated.ScrollView | null>;
  scrollX: SharedValue<number>;
  /** Web's JS-side scroll offset; -1 on native, which animates from `scrollX`. */
  liveScrollX: number;
  /** Web: false while scrolling or gliding. Always true on native. */
  isScrollIdle: boolean;
  selectedIdx: number;
  viewportWidth: number;
  contentPadding: number;
  snapOffsets: number[];
  /** Native: the UI-thread scroll worklet. */
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler> | undefined;
  /** Web: the JS scroll listener that drives selection and the magnet snap. */
  onWebScroll: ScrollEventHandler | undefined;
  onViewportLayout: (width: number) => void;
  onContentSizeChange: (() => void) | undefined;
  scrollToIndex: (targetIdx: number) => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: ScrollEventHandler;
  onMomentumScrollEnd: ScrollEventHandler;
  isScrolling: boolean;
}

/** Viewport width (set from layout), and the padding and snap points it implies. */
export function useChartViewport(count: number) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const onViewportLayout = useCallback((width: number) => {
    if (width > 0) {
      setViewportWidth((prev) => (prev === width ? prev : width));
    }
  }, []);
  return {
    viewportWidth,
    onViewportLayout,
    maxIndex: Math.max(0, count - 1),
    contentPadding: viewportWidth > 0 ? chartContentPadding(viewportWidth) : 0,
    snapOffsets: chartSnapOffsets(count, viewportWidth),
  };
}

/**
 * The hour under the needle. Selection haptics stay off until the rider first
 * drags, so the initial centering and relayouts don't buzz.
 */
export function useScrollSelection(
  nowIdx: number,
  maxIndex: number,
  viewportWidth: number,
  onSelectedChange?: (nextIdx: number, prevIdx: number) => void,
) {
  const [selectedIdx, setSelectedIdx] = useState(nowIdx);
  const selectedIdxRef = useRef(nowIdx);
  const selectionHapticEnabledRef = useRef(false);

  const applySelection = useCallback(
    (idx: number, haptic: boolean) => {
      const clamped = Math.min(Math.max(0, idx), maxIndex);
      const prevIdx = selectedIdxRef.current;
      if (clamped === prevIdx) return;
      selectedIdxRef.current = clamped;
      setSelectedIdx(clamped);
      onSelectedChange?.(clamped, prevIdx);
      if (haptic) selectionFeedback();
    },
    [maxIndex, onSelectedChange],
  );

  const syncSelectionFromScroll = useCallback(
    (offsetX: number, haptic: boolean) => {
      if (viewportWidth <= 0) return;
      applySelection(
        chartIndexFromScrollOffset(offsetX, viewportWidth, maxIndex),
        haptic && selectionHapticEnabledRef.current,
      );
    },
    [applySelection, maxIndex, viewportWidth],
  );

  return { selectedIdx, syncSelectionFromScroll, selectionHapticEnabledRef };
}

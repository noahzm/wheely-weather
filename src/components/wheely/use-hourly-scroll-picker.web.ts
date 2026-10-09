// Web hourly chart scrolling. Browsers have no `snapToOffsets` with momentum,
// so scroll events are handled in JS: they drive the selection, and a magnet
// glides the scroller onto the nearest hour once it settles. Native scrolling
// lives in use-hourly-scroll-picker.ts.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import {
  CHART_SCROLL_UNSET,
  chartClampScrollOffset,
  chartNearestSnapOffset,
  chartScrollOffsetForIndex,
} from '@/utils/hourlyChart';
import { selectionFeedback } from '@/utils/haptics';
import {
  useChartViewport,
  useScrollSelection,
  type HourlyScrollPicker,
} from './hourly-scroll-selection';

/** Duration of the magnet glide (ms). */
const SNAP_ANIM_MS = 340;
/** Wheel/trackpad: wait this many frames after last scroll before magnetizing. */
const WHEEL_IDLE_FRAMES = 2;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type ScrollRef = RefObject<Animated.ScrollView | null>;
type PublishScrollOffset = (offsetX: number, haptic: boolean) => void;

/**
 * The glide: an eased scroll to an hour, driven frame by frame. Its own
 * scrollTo calls fire scroll events too; mistaken for the user scrolling, they
 * cancelled every tap-to-select glide after one frame, and the idle snap then
 * landed on the next hour. `isProgrammaticScroll` recognizes that echo.
 */
function useGlide(params: {
  scrollRef: ScrollRef;
  publishScrollOffset: PublishScrollOffset;
  setIsScrollIdle: (idle: boolean) => void;
}) {
  const { scrollRef, publishScrollOffset, setIsScrollIdle } = params;
  const magnetFrameRef = useRef<number | null>(null);
  const isMagnetAnimatingRef = useRef(false);
  const programmaticXRef = useRef<number | null>(null);

  const cancelMagnetAnimation = useCallback(() => {
    if (magnetFrameRef.current != null) {
      cancelAnimationFrame(magnetFrameRef.current);
      magnetFrameRef.current = null;
    }
    isMagnetAnimatingRef.current = false;
  }, []);

  const scrollProgrammatically = useCallback(
    (x: number) => {
      programmaticXRef.current = x;
      scrollRef.current?.scrollTo({ x, animated: false });
    },
    [scrollRef],
  );

  const isProgrammaticScroll = useCallback((offsetX: number) => {
    const expected = programmaticXRef.current;
    return expected != null && Math.abs(offsetX - expected) < 1;
  }, []);

  const finishSnap = useCallback(
    (target: number) => {
      cancelMagnetAnimation();
      publishScrollOffset(target, false);
      scrollProgrammatically(target);
      setIsScrollIdle(true);
    },
    [cancelMagnetAnimation, publishScrollOffset, scrollProgrammatically, setIsScrollIdle],
  );

  const animateSnapTo = useCallback(
    (from: number, to: number) => {
      cancelMagnetAnimation();
      isMagnetAnimatingRef.current = true;
      setIsScrollIdle(false);
      const startTime = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / SNAP_ANIM_MS);
        const x = from + (to - from) * easeOutCubic(t);
        publishScrollOffset(x, false);
        scrollProgrammatically(x);

        if (t < 1) {
          magnetFrameRef.current = requestAnimationFrame(step);
          return;
        }

        magnetFrameRef.current = null;
        finishSnap(to);
      };

      magnetFrameRef.current = requestAnimationFrame(step);
    },
    [
      cancelMagnetAnimation,
      finishSnap,
      publishScrollOffset,
      scrollProgrammatically,
      setIsScrollIdle,
    ],
  );

  return {
    isMagnetAnimatingRef,
    cancelMagnetAnimation,
    isProgrammaticScroll,
    finishSnap,
    animateSnapTo,
  };
}

/** Magnetized snapping: glides the scroller to the nearest hour once it settles. */
function useMagnetSnap(params: {
  viewportWidth: number;
  maxIndex: number;
  snapOffsets: number[];
  scrollRef: ScrollRef;
  liveScrollXRef: RefObject<number>;
  publishScrollOffset: PublishScrollOffset;
  setIsScrollIdle: (idle: boolean) => void;
}) {
  const { viewportWidth, maxIndex, snapOffsets, liveScrollXRef } = params;

  const wheelIdleRafRef = useRef<number | null>(null);
  const wheelIdleFramesRef = useRef(0);
  const glide = useGlide(params);
  const { isMagnetAnimatingRef, cancelMagnetAnimation, finishSnap, animateSnapTo } = glide;

  const clampScrollOffset = useCallback(
    (offsetX: number) => {
      if (viewportWidth <= 0) return Math.max(0, offsetX);
      return chartClampScrollOffset(offsetX, viewportWidth, maxIndex);
    },
    [maxIndex, viewportWidth],
  );

  const cancelWheelIdleSnap = useCallback(() => {
    if (wheelIdleRafRef.current != null) {
      cancelAnimationFrame(wheelIdleRafRef.current);
      wheelIdleRafRef.current = null;
    }
    wheelIdleFramesRef.current = 0;
  }, []);

  const snapToNearestOffset = useCallback(
    (offsetX: number) => {
      if (viewportWidth <= 0 || snapOffsets.length === 0) return;
      const clamped = clampScrollOffset(offsetX);
      const nearest = chartNearestSnapOffset(clamped, snapOffsets);
      if (Math.abs(clamped - nearest) < 0.5 && Math.abs(offsetX - clamped) < 0.5) {
        finishSnap(nearest);
        return;
      }
      animateSnapTo(clamped, nearest);
    },
    [animateSnapTo, clampScrollOffset, finishSnap, viewportWidth, snapOffsets],
  );

  const scheduleWheelSnapAfterIdle = useCallback(() => {
    if (isMagnetAnimatingRef.current) return;
    cancelWheelIdleSnap();
    wheelIdleFramesRef.current = 0;

    const tick = () => {
      wheelIdleFramesRef.current += 1;
      if (wheelIdleFramesRef.current < WHEEL_IDLE_FRAMES) {
        wheelIdleRafRef.current = requestAnimationFrame(tick);
        return;
      }
      wheelIdleRafRef.current = null;
      snapToNearestOffset(liveScrollXRef.current);
    };

    wheelIdleRafRef.current = requestAnimationFrame(tick);
  }, [cancelWheelIdleSnap, isMagnetAnimatingRef, liveScrollXRef, snapToNearestOffset]);

  useEffect(() => {
    return () => {
      cancelMagnetAnimation();
      cancelWheelIdleSnap();
    };
  }, [cancelMagnetAnimation, cancelWheelIdleSnap]);

  return {
    clampScrollOffset,
    snapToNearestOffset,
    scheduleWheelSnapAfterIdle,
    cancelMagnetAnimation,
    cancelWheelIdleSnap,
    animateSnapTo,
    isProgrammaticScroll: glide.isProgrammaticScroll,
    isMagnetAnimatingRef,
  };
}

type MagnetSnap = ReturnType<typeof useMagnetSnap>;

/** Centers the "Now" hour once, as soon as the viewport has a width. */
function useInitialChartScroll(params: {
  nowIdx: number;
  count: number;
  maxIndex: number;
  viewportWidth: number;
  scrollRef: ScrollRef;
  publishScrollOffset: PublishScrollOffset;
}) {
  const { nowIdx, count, maxIndex, viewportWidth, scrollRef, publishScrollOffset } = params;
  const hasInitialScroll = useRef(false);

  // Web lays out synchronously and keeps its position across relayouts, so
  // unlike native this never needs re-asserting.
  useEffect(() => {
    if (viewportWidth <= 0 || count === 0 || hasInitialScroll.current) return;
    hasInitialScroll.current = true;
    const x = chartScrollOffsetForIndex(nowIdx, viewportWidth, maxIndex);
    scrollRef.current?.scrollTo({ x, animated: false });
    publishScrollOffset(x, false);
  }, [viewportWidth, count, nowIdx, maxIndex, scrollRef, publishScrollOffset]);
}

/** Wires the ScrollView's scroll and drag callbacks to selection and the magnet. */
function useScrollHandlers(params: {
  magnet: MagnetSnap;
  syncSelectionFromScroll: PublishScrollOffset;
  publishScrollOffset: PublishScrollOffset;
  setIsScrollIdle: (idle: boolean) => void;
  selectionHapticEnabledRef: RefObject<boolean>;
}) {
  const {
    magnet,
    syncSelectionFromScroll,
    publishScrollOffset,
    setIsScrollIdle,
    selectionHapticEnabledRef,
  } = params;
  const {
    cancelMagnetAnimation,
    cancelWheelIdleSnap,
    clampScrollOffset,
    isMagnetAnimatingRef,
    isProgrammaticScroll,
    scheduleWheelSnapAfterIdle,
    snapToNearestOffset,
  } = magnet;
  const [isScrolling, setIsScrolling] = useState(false);

  const onScrollBeginDrag = useCallback(() => {
    selectionHapticEnabledRef.current = true;
    setIsScrolling(true);
    setIsScrollIdle(false);
    cancelMagnetAnimation();
    cancelWheelIdleSnap();
  }, [cancelMagnetAnimation, cancelWheelIdleSnap, selectionHapticEnabledRef, setIsScrollIdle]);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionFromScroll(event.nativeEvent.contentOffset.x, false);
      snapToNearestOffset(event.nativeEvent.contentOffset.x);
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) < 0.01) setIsScrolling(false);
    },
    [snapToNearestOffset, syncSelectionFromScroll],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionFromScroll(event.nativeEvent.contentOffset.x, false);
      snapToNearestOffset(event.nativeEvent.contentOffset.x);
      setIsScrolling(false);
    },
    [snapToNearestOffset, syncSelectionFromScroll],
  );

  const onWebScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // The glide already published this offset; only a real scroll interrupts it.
      if (isProgrammaticScroll(event.nativeEvent.contentOffset.x)) return;
      if (isMagnetAnimatingRef.current) cancelMagnetAnimation();

      const offsetX = clampScrollOffset(event.nativeEvent.contentOffset.x);
      publishScrollOffset(offsetX, true);
      setIsScrollIdle(false);
      scheduleWheelSnapAfterIdle();
    },
    [
      cancelMagnetAnimation,
      clampScrollOffset,
      isMagnetAnimatingRef,
      isProgrammaticScroll,
      publishScrollOffset,
      scheduleWheelSnapAfterIdle,
      setIsScrollIdle,
    ],
  );

  return { isScrolling, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd, onWebScroll };
}

export function useHourlyScrollPicker(
  nowIdx: number,
  count: number,
  onSelectedChange?: (nextIdx: number, prevIdx: number) => void,
): HourlyScrollPicker {
  const { viewportWidth, onViewportLayout, maxIndex, contentPadding, snapOffsets } =
    useChartViewport(count);
  const [liveScrollX, setLiveScrollX] = useState(-1);
  const [isScrollIdle, setIsScrollIdle] = useState(true);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(CHART_SCROLL_UNSET);
  const liveScrollXRef = useRef(-1);

  const { selectedIdx, syncSelectionFromScroll, selectionHapticEnabledRef } = useScrollSelection(
    nowIdx,
    maxIndex,
    viewportWidth,
    onSelectedChange,
  );

  const publishScrollOffset = useCallback(
    (offsetX: number, haptic: boolean) => {
      scrollX.set(offsetX);
      liveScrollXRef.current = offsetX;
      setLiveScrollX(offsetX);
      syncSelectionFromScroll(offsetX, haptic);
    },
    [scrollX, syncSelectionFromScroll],
  );

  const magnet = useMagnetSnap({
    viewportWidth,
    maxIndex,
    snapOffsets,
    scrollRef,
    liveScrollXRef,
    publishScrollOffset,
    setIsScrollIdle,
  });

  useInitialChartScroll({ nowIdx, count, maxIndex, viewportWidth, scrollRef, publishScrollOffset });

  const handlers = useScrollHandlers({
    magnet,
    syncSelectionFromScroll,
    publishScrollOffset,
    setIsScrollIdle,
    selectionHapticEnabledRef,
  });

  const { animateSnapTo, cancelWheelIdleSnap } = magnet;
  const scrollToIndex = useCallback(
    (targetIdx: number) => {
      if (viewportWidth <= 0) return;
      const clamped = Math.min(Math.max(0, targetIdx), maxIndex);
      const targetOffset = chartScrollOffsetForIndex(clamped, viewportWidth, maxIndex);
      selectionFeedback();
      cancelWheelIdleSnap();
      const current = liveScrollXRef.current;
      if (Math.abs(current - targetOffset) > 1) animateSnapTo(current, targetOffset);
    },
    [animateSnapTo, cancelWheelIdleSnap, maxIndex, viewportWidth],
  );

  return {
    scrollRef,
    scrollX,
    liveScrollX,
    isScrollIdle,
    selectedIdx,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler: undefined,
    onViewportLayout,
    onContentSizeChange: undefined,
    scrollToIndex,
    ...handlers,
  };
}

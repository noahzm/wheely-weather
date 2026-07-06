import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  chartClampScrollOffset,
  chartContentPadding,
  chartIndexFromScrollOffset,
  chartNearestSnapOffset,
  chartScrollOffsetForIndex,
  chartSnapOffsets,
} from '@/utils/hourlyChart';
import { selectionFeedback } from '@/utils/haptics';

/** Duration of the web magnet glide (ms). */
const SNAP_ANIM_MS = 340;
/** Wheel/trackpad: wait this many frames after last scroll before magnetizing. */
const WHEEL_IDLE_FRAMES = 2;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Tracks the selected hour index and maps scroll offsets onto it. */
function useScrollSelection(
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

/** Web-only magnetized snapping: glides the scroller to the nearest hour. */
function useWebMagnetSnap(params: {
  isWeb: boolean;
  viewportWidth: number;
  maxIndex: number;
  snapOffsets: number[];
  scrollRef: RefObject<Animated.ScrollView | null>;
  liveScrollXRef: RefObject<number>;
  publishScrollOffset: (offsetX: number, haptic: boolean) => void;
  setIsScrollIdle: (idle: boolean) => void;
}) {
  const {
    isWeb,
    viewportWidth,
    maxIndex,
    snapOffsets,
    scrollRef,
    liveScrollXRef,
    publishScrollOffset,
    setIsScrollIdle,
  } = params;

  const wheelIdleRafRef = useRef<number | null>(null);
  const wheelIdleFramesRef = useRef(0);
  const magnetFrameRef = useRef<number | null>(null);
  const isMagnetAnimatingRef = useRef(false);

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

  const cancelMagnetAnimation = useCallback(() => {
    if (magnetFrameRef.current != null) {
      cancelAnimationFrame(magnetFrameRef.current);
      magnetFrameRef.current = null;
    }
    isMagnetAnimatingRef.current = false;
  }, []);

  const finishSnap = useCallback(
    (target: number) => {
      cancelMagnetAnimation();
      publishScrollOffset(target, false);
      scrollRef.current?.scrollTo({ x: target, animated: false });
      setIsScrollIdle(true);
    },
    [cancelMagnetAnimation, publishScrollOffset, scrollRef, setIsScrollIdle],
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
        scrollRef.current?.scrollTo({ x, animated: false });

        if (t < 1) {
          magnetFrameRef.current = requestAnimationFrame(step);
          return;
        }

        magnetFrameRef.current = null;
        finishSnap(to);
      };

      magnetFrameRef.current = requestAnimationFrame(step);
    },
    [cancelMagnetAnimation, finishSnap, publishScrollOffset, scrollRef, setIsScrollIdle],
  );

  const snapToNearestOffset = useCallback(
    (offsetX: number) => {
      if (!isWeb || viewportWidth <= 0 || snapOffsets.length === 0) return;
      const clamped = clampScrollOffset(offsetX);
      const nearest = chartNearestSnapOffset(clamped, snapOffsets);
      if (Math.abs(clamped - nearest) < 0.5 && Math.abs(offsetX - clamped) < 0.5) {
        finishSnap(nearest);
        return;
      }
      animateSnapTo(clamped, nearest);
    },
    [animateSnapTo, clampScrollOffset, finishSnap, isWeb, viewportWidth, snapOffsets],
  );

  const scheduleWheelSnapAfterIdle = useCallback(() => {
    if (!isWeb || isMagnetAnimatingRef.current) return;
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
  }, [cancelWheelIdleSnap, isWeb, liveScrollXRef, snapToNearestOffset]);

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
    isMagnetAnimatingRef,
  };
}

/** Wires the ScrollView gesture callbacks to selection + magnet-snap logic. */
function useScrollGestureHandlers(params: {
  isWeb: boolean;
  syncSelectionFromScroll: (offsetX: number, haptic: boolean) => void;
  snapToNearestOffset: (offsetX: number) => void;
  clampScrollOffset: (offsetX: number) => number;
  publishScrollOffset: (offsetX: number, haptic: boolean) => void;
  scheduleWheelSnapAfterIdle: () => void;
  cancelMagnetAnimation: () => void;
  cancelWheelIdleSnap: () => void;
  setIsScrollIdle: (idle: boolean) => void;
  isMagnetAnimatingRef: RefObject<boolean>;
  selectionHapticEnabledRef: RefObject<boolean>;
}) {
  const {
    isWeb,
    syncSelectionFromScroll,
    snapToNearestOffset,
    clampScrollOffset,
    publishScrollOffset,
    scheduleWheelSnapAfterIdle,
    cancelMagnetAnimation,
    cancelWheelIdleSnap,
    setIsScrollIdle,
    isMagnetAnimatingRef,
    selectionHapticEnabledRef,
  } = params;
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
      if (isWeb) snapToNearestOffset(event.nativeEvent.contentOffset.x);
      const velocityX = event.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(velocityX) < 0.01) {
        setIsScrolling(false);
      }
    },
    [isWeb, snapToNearestOffset, syncSelectionFromScroll],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncSelectionFromScroll(event.nativeEvent.contentOffset.x, false);
      if (isWeb) snapToNearestOffset(event.nativeEvent.contentOffset.x);
      setIsScrolling(false);
    },
    [isWeb, snapToNearestOffset, syncSelectionFromScroll],
  );

  const onWebScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isMagnetAnimatingRef.current) {
        cancelMagnetAnimation();
      }

      const offsetX = clampScrollOffset(event.nativeEvent.contentOffset.x);
      publishScrollOffset(offsetX, true);
      setIsScrollIdle(false);
      scheduleWheelSnapAfterIdle();
    },
    [
      cancelMagnetAnimation,
      clampScrollOffset,
      isMagnetAnimatingRef,
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
) {
  const maxIndex = Math.max(0, count - 1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [liveScrollX, setLiveScrollX] = useState(-1);
  const [isScrollIdle, setIsScrollIdle] = useState(true);
  const isWeb = Platform.OS === 'web';
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(-1);
  // Last index dispatched to React from the scroll worklet, so the UI→JS hop
  // happens once per hour-crossing instead of on every scroll frame.
  const lastNotifiedIdx = useSharedValue(-1);
  const hasInitialScroll = useRef(false);
  const liveScrollXRef = useRef(-1);

  const contentPadding = viewportWidth > 0 ? chartContentPadding(viewportWidth) : 0;
  const snapOffsets = useMemo(() => chartSnapOffsets(count, viewportWidth), [count, viewportWidth]);

  const { selectedIdx, syncSelectionFromScroll, selectionHapticEnabledRef } = useScrollSelection(
    nowIdx,
    maxIndex,
    viewportWidth,
    onSelectedChange,
  );

  const publishScrollOffset = useCallback(
    (offsetX: number, haptic: boolean) => {
      // Reanimated shared values are mutable by design; the immutability rule
      // can't model worklet-driven `.value` writes.
      // eslint-disable-next-line react-hooks/immutability
      scrollX.value = offsetX;
      liveScrollXRef.current = offsetX;
      setLiveScrollX(offsetX);
      syncSelectionFromScroll(offsetX, haptic);
    },
    [scrollX, syncSelectionFromScroll],
  );

  const {
    clampScrollOffset,
    snapToNearestOffset,
    scheduleWheelSnapAfterIdle,
    cancelMagnetAnimation,
    cancelWheelIdleSnap,
    isMagnetAnimatingRef,
  } = useWebMagnetSnap({
    isWeb,
    viewportWidth,
    maxIndex,
    snapOffsets,
    scrollRef,
    liveScrollXRef,
    publishScrollOffset,
    setIsScrollIdle,
  });

  useEffect(() => {
    if (viewportWidth <= 0 || count === 0 || hasInitialScroll.current) return;
    hasInitialScroll.current = true;
    const x = chartScrollOffsetForIndex(nowIdx, viewportWidth, maxIndex);
    scrollRef.current?.scrollTo({ x, animated: false });
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared value write
    scrollX.value = x;
    lastNotifiedIdx.value = nowIdx;
    if (isWeb) {
      liveScrollXRef.current = x;
      // One-time imperative sync of the initial scroll position into React state
      // for the web magnet logic; runs once guarded by hasInitialScroll.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveScrollX(x);
    }
    syncSelectionFromScroll(x, false);
  }, [
    viewportWidth,
    nowIdx,
    maxIndex,
    count,
    syncSelectionFromScroll,
    isWeb,
    scrollX,
    lastNotifiedIdx,
  ]);

  const onViewportLayout = useCallback((width: number) => {
    if (width > 0) {
      setViewportWidth((prev) => (prev === width ? prev : width));
    }
  }, []);

  const { isScrolling, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd, onWebScroll } =
    useScrollGestureHandlers({
      isWeb,
      syncSelectionFromScroll,
      snapToNearestOffset,
      clampScrollOffset,
      publishScrollOffset,
      scheduleWheelSnapAfterIdle,
      cancelMagnetAnimation,
      cancelWheelIdleSnap,
      setIsScrollIdle,
      isMagnetAnimatingRef,
      selectionHapticEnabledRef,
    });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // eslint-disable-next-line react-hooks/immutability -- reanimated shared value write
      scrollX.value = event.contentOffset.x;
      if (viewportWidth <= 0) return;
      // Only hop to the JS thread when the hour under the needle changes; the
      // end-drag/momentum handlers re-sync unconditionally as a safety net.
      const idx = chartIndexFromScrollOffset(event.contentOffset.x, viewportWidth, maxIndex);
      if (idx === lastNotifiedIdx.value) return;
      // eslint-disable-next-line react-hooks/immutability -- reanimated shared value write
      lastNotifiedIdx.value = idx;
      scheduleOnRN(syncSelectionFromScroll, event.contentOffset.x, true);
    },
  });

  return {
    scrollRef,
    scrollX,
    liveScrollX,
    isScrollIdle,
    selectedIdx,
    isScrolling,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler: isWeb ? undefined : scrollHandler,
    onWebScroll: isWeb ? onWebScroll : undefined,
    onViewportLayout,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}

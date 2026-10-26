import { useEffect, useRef, type RefObject } from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useScrollToTop } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { foldRestOffset, largeTitleTopOffset } from '@/utils/largeTitleScroll';

interface RestTracking {
  /** The lowest offset seen while UIKit placed the page; null until the first scroll event. */
  rest: number | null;
  /** Set once a drag or a refresh moves the page, after which offsets are no longer the rest. */
  frozen: boolean;
  topInset: number;
}

/**
 * Scrolls a large-title screen back to the top, with the title expanded,
 * when its tab is tapped again. The tab's own scroll to top stops at the
 * current inset's edge, which leaves a collapsed title collapsed, so pair
 * this with `disableScrollToTop` on the tab trigger.
 *
 * Returns props to spread onto the ScrollView: the handlers that measure the
 * rest offset (calling `onScroll` too), and `scrollToOverflowEnabled`, since
 * React Native otherwise clamps `scrollTo` to the collapsed edge as well.
 * Web has no tab bar to tap, so it gets none.
 */
export function useLargeTitleScrollToTop(
  scrollRef: RefObject<ScrollViewInstance | null>,
  refreshing: boolean,
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
  const insets = useSafeAreaInsets();
  // A refresh already running at mount moves the page before it is measured.
  const tracking = useRef<RestTracking>({ rest: null, frozen: refreshing, topInset: insets.top });

  useEffect(() => {
    tracking.current.topInset = insets.top;
  }, [insets.top]);

  useEffect(() => {
    if (refreshing) tracking.current.frozen = true;
  }, [refreshing]);

  const target = useRef({
    scrollToTop: () => {
      const { rest, topInset } = tracking.current;
      scrollRef.current?.scrollTo({ y: largeTitleTopOffset(rest, topInset), animated: true });
    },
  });
  useScrollToTop(target);

  if (Platform.OS === 'web') return { onScroll };
  return {
    scrollToOverflowEnabled: true,
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll?.(event);
      const state = tracking.current;
      if (state.frozen) return;
      state.rest = foldRestOffset(state.rest, event.nativeEvent.contentOffset.y);
    },
    onScrollBeginDrag: () => {
      tracking.current.frozen = true;
    },
  };
}

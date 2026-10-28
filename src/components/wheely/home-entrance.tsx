// Home's entrance, played over the scene's own (the hills rolling up, the sun
// rising, the clouds drifting in): the verdict card slaps on like a sticker,
// its stars pop on (RideVerdict), then the sections rise up out of the hills
// one by one. On iOS it starts from the launch screen's bare sky
// (scripts/render-launch-sky.mjs), so the app opening reads as the scene
// coming to life.
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const isWeb = Platform.OS === 'web';

// Web tab switches remount Home, so the entrance plays only on the first home
// mount per session there; native tabs keep the screen mounted.
let hasPlayedWebEntrance = false;

const VERDICT_DELAY_MS = 260;
const VERDICT_DURATION_MS = 560;
/** When the first section after the verdict (the alerts, else Hour by hour) starts to rise. */
const SECTIONS_START_MS = 520;
const STAGGER_STEP_MS = 100;
const STAGGER_DURATION_MS = 480;
const STAGGER_RISE = 28;

/**
 * Whether Home's content makes its entrance: on its first mount, which on web
 * is once per session, and never under Reduce Motion.
 */
export function useHomeEntrance(): boolean {
  const reduceMotion = useReducedMotion();
  const [skipEntrance] = useState(() => isWeb && hasPlayedWebEntrance);
  useEffect(() => {
    hasPlayedWebEntrance = true;
  }, []);
  return !reduceMotion && !skipEntrance;
}

/** The verdict card's `slap` or a section's `rise`; order 0 (a status line) rises at once. */
function staggerDelay(order: number, variant: 'slap' | 'rise'): number {
  if (variant === 'slap') return VERDICT_DELAY_MS;
  return order === 0 ? 0 : SECTIONS_START_MS + Math.max(0, order - 2) * STAGGER_STEP_MS;
}

/**
 * Staggered entrance for each home section.
 *
 * Driven by a shared value rather than reanimated's `entering` prop: layout
 * entering animations are fire-and-forget, so an interruption (a snapshot
 * re-render as the cache hydrates and the live fetch lands, or a tab
 * transition) strands the view at a partial opacity. That washes out the whole
 * card subtree uniformly — border, text, icons, and chart colors alike — and it
 * hits later sections hardest because their delay is longest. A value that is
 * always driven toward 1 settles no matter how often the tree re-renders.
 */
export function Stagger({
  order,
  variant = 'rise',
  children,
}: Readonly<{ order: number; variant?: 'slap' | 'rise'; children: ReactNode }>) {
  const animate = useHomeEntrance();
  const progress = useSharedValue(animate ? 0 : 1);
  const slap = variant === 'slap';

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      staggerDelay(order, slap ? 'slap' : 'rise'),
      withTiming(1, {
        duration: slap ? VERDICT_DURATION_MS : STAGGER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [animate, order, progress, slap]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    if (slap) {
      // Lands a touch big and tilted, overshoots, then settles flat.
      return {
        opacity: interpolate(p, [0, 0.3], [0, 1], Extrapolation.CLAMP),
        transform: [
          { scale: interpolate(p, [0, 0.6, 1], [1.16, 0.97, 1]) },
          { rotate: `${interpolate(p, [0, 0.6, 1], [-4, 0.8, 0])}deg` },
        ],
      };
    }
    return { opacity: p, transform: [{ translateY: (1 - p) * STAGGER_RISE }] };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

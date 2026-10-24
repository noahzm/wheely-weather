import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  css,
  cubicBezier,
  useReducedMotion,
  type CSSAnimationPlayState,
  type CSSKeyframesRule,
} from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';

// Every moving piece of the home scene is its own small view, animated with
// transforms and opacity only, so the system composites the motion without
// redrawing any SVG. The loops are slow and small: the scene is ambient, not a
// show.

/**
 * How the scene moves: `null` holds every piece still in its resting pose
 * (Reduce Motion). Otherwise the loops run while Home is the visible tab and
 * pause behind the others, and `enter` says whether the pieces arrive with
 * an entrance.
 */
export type Motion = { state: CSSAnimationPlayState; enter: boolean } | null;

const isWeb = Platform.OS === 'web';

// Web tab switches remount Home, so the scene makes its entrance only the
// first time per session there, like the sections' stagger; native tabs keep
// the screen mounted.
let hasPlayedWebEntrance = false;

export function useSceneMotion(): Motion {
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [enter] = useState(() => !(isWeb && hasPlayedWebEntrance));
  useEffect(() => {
    hasPlayedWebEntrance = true;
  }, []);
  if (reduceMotion) return null;
  return { state: focused ? 'running' : 'paused', enter };
}

const ENTRANCE_MS = 1100;
const EASE_OUT = cubicBezier(0.22, 1, 0.36, 1);

/** The sun comes up from behind the hills. */
export const RISE = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 56 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});
/** Clouds and fog drift in from the left. */
export const DRIFT_IN = css.keyframes({
  from: { opacity: 0, transform: [{ translateX: -40 }] },
  to: { opacity: 1, transform: [{ translateX: 0 }] },
});
/** The sun's glow swells and settles, like heat shimmer. */
export const GLOW = css.keyframes({
  from: { opacity: 0.7, transform: [{ scale: 0.92 }] },
  to: { opacity: 1, transform: [{ scale: 1.08 }] },
});
/** A cloud's slow back-and-forth. */
export const SWAY = css.keyframes({
  from: { transform: [{ translateX: 0 }] },
  to: { transform: [{ translateX: 22 }] },
});
/** The partly cloudy sky's cloud slides off the sun and back over it. */
export const PEEK = css.keyframes({
  from: { transform: [{ translateX: 0 }] },
  to: { transform: [{ translateX: -40 }] },
});

/** A one-time entrance as the scene appears; nothing under Reduce Motion or on a web return. */
export function entrance(motion: Motion, keyframes: CSSKeyframesRule, delay = 0) {
  if (!motion?.enter) return null;
  return {
    animationName: keyframes,
    animationDuration: ENTRANCE_MS,
    animationDelay: delay,
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'backwards' as const,
    animationPlayState: motion.state,
  };
}

interface LoopSettings {
  duration: number;
  delay?: number;
  /** Swing back and forth with easing instead of restarting at a steady pace. */
  alternate?: boolean;
}

/** A looping animation while Home is showing; nothing under Reduce Motion. */
export function loop(motion: Motion, keyframes: CSSKeyframesRule, settings: LoopSettings) {
  if (motion == null) return null;
  return {
    animationName: keyframes,
    animationDuration: settings.duration,
    animationDelay: settings.delay ?? 0,
    animationIterationCount: 'infinite' as const,
    animationDirection: settings.alternate ? ('alternate' as const) : ('normal' as const),
    animationTimingFunction: settings.alternate ? ('ease-in-out' as const) : ('linear' as const),
    animationFillMode: 'backwards' as const,
    animationPlayState: motion.state,
  };
}

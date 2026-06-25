/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#161310',
    background: '#ffffff',
    backgroundElement: '#F5F1F6',
    backgroundSelected: '#CFC4DC',
    textSecondary: '#5f5867',
  },
  dark: {
    text: '#F2E8D8',
    background: '#000000',
    backgroundElement: '#1F1B24',
    backgroundSelected: '#413B4B',
    textSecondary: '#CFC4DC',
  },
} as const;

type WheelyConditionColors = {
  good: { bg: string; ink: string };
  fair: { bg: string; ink: string };
  marginal: { bg: string; ink: string };
  poor: { bg: string; ink: string };
  bad: { bg: string; ink: string };
};

export type WheelyPalette = {
  background: string;
  paper: string;
  ink: string;
  mutedInk: string;
  border: string;
  primary: string;
  primaryInk: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  condition: WheelyConditionColors;
};

/**
 * Neobrutalist "race-day cue sheet" palette, ported from the Astro site's
 * daisyUI `wheely` (light) and `wheely-night` (dark) themes. In dark mode the
 * ink flips to cream and the ride-condition ramp brightens for contrast.
 */
export const WheelyTheme: { light: WheelyPalette; dark: WheelyPalette } = {
  light: {
    background: '#ffffff',
    paper: '#F5F1F6',
    ink: '#161310',
    mutedInk: '#5f5867',
    border: '#CFC4DC',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#236F49',
    warning: '#FFD20A',
    error: '#FF642C',
    condition: {
      good: { bg: '#1d6f47', ink: '#f8f1e5' },
      fair: { bg: '#a98500', ink: '#161310' },
      marginal: { bg: '#c66d00', ink: '#161310' },
      poor: { bg: '#e8431f', ink: '#161310' },
      bad: { bg: '#a3150f', ink: '#f8f1e5' },
    },
  },
  dark: {
    background: '#000000',
    paper: '#1F1B24',
    ink: '#F2E8D8',
    mutedInk: '#B5AB9C',
    border: '#413B4B',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#2E8B5F',
    warning: '#FFD20A',
    error: '#FF6A42',
    condition: {
      good: { bg: '#4ec488', ink: '#161310' },
      fair: { bg: '#ffd20a', ink: '#161310' },
      marginal: { bg: '#ff9d3d', ink: '#161310' },
      poor: { bg: '#ff6a42', ink: '#161310' },
      bad: { bg: '#ff4757', ink: '#161310' },
    },
  },
};

/**
 * @deprecated Static light palette kept for backwards compatibility. Prefer
 * `useWheelyColors()` so components react to the active color scheme.
 */
export const WheelyColors = WheelyTheme.light;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Typeface roles ported from the Astro site: Archivo (stretched display),
 * IBM Plex Sans (body), IBM Plex Mono (kickers/labels). On web these resolve to
 * the `@fontsource` families loaded via `global.css`; on native they map to the
 * `@expo-google-fonts` families loaded in the root layout.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'IBMPlexSans_500Medium',
    display: 'Archivo_800ExtraBold',
    serif: 'ui-serif',
    rounded: 'IBMPlexSans_600SemiBold',
    mono: 'IBMPlexMono_600SemiBold',
  },
  default: {
    sans: 'IBMPlexSans_500Medium',
    display: 'Archivo_800ExtraBold',
    serif: 'serif',
    rounded: 'IBMPlexSans_600SemiBold',
    mono: 'IBMPlexMono_600SemiBold',
  },
  web: {
    sans: 'var(--font-sans)',
    display: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

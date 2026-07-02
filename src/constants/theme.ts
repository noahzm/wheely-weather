/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

interface WheelyConditionColors {
  good: { bg: string; ink: string };
  fair: { bg: string; ink: string };
  marginal: { bg: string; ink: string };
  poor: { bg: string; ink: string };
  bad: { bg: string; ink: string };
}

export interface WheelyPalette {
  background: string;
  paper: string;
  ink: string;
  mutedInk: string;
  border: string;
  shadow: string;
  primary: string;
  primaryInk: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  condition: WheelyConditionColors;
}

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
    mutedInk: '#161310',
    border: '#CFC4DC',
    shadow: '#161310',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#236F49',
    warning: '#FFD20A',
    error: '#FF642C',
    condition: {
      good: { bg: '#078044', ink: '#ffffff' },
      fair: { bg: '#1b63f3', ink: '#ffffff' },
      marginal: { bg: '#f0b000', ink: '#161310' },
      poor: { bg: '#d66400', ink: '#161310' },
      bad: { bg: '#da1d0b', ink: '#ffffff' },
    },
  },
  dark: {
    background: '#000000',
    paper: '#1F1B24',
    ink: '#F2E8D8',
    mutedInk: '#F2E8D8',
    border: '#413B4B',
    shadow: '#161310',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#2E8B5F',
    warning: '#FFD20A',
    error: '#FF6A42',
    condition: {
      good: { bg: '#58eea3', ink: '#161310' },
      fair: { bg: '#5885ee', ink: '#161310' },
      marginal: { bg: '#eed058', ink: '#161310' },
      poor: { bg: '#ee9e58', ink: '#161310' },
      bad: { bg: '#ee6758', ink: '#161310' },
    },
  },
};

/**
 * Keys of WheelyPalette that resolve to a single color string (excludes the
 * nested `condition` map). Use this as the prop type for components that accept
 * a palette color by name (e.g. ThemedText, ThemedView).
 */
export type ThemeColor = keyof Omit<WheelyPalette, 'condition'>;

/**
 * Typeface roles: National Park (all roles — display, body, labels, kickers).
 * On web these resolve to the `@fontsource` families loaded via `global.css`
 * (paired with the `useFonts` runtime load in the root layout for `@font-face`).
 * On native they resolve to the `National Park` family embedded at build time by
 * the `expo-font` config plugin (Android XML resources, iOS bundled files), so
 * `fontWeight` (e.g. `FontWeightBold` = 700) selects the right variant natively.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'National Park',
    display: 'National Park',
    serif: 'ui-serif',
    rounded: 'National Park',
    mono: 'National Park',
    monoBold: 'National Park',
  },
  default: {
    sans: 'National Park',
    display: 'National Park',
    serif: 'serif',
    rounded: 'National Park',
    mono: 'National Park',
    monoBold: 'National Park',
  },
  web: {
    sans: 'var(--font-sans)',
    display: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    monoBold: 'var(--font-mono-bold)',
  },
});

/**
 * Weight to pair with Fonts.display / Fonts.monoBold. On native, `Fonts.*`
 * resolve to the weighted `National Park` family, so 700 selects the bold
 * variant embedded by the expo-font config plugin. On web those roles resolve
 * to dedicated @font-face family names (expo-font); fontWeight 400 is correct
 * because the family itself is already the bold face.
 */
export const FontWeightBold = Platform.select({
  web: '400' as const,
  default: '700' as const,
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
export const TRANSPARENT = 'transparent' as const;

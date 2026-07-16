/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

const IOS_BODY_FONT = 'Ronzino-Regular';
const DEFAULT_BODY_FONT = 'Ronzino-Regular';
const IOS_HEADING_FONT = 'Ronzino-Medium';
const DEFAULT_HEADING_FONT = 'Ronzino-Medium';
const IOS_DISPLAY_FONT = 'Ronzino-Bold';
const DEFAULT_DISPLAY_FONT = 'Ronzino-Bold';
const IOS_CITY_FONT = 'Ronzino-Medium';
const DEFAULT_CITY_FONT = 'Ronzino-Medium';

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
  link: string;
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
    mutedInk: '#655E68',
    border: '#CFC4DC',
    shadow: '#161310',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#236F49',
    warning: '#FFD20A',
    error: '#FF642C',
    link: '#3c87f7',
    condition: {
      good: { bg: '#078044', ink: '#ffffff' },
      fair: { bg: '#1b63f3', ink: '#ffffff' },
      marginal: { bg: '#f0b000', ink: '#161310' },
      poor: { bg: '#d66400', ink: '#161310' },
      bad: { bg: '#da1d0b', ink: '#ffffff' },
    },
  },
  dark: {
    background: '#121014',
    paper: '#211D27',
    ink: '#F4EBDD',
    mutedInk: '#B7AA9B',
    border: '#4A4254',
    shadow: '#09080B',
    primary: '#C6A2ED',
    primaryInk: '#161310',
    secondary: '#FFD20A',
    accent: '#A6D8DC',
    success: '#2ECC71',
    warning: '#FFD20A',
    error: '#FF6A42',
    link: '#6BA4F9',
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
 * Typeface roles resolve by platform:
 * - web: CSS variables from `global.css` (including local @font-face declarations)
 * - native: family names embedded by the `expo-font` config plugin
 */
export const Fonts = Platform.select({
  ios: {
    body: IOS_BODY_FONT,
    heading: IOS_HEADING_FONT,
    display: IOS_DISPLAY_FONT,
    city: IOS_CITY_FONT,
    serif: IOS_BODY_FONT,
    rounded: IOS_HEADING_FONT,
  },
  default: {
    body: DEFAULT_BODY_FONT,
    heading: DEFAULT_HEADING_FONT,
    display: DEFAULT_DISPLAY_FONT,
    city: DEFAULT_CITY_FONT,
    serif: DEFAULT_BODY_FONT,
    rounded: DEFAULT_HEADING_FONT,
  },
  web: {
    body: 'var(--font-body)',
    heading: 'var(--font-heading)',
    display: 'var(--font-display)',
    city: 'var(--font-city)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
  },
});

/**
 * Weight to pair with Fonts.heading / Fonts.display.
 * Pair Fonts.body with 400.
 */
export const FontWeightMedium = Platform.select({
  web: '500' as const,
  ios: '500' as const,
  default: '500' as const,
});

export const FontWeightBold = Platform.select({
  web: '700' as const,
  ios: '700' as const,
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

/**
 * Typography scale. Every on-screen fontSize/lineHeight pairs one of these —
 * do not hardcode sizes in component styles.
 */
export const Type = {
  /** chip labels, tab labels */
  micro: { fontSize: 11, lineHeight: 14 },
  /** code, fine print */
  caption: { fontSize: 12, lineHeight: 16 },
  /** muted/secondary text */
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 24 },
  /** section titles, day temps */
  heading: { fontSize: 22, lineHeight: 28 },
  /** big numerics (verdict, metric values) */
  stat: { fontSize: 28, lineHeight: 32 },
  subtitle: { fontSize: 32, lineHeight: 44 },
  display: { fontSize: 48, lineHeight: 52 },
} as const;

/**
 * Corner radius scale. Chips/pills stay square (neobrutalist); cards and
 * buttons share `card`; `pill` covers badges and circular buttons.
 */
export const Radius = {
  none: 0,
  /** nested elements inside a card */
  small: 8,
  card: 12,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const TRANSPARENT = 'transparent' as const;

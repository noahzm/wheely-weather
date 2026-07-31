import '@/global.css';

import { Platform } from 'react-native';

const SANS_FONT = 'AlteHaasGrotesk';
const SANS_BOLD_FONT = 'AlteHaasGrotesk_Bold';

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
  accent: string;
  /** Text/icon color for content rendered on an `accent` background. */
  accentInk: string;
  success: string;
  warning: string;
  error: string;
  link: string;
  condition: WheelyConditionColors;
}

/**
 * Punk zine palette on a native iOS shell: system grouped backgrounds
 * (`background` = systemGroupedBackground, `paper` = the elevated card
 * surface) with `#F1BDF2` as the single shout color (`warning` stays yellow
 * so non-extreme alert chrome reads distinctly from `error`). Cards render
 * as `paper` in the active scheme — no inversion.
 */
export const WheelyTheme: { light: WheelyPalette; dark: WheelyPalette } = {
  light: {
    background: '#F4F4F6',
    paper: '#FFFFFF',
    ink: '#000000',
    mutedInk: '#3A3A3C',
    border: '#000000',
    shadow: '#000000',
    primary: '#000000',
    primaryInk: '#FFFFFF',
    accent: '#F1BDF2',
    accentInk: '#000000',
    success: '#2ECC71',
    warning: '#FFD20A',
    error: '#FF5252',
    link: '#2563EB',
    condition: {
      good: { bg: '#2ECC71', ink: '#000000' },
      fair: { bg: '#38BDF8', ink: '#000000' },
      marginal: { bg: '#FFD20A', ink: '#000000' },
      poor: { bg: '#FF9F0A', ink: '#000000' },
      bad: { bg: '#FF5252', ink: '#000000' },
    },
  },
  dark: {
    background: '#000000',
    paper: '#141416',
    ink: '#FFFFFF',
    mutedInk: '#E5E5EA',
    border: '#FFFFFF',
    shadow: '#FFFFFF',
    primary: '#FFFFFF',
    primaryInk: '#000000',
    accent: '#F1BDF2',
    accentInk: '#000000',
    success: '#2ECC71',
    warning: '#FFD20A',
    error: '#FF5252',
    link: '#6BA4F9',
    condition: {
      good: { bg: '#2ECC71', ink: '#000000' },
      fair: { bg: '#38BDF8', ink: '#000000' },
      marginal: { bg: '#FFD20A', ink: '#000000' },
      poor: { bg: '#FF9F0A', ink: '#000000' },
      bad: { bg: '#FF5252', ink: '#000000' },
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
  web: {
    body: 'var(--font-body)',
    heading: 'var(--font-heading)',
    display: 'var(--font-display)',
    city: 'var(--font-city)',
    bold: 'var(--font-bold)',
  },
  default: {
    body: SANS_FONT,
    heading: SANS_FONT,
    display: SANS_FONT,
    city: SANS_BOLD_FONT,
    bold: SANS_BOLD_FONT,
  },
});

/**
 * Weight to pair with Fonts.city / Fonts.bold (Alte Haas Grotesk Bold, 700) so
 * font matching resolves to the Bold face. The regular family only ships 400,
 * so roles using Fonts.body/heading/display need no explicit weight.
 */
export const FontWeightBlack = '700' as const;

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
  micro: { fontSize: 13, lineHeight: 16 },
  /** code, fine print */
  caption: { fontSize: 14, lineHeight: 18 },
  /** muted/secondary text */
  small: { fontSize: 15, lineHeight: 20 },
  body: { fontSize: 18, lineHeight: 26 },
  /** section titles, day temps */
  heading: { fontSize: 24, lineHeight: 30 },
  /** big numerics (verdict, metric values) */
  stat: { fontSize: 30, lineHeight: 34 },
  subtitle: { fontSize: 34, lineHeight: 40 },
  display: { fontSize: 50, lineHeight: 54 },
} as const;

/**
 * Corner radius scale, matched to iOS grouped-list chrome: `card` mirrors the
 * native inset-grouped card radius, `small` is the concentric radius for
 * nested elements, and `pill` covers badges and circular buttons.
 */
export const Radius = {
  none: 0,
  /** nested elements inside a card */
  small: 12,
  card: 26,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
export const TRANSPARENT = 'transparent' as const;

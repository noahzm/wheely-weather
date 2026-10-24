import '@/global.css';

import { Platform } from 'react-native';

// Body text is the system font (San Francisco on iOS), matching native
// chrome; bold comes from FontWeightBold, not a separate family.
const SANS_FONT = 'System';
const SANS_BOLD_FONT = 'System';

/**
 * The poster face: Oswald, a condensed gothic, loaded at launch from
 * @expo-google-fonts/oswald. Each weight is registered as its own family under
 * these names (the root layout's useFonts keys), which are also their CSS
 * families on web: Bold for titles and headlines, Regular for big numbers.
 */
export const POSTER_FONT = 'Oswald-Bold';
export const POSTER_LIGHT_FONT = 'Oswald-Regular';

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
  /** Outlines: cards, chips, pills, buttons. */
  border: string;
  /** Hairlines inside a card: row and tile separators, chart gridlines. */
  divider: string;
  /** The hard offset shadow under cards, badges and stickers. */
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
 *
 * Dark mode uses the iOS system dark surfaces (black page, #1C1C1E cards,
 * the opaque separator gray) so it matches native chrome, with gray outlines
 * and neutral gray hard shadows instead of white ones, which glared on black.
 *
 * The home screen widget keeps a copy in targets/widget/WidgetTheme.swift.
 */
export const WheelyTheme: { light: WheelyPalette; dark: WheelyPalette } = {
  light: {
    background: '#F4F4F6',
    paper: '#FFFFFF',
    ink: '#000000',
    mutedInk: '#3A3A3C',
    border: '#000000',
    divider: '#000000',
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
    paper: '#1C1C1E',
    ink: '#FFFFFF',
    mutedInk: '#AEAEB2',
    border: '#48484A',
    divider: '#38383A',
    shadow: '#3A3A3C',
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
 * Colors for the home screen's painted backdrop: an airbrushed sky lit from
 * the horizon, a glowing sun, soft clouds and hills. The scene is a forecast
 * for the day, so it stays in daylight in dark mode too (a night sky read as
 * nighttime), and whatever sits on it (the title, the location line, the
 * status bar) uses these dark inks in both modes.
 *
 * The home screen widget keeps a copy in targets/widget/WidgetScene.swift.
 */
export const SceneColors = {
  /** A fair day's sky, from high overhead down to the glow at the horizon. */
  skyTop: '#DE93E3',
  sky: '#F1BDF2',
  skyHorizon: '#FCE0EE',
  /** A rain day's overcast, the same way down. */
  rainSkyTop: '#7D7398',
  rainSky: '#9A8FB5',
  rainSkyHorizon: '#CBC3DA',
  /** The sun's hot center, body and rim, and the glow around it. */
  sunCore: '#FFFBE0',
  sun: '#FFE14D',
  sunEdge: '#FFB61C',
  sunGlowCore: '#FFF8D2',
  sunGlow: '#FFE68A',
  cloud: '#FFFFFF',
  /** Where a fair cloud's billows turn from the light. */
  cloudRim: '#F1E1F6',
  /** The lavender shade along a fair cloud's underside. */
  cloudShade: '#DDBFEA',
  rainCloud: '#E9E4F1',
  rainCloudRim: '#C8BFDA',
  rainCloudShade: '#8F84AD',
  rain: '#F4FBFF',
  /** Hills, lit on top and darkening downhill. */
  hillsTop: '#4CC983',
  hillsBottom: '#14773F',
  wetHillsTop: '#6BA486',
  wetHillsBottom: '#2C5B42',
  /** Fog: a milky lavender sky, pale bands drifting across it, hills faded by mist. */
  fogSkyTop: '#B5ABC6',
  fogSky: '#D1CADD',
  fogSkyHorizon: '#EDE9F2',
  fog: '#F7F4F9',
  fogHillsTop: '#97C2A7',
  fogHillsBottom: '#5F8C72',
  /** A thunderstorm's darker sky and clouds, and the glow of its lightning. */
  stormSkyTop: '#5E567C',
  stormSky: '#857BA2',
  stormSkyHorizon: '#B8AFCC',
  stormCloud: '#B7AFC9',
  stormCloudRim: '#8A80A4',
  stormCloudShade: '#4A4266',
  lightningGlow: '#F2EEFF',
  /** Snow and sleet: a cold pale sky, bright clouds, falling flakes and snowy hills. */
  snowSkyTop: '#949EC6',
  snowSky: '#B3BBDB',
  snowSkyHorizon: '#DCE1F0',
  snowCloud: '#F8F9FD',
  snowCloudRim: '#D6DBEB',
  snowCloudShade: '#A2AAC8',
  snow: '#FFFFFF',
  snowHillsTop: '#F4F6FB',
  snowHillsBottom: '#B8C2DA',
  /** Text on the sky: the light palette's inks, whatever the color scheme. */
  ink: WheelyTheme.light.ink,
  mutedInk: WheelyTheme.light.mutedInk,
} as const;

/**
 * Keys of WheelyPalette that resolve to a single color string (excludes the
 * nested `condition` map). Use this as the prop type for components that accept
 * a palette color by name (e.g. ThemedText).
 */
export type ThemeColor = keyof Omit<WheelyPalette, 'condition'>;

/**
 * Typeface roles resolve by platform:
 * - web: CSS variables from `global.css` (font stacks with fallbacks)
 * - native: the system font ('System'), and Oswald for the poster roles
 *
 * Text is the system font; `poster` (Oswald Bold) sets page titles, the
 * verdict and section titles through `PosterText`, and `posterLight` (Oswald
 * Regular) the big numbers through `PosterLightText`.
 */
export const Fonts = Platform.select({
  web: {
    body: 'var(--font-body)',
    heading: 'var(--font-heading)',
    display: 'var(--font-display)',
    city: 'var(--font-city)',
    bold: 'var(--font-bold)',
    poster: 'var(--font-poster)',
    posterLight: 'var(--font-poster-light)',
  },
  default: {
    body: SANS_FONT,
    heading: SANS_FONT,
    display: SANS_FONT,
    city: SANS_BOLD_FONT,
    bold: SANS_BOLD_FONT,
    poster: POSTER_FONT,
    posterLight: POSTER_LIGHT_FONT,
  },
});

/**
 * The two emphasis weights; everything else is regular ('400'). The system
 * font picks its face from the weight alone, so every Fonts.bold and
 * Fonts.city use must set one.
 *
 * Bold is for what a screen is about: page titles, section titles, the
 * verdict headline. Semibold is for emphasis inside a section: day names,
 * temperatures, values, rating chips, readout leads, small-caps labels.
 * Bolding both tiers flattened the hierarchy.
 */
export const FontWeightBold = '700' as const;
export const FontWeightSemibold = '600' as const;

/**
 * Poster type, after a risograph print: Oswald Bold in capitals. Each Oswald
 * weight is its own family, so fontWeight stays regular (a bold weight would
 * make iOS fake one on top). Pair it with a Type size: heading, headline,
 * subtitle or dayTitle.
 */
export const PosterText = {
  fontFamily: Fonts.poster,
  fontWeight: '400',
  textTransform: 'uppercase',
} as const;

/** The lighter poster cut, Oswald Regular, for big numbers (Type.stat). */
export const PosterLightText = {
  ...PosterText,
  fontFamily: Fonts.posterLight,
} as const;

/**
 * Field names, rating words and hour ticks: small bold capitals, tracked out
 * so they read as labels beside the poster type. Pair with Type.micro.
 */
export const LabelText = {
  fontFamily: Fonts.bold,
  fontWeight: FontWeightBold,
  textTransform: 'uppercase',
  letterSpacing: 1,
} as const;

/**
 * Lines numbers up in columns (week temperatures, Right now values) and keeps
 * a readout from shifting width as its digits change while the chart scrubs.
 */
export const TabularNumbers = { fontVariant: ['tabular-nums'] } as const;

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
 * Typography scale. Text sizes follow iOS's own text styles so the home screen
 * sits flush with the native Settings and Search screens; the poster sizes
 * (Oswald, see PosterText) run larger because the face is condensed. Every
 * on-screen fontSize/lineHeight pairs one of these — do not hardcode sizes in
 * component styles. Sizes rank by role: the verdict headline outranks section
 * titles, which outrank the Right now values beneath them.
 */
export const Type = {
  /** stickers, hour ticks, compact chips, small-caps labels, list footers (iOS footnote) */
  micro: { fontSize: 13, lineHeight: 16 },
  /** secondary text: labels, notes, readouts, buttons (iOS subheadline) */
  small: { fontSize: 15, lineHeight: 20 },
  /** body text, list rows, week rating chips (iOS body) */
  body: { fontSize: 17, lineHeight: 22 },
  /** poster: the week's day names */
  dayTitle: { fontSize: 22, lineHeight: 26 },
  /** poster: section titles */
  heading: { fontSize: 28, lineHeight: 32 },
  // The poster face's capitals need at least ~1.14× line height: iOS clips
  // their tops in a tighter line.
  /** poster: big numerics, the Right now values */
  stat: { fontSize: 34, lineHeight: 40 },
  /** poster: the verdict headline */
  headline: { fontSize: 44, lineHeight: 50 },
  /** poster: page titles (web; native sets the same size on its large title) */
  subtitle: { fontSize: 44, lineHeight: 50 },
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

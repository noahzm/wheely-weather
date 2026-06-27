import { useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type TextStyle,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import {
  Bike,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Footprints,
  Glasses,
  Hand,
  Layers,
  PersonStanding,
  Shirt,
  Snowflake,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { Condition } from '@/types/weather';
import { selectionFeedback } from '@/utils/haptics';

/** A `Pressable` that fires a selection haptic before delegating to `onPress`. */
export function HapticPressable({ onPress, ...props }: Readonly<PressableProps>) {
  return (
    <Pressable
      onPress={(event) => {
        selectionFeedback();
        onPress?.(event);
      }}
      {...props}
    />
  );
}

// ─── Elliptical burst badge path ─────────────────────────────────────────────
// Radial starburst on an ellipse — spikes alternate between an outer ellipse
// (tips) and an inner ellipse (valleys). Per-spike angle offsets give an
// organic, hand-drawn feel. viewBox is 200×80 (2.5:1, matches chip proportions).

interface BurstSpec {
  cx: number;
  cy: number;
  xOut: number; // outer ellipse radii (spike tips)
  yOut: number;
  xIn: number; // inner ellipse radii (spike valleys)
  yIn: number;
  n: number;
  offsets: readonly number[]; // per-spike angle nudge in radians
}

function makeEllipticalBurst({ cx, cy, xOut, yOut, xIn, yIn, n, offsets }: BurstSpec): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const base = (i * Math.PI) / n - Math.PI / 2;
    const isOut = i % 2 === 0;
    const off = isOut ? (offsets[Math.floor(i / 2) % offsets.length] ?? 0) : 0;
    const a = base + off;
    const rx = isOut ? xOut : xIn;
    const ry = isOut ? yOut : yIn;
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

// Slight irregular angle offsets per spike for organic feel
const BURST_OFFSETS = [
  0.04, -0.07, 0.09, -0.04, 0.06, -0.08, 0.03, -0.06, 0.08, -0.03, 0.07, -0.05, 0.04,
] as const;
// 13 spikes on a 200×80 viewBox. Outer ellipse nearly fills box; inner at ~50%
export const BURST_PATH = makeEllipticalBurst({
  cx: 100,
  cy: 40,
  xOut: 96,
  yOut: 37,
  xIn: 62,
  yIn: 23,
  n: 13,
  offsets: BURST_OFFSETS,
});

// Label burst: same 13-spike profile as condition chips, on a taller viewBox so
// the badge reads less like a flat oval while keeping the hand-drawn spikes.
const LABEL_BURST_PATH = makeEllipticalBurst({
  cx: 100,
  cy: 28,
  xOut: 94,
  yOut: 28,
  xIn: 61,
  yIn: 17,
  n: 13,
  offsets: BURST_OFFSETS,
});
export const BURST_VIEWBOX = '-4 -4 208 88';
const LABEL_BURST_VIEWBOX = '-4 -4 208 64';

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Cross-platform neobrutalist drop shadow. */
export function brutalShadow(color: string, width: number, height = width) {
  return Platform.OS === 'web'
    ? ({ boxShadow: `${width}px ${height}px 0 ${color}` } as const)
    : {
        shadowColor: color,
        shadowOffset: { width, height },
        shadowOpacity: 1,
        shadowRadius: 0,
      };
}

export const ButtonRadius = 12;

/** Shared rounded button styles (not used for burst condition badges). */
export function makeButtonStyles(c: WheelyPalette) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      borderRadius: ButtonRadius,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      minHeight: 40,
    },
    primary: {
      backgroundColor: c.primary,
    },
    surface: {
      backgroundColor: c.paper,
    },
    label: {
      color: c.ink,
      fontFamily: Fonts.mono,
      fontWeight: '400',
      fontSize: 12,
      textTransform: 'uppercase',
    },
    pressed: {
      opacity: 0.85,
    },
  });
}

/** Maps an Open-Meteo WMO weather code to a Lucide icon. */
export function weatherIconFor(code: number | null | undefined): LucideIcon {
  if (code == null) return Cloud;
  if (code <= 1) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 65) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

/** Maps an Open-Meteo WMO weather code to an SF Symbol name (iOS). */
export function weatherSfSymbol(code: number | null | undefined): string {
  if (code == null) return 'cloud.fill';
  if (code <= 1) return 'sun.max.fill';
  if (code <= 3) return 'cloud.sun.fill';
  if (code <= 48) return 'cloud.fog.fill';
  if (code <= 65) return 'cloud.rain.fill';
  if (code <= 77) return 'cloud.snow.fill';
  if (code <= 82) return 'cloud.rain.fill';
  if (code <= 86) return 'cloud.snow.fill';
  if (code <= 99) return 'cloud.bolt.fill';
  return 'cloud.fill';
}

/** Gear tip icon lookup keyed by gear item name from domain. */
export const GEAR_ICONS: Record<string, LucideIcon> = {
  Shorts: Bike,
  Pants: PersonStanding,
  Jacket: Layers,
  Shirt,
  Layers,
  Hand,
  Footprints,
  Snowflake,
  CloudRain,
  Umbrella,
  Wind,
  Sun,
  Glasses,
  Thermometer,
};

/** SF Symbol names for gear items, parallel to GEAR_ICONS (iOS). */
export const GEAR_SF_SYMBOLS: Record<string, string> = {
  Shorts: 'bicycle',
  Pants: 'figure.stand',
  Jacket: 'square.3.layers.3d.fill',
  Shirt: 'tshirt.fill',
  Layers: 'square.3.layers.3d.fill',
  Hand: 'hand.raised.fill',
  Footprints: 'figure.walk',
  Snowflake: 'snowflake',
  CloudRain: 'cloud.rain.fill',
  Umbrella: 'umbrella.fill',
  Wind: 'wind',
  Sun: 'sun.max.fill',
  Glasses: 'eyeglasses',
  Thermometer: 'thermometer.medium',
};

/** Narrows an unknown value to a valid `Condition`, defaulting to `'fair'`. */
export function asCondition(value: unknown): Condition {
  return value === 'good' ||
    value === 'fair' ||
    value === 'marginal' ||
    value === 'poor' ||
    value === 'bad'
    ? value
    : 'fair';
}

/** Formats a Date or ISO string as a locale time string. */
export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ─── SectionTitle ────────────────────────────────────────────────────────────

// Web: paint-order + -webkit-text-stroke (stroke behind fill, proper glyph corners).
// Native: SVG text — stroke layer behind fill layer (same visual model as paint-order).

const SECTION_HEADING_STROKE_WIDTH = 6;
const SECTION_HEADING_FONT_SIZE = 24;
const SECTION_HEADING_LINE_HEIGHT = 28;
const SECTION_HEADING_FILL = '#ffffff';

const strokedSectionHeadingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapper: {
    alignSelf: 'flex-start',
    minHeight: SECTION_HEADING_LINE_HEIGHT,
    position: 'relative',
  },
  text: {
    alignSelf: 'flex-start',
    color: SECTION_HEADING_FILL,
    fontFamily: Fonts.display,
    fontSize: SECTION_HEADING_FONT_SIZE,
    lineHeight: SECTION_HEADING_LINE_HEIGHT,
    fontWeight: FontWeightBold,
    textTransform: 'uppercase',
  },
  measureText: {
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  // Web-only CSS properties (not in RN's style types) for the painted text stroke.
  webStroke:
    Platform.OS === 'web'
      ? ({
          WebkitTextStroke: `${SECTION_HEADING_STROKE_WIDTH}px #000000`,
          WebkitTextFillColor: '#ffffff',
          color: '#ffffff',
          paintOrder: 'stroke fill',
        } as unknown as TextStyle)
      : {},
});

interface NativeHeadingLayout {
  width: number;
  height: number;
  baselineY: number;
}

function NativeStrokedSectionHeading({ children }: Readonly<{ children: string }>) {
  const label = children.toUpperCase();
  const [layout, setLayout] = useState<NativeHeadingLayout | null>(null);
  const inset = SECTION_HEADING_STROKE_WIDTH;

  return (
    <View
      style={strokedSectionHeadingStyles.wrapper}
      accessible
      accessibilityRole="header"
      accessibilityLabel={children}
    >
      <ThemedText
        style={[strokedSectionHeadingStyles.text, strokedSectionHeadingStyles.measureText]}
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(event) => {
          const lines = event.nativeEvent.lines;
          if (lines.length === 0) return;

          const width = Math.ceil(Math.max(...lines.map((line) => line.width)));
          const height = Math.ceil(lines.reduce((sum, line) => sum + line.height, 0));
          const firstLine = lines[0];
          if (!firstLine) return;
          const baselineY = Math.ceil(firstLine.y + firstLine.ascender);

          setLayout({ width, height, baselineY });
        }}
      >
        {children}
      </ThemedText>
      {layout ? (
        <Svg width={layout.width + inset * 2} height={layout.height + inset} accessible={false}>
          {/* react-native-svg tags x/y as deprecated transform shorthands, but on
              <Text> they are the standard (and only) way to position text — the
              suggested translateX/Y are themselves deprecated. */}
          {/* eslint-disable @typescript-eslint/no-deprecated */}
          <SvgText
            x={inset}
            y={layout.baselineY}
            fontSize={SECTION_HEADING_FONT_SIZE}
            fontFamily={Fonts.display}
            fontWeight={FontWeightBold}
            stroke="#000000"
            strokeWidth={SECTION_HEADING_STROKE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          >
            {label}
          </SvgText>
          <SvgText
            x={inset}
            y={layout.baselineY}
            fontSize={SECTION_HEADING_FONT_SIZE}
            fontFamily={Fonts.display}
            fontWeight={FontWeightBold}
            fill="#ffffff"
          >
            {label}
          </SvgText>
          {/* eslint-enable @typescript-eslint/no-deprecated */}
        </Svg>
      ) : null}
    </View>
  );
}

export function StrokedSectionHeading({ children }: Readonly<{ children: string }>) {
  if (Platform.OS === 'web') {
    return (
      <ThemedText style={[strokedSectionHeadingStyles.text, strokedSectionHeadingStyles.webStroke]}>
        {children}
      </ThemedText>
    );
  }

  return <NativeStrokedSectionHeading>{children}</NativeStrokedSectionHeading>;
}

export function SectionTitle({ title }: Readonly<{ title: string }>) {
  return (
    <View style={strokedSectionHeadingStyles.row}>
      <StrokedSectionHeading>{title}</StrokedSectionHeading>
    </View>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

function makeChipStyles(c: WheelyPalette) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    chipText: {
      fontFamily: Fonts.mono,
      fontWeight: '400',
      textTransform: 'uppercase',
    },
  });
}

const chipSizes = {
  default: {
    chip: {
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    text: {
      fontSize: 11,
    },
    icon: 12,
  },
  large: {
    chip: {
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    text: {
      fontSize: 13,
    },
    icon: 14,
  },
} as const;

export const BURST_CHIP_SIZES = {
  default: {
    container: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 4,
    },
    text: {
      fontSize: 11,
    },
    icon: 12,
  },
  large: {
    container: {
      paddingHorizontal: 20,
      paddingVertical: 11,
      gap: 5,
    },
    text: {
      fontSize: 14,
    },
    icon: 15,
  },
  label: {
    container: {
      paddingHorizontal: 26,
      paddingTop: 16,
      paddingBottom: 14,
      gap: 5,
    },
    text: {
      fontSize: 16,
      lineHeight: 16,
    },
    icon: 15,
  },
} as const;

export const burstChipStyles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: Fonts.mono,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
});

function useChipStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeChipStyles(c), [c]);
  return { c, styles };
}

function BurstConditionChip({
  children,
  backgroundColor,
  color,
  icon: Icon,
  large = false,
  variant = 'condition',
  iconAfter = false,
  textStyle,
  style,
}: Readonly<{
  children: ReactNode;
  backgroundColor: string;
  color: string;
  icon?: LucideIcon;
  large?: boolean;
  variant?: 'condition' | 'label';
  iconAfter?: boolean;
  textStyle?: object;
  style?: object;
}>) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const sizeKey = large ? 'large' : 'default';
  const size = variant === 'label' ? BURST_CHIP_SIZES.label : BURST_CHIP_SIZES[sizeKey];
  const burstPath = variant === 'label' ? LABEL_BURST_PATH : BURST_PATH;
  const viewBox = variant === 'label' ? LABEL_BURST_VIEWBOX : BURST_VIEWBOX;

  return (
    <View
      style={[burstChipStyles.container, size.container, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ width, height });
        }
      }}
    >
      {layout.width > 0 && layout.height > 0 ? (
        <Svg
          viewBox={viewBox}
          preserveAspectRatio="none"
          style={[StyleSheet.absoluteFill, variant === 'label' ? { top: -2 } : null]}
          width={layout.width}
          height={variant === 'label' ? layout.height + 2 : layout.height}
        >
          <Path d={burstPath} fill={backgroundColor} />
        </Svg>
      ) : null}
      {Icon && !iconAfter ? (
        <Icon size={size.icon} color={color} strokeWidth={2.5} fill={color} />
      ) : null}
      <ThemedText style={[burstChipStyles.text, size.text, { color }, textStyle]}>
        {children}
      </ThemedText>
      {Icon && iconAfter ? (
        <Icon size={size.icon} color={color} strokeWidth={2.5} fill={color} />
      ) : null}
    </View>
  );
}

export const BurstChip = BurstConditionChip;

export function Chip({
  children,
  condition,
  primary = false,
  ink = false,
  large = false,
  icon: Icon,
  style,
}: Readonly<{
  children: ReactNode;
  condition?: Condition;
  primary?: boolean;
  ink?: boolean;
  large?: boolean;
  icon?: LucideIcon;
  style?: object;
}>) {
  const { c, styles } = useChipStyles();
  let backgroundColor: string;
  if (condition) backgroundColor = c.condition[condition].bg;
  else if (primary) backgroundColor = c.primary;
  else if (ink) backgroundColor = c.ink;
  else backgroundColor = c.paper;
  let color: string;
  if (condition) color = c.condition[condition].ink;
  else if (ink) color = c.paper;
  else color = c.ink;

  if (condition) {
    return (
      <BurstConditionChip
        backgroundColor={backgroundColor}
        color={color}
        icon={Icon}
        large={large}
        style={style}
      >
        {children}
      </BurstConditionChip>
    );
  }

  return (
    <View
      style={[styles.chip, chipSizes[large ? 'large' : 'default'].chip, { backgroundColor }, style]}
    >
      {Icon && (
        <Icon
          size={chipSizes[large ? 'large' : 'default'].icon}
          color={color}
          strokeWidth={2.5}
          fill={color}
        />
      )}
      <ThemedText style={[styles.chipText, chipSizes[large ? 'large' : 'default'].text, { color }]}>
        {children}
      </ThemedText>
    </View>
  );
}

// ─── BrutalCard ──────────────────────────────────────────────────────────────

function makeCardStyles(c: WheelyPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.paper,
      borderWidth: 2,
      borderColor: c.ink,
      borderRadius: ButtonRadius,
      padding: Spacing.three,
      ...brutalShadow(c.ink, 6),
      gap: Spacing.three,
    },
    cardSmall: {
      backgroundColor: c.paper,
      borderWidth: 2,
      borderColor: c.ink,
      borderRadius: ButtonRadius,
      padding: Spacing.three,
      ...brutalShadow(c.ink, 3),
    },
  });
}

function useCardStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeCardStyles(c), [c]);
  return { styles };
}

export function BrutalCard({
  children,
  small = false,
  style,
}: Readonly<{
  children: ReactNode;
  small?: boolean;
  style?: object;
}>) {
  const { styles } = useCardStyles();
  return <View style={[small ? styles.cardSmall : styles.card, style]}>{children}</View>;
}

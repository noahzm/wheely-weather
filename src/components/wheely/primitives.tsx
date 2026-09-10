import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import {
  FontWeightBlack,
  Fonts,
  Radius,
  Spacing,
  Type,
  WheelyTheme,
  type WheelyPalette,
} from '@/constants/theme';
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

export const ButtonRadius = Radius.card;

export const CardBorderWidth = 2;

/**
 * Concentric radius for edge-to-edge children that clip themselves inside a
 * BrutalCard: the card's radius minus its border width, so clipped content
 * follows the border's inner curve instead of poking past it at the corners.
 */
export const CardInnerRadius = Radius.card - CardBorderWidth;

/** Shared pressed-state feedback opacity for every Pressable in the app. */
export const PressedOpacity = 0.85;

export function PlatformIcon({
  icon: Icon,
  sf,
  size,
  color,
  strokeWidth = 2,
  style,
}: Readonly<{
  icon: LucideIcon;
  sf?: SFSymbol;
  size: number;
  color: string;
  strokeWidth?: number;
  style?: object;
}>) {
  if (Platform.OS === 'ios' && sf) {
    return <SymbolView name={sf} size={size} tintColor={color} style={style} />;
  }
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}

export { KitGearIcon, GameGearIcon, type KitGearIconProps } from './kit-gear-icon';

/** Shared rounded button styles (not used for burst condition badges). */
export function makeButtonStyles(c: WheelyPalette) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      borderRadius: ButtonRadius,
      borderWidth: 2,
      borderColor: c.border,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      minHeight: 40,
    },
    primary: {
      backgroundColor: c.primary,
    },
    primaryLabel: {
      color: c.primaryInk,
    },
    surface: {
      backgroundColor: c.paper,
    },
    label: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.caption,
    },
    pressed: {
      opacity: PressedOpacity,
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

const sectionHeadingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  text: {
    // Full-width box with room to wrap: iOS measures the text box with the
    // unscaled font, so a self-sized box clips mid-word at large Dynamic Type.
    alignSelf: 'stretch',
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: Fonts.bold,
    ...Type.heading,
    fontWeight: FontWeightBlack,
  },
});

export function SectionHeading({ children }: Readonly<{ children: string }>) {
  return (
    <ThemedText
      style={sectionHeadingStyles.text}
      accessibilityRole="header"
      accessibilityLabel={children}
    >
      {children}
    </ThemedText>
  );
}

export function SectionTitle({
  title,
  rightAccessory,
}: Readonly<{ title: string; rightAccessory?: ReactNode }>) {
  return (
    <View style={sectionHeadingStyles.row}>
      <SectionHeading>{title}</SectionHeading>
      {rightAccessory}
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
      borderRadius: Radius.none,
      alignSelf: 'flex-start',
    },
    chipText: {
      fontFamily: Fonts.body,
      fontWeight: '400',
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
      fontSize: Type.micro.fontSize,
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
      fontSize: Type.small.fontSize,
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
      fontSize: Type.micro.fontSize,
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
      fontSize: Type.small.fontSize,
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
      // Tight lineHeight is part of the burst badge geometry — keep it equal
      // to the fontSize rather than the scale's default.
      fontSize: Type.body.fontSize,
      lineHeight: Type.body.fontSize,
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
    fontFamily: Fonts.body,
    fontWeight: '400',
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
  burstScaleY = 1,
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
  burstScaleY?: number;
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
          style={[
            StyleSheet.absoluteFill,
            variant === 'label' ? { top: -2 } : null,
            burstScaleY === 1 ? null : { transform: [{ scaleY: burstScaleY }] },
          ]}
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

export function Chip({
  children,
  condition,
  primary = false,
  accent = false,
  ink = false,
  large = false,
  burst = true,
  icon: Icon,
  style,
}: Readonly<{
  children: ReactNode;
  condition?: Condition;
  primary?: boolean;
  accent?: boolean;
  ink?: boolean;
  large?: boolean;
  // Condition chips render as a spiky burst badge by default; pass burst={false}
  // for a calm flat pill (used where the badge repeats, e.g. the daily list).
  burst?: boolean;
  icon?: LucideIcon;
  style?: object;
}>) {
  const { c, styles } = useChipStyles();
  let backgroundColor: string;
  if (condition) backgroundColor = c.condition[condition].bg;
  else if (primary) backgroundColor = c.primary;
  else if (accent) backgroundColor = c.accent;
  else if (ink) backgroundColor = c.ink;
  else backgroundColor = c.paper;
  let color: string;
  if (condition) color = c.condition[condition].ink;
  else if (primary) color = c.primaryInk;
  else if (accent) color = c.accentInk;
  else if (ink) color = c.paper;
  else color = c.ink;

  if (condition && burst) {
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

export function ConditionPill({
  condition,
  children,
}: Readonly<{ condition: Condition; children: string }>) {
  const c = useWheelyColors();
  const colors = c.condition[condition];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: Radius.none,
        backgroundColor: colors.bg,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <ThemedText
        type="micro"
        style={{
          color: colors.ink,
        }}
      >
        {children}
      </ThemedText>
    </View>
  );
}

// ─── BrutalCard ──────────────────────────────────────────────────────────────

function makeCardStyles(c: WheelyPalette) {
  return StyleSheet.create({
    featured: {
      backgroundColor: c.paper,
      borderWidth: CardBorderWidth,
      borderColor: c.shadow,
      borderRadius: ButtonRadius,
      padding: Spacing.three,
      ...brutalShadow(c.shadow, 6),
      gap: Spacing.three,
    },
    standard: {
      backgroundColor: c.paper,
      borderWidth: CardBorderWidth,
      borderColor: c.shadow,
      borderRadius: ButtonRadius,
      padding: Spacing.three,
      ...brutalShadow(c.shadow, 3),
      gap: Spacing.three,
    },
    subtle: {
      backgroundColor: c.paper,
      borderWidth: CardBorderWidth,
      borderColor: c.border,
      borderRadius: ButtonRadius,
      padding: Spacing.three,
    },
  });
}

function useCardStyles() {
  // Cards use the active scheme's paper surface (native grouped-list style):
  // white cards on the gray page in light mode, elevated gray on black in dark.
  const scheme = useColorSchemeName();
  const styles = useMemo(() => makeCardStyles(WheelyTheme[scheme]), [scheme]);
  return { styles };
}

export function BrutalCard({
  children,
  small = false,
  variant,
  style,
}: Readonly<{
  children: ReactNode;
  small?: boolean;
  variant?: 'featured' | 'standard' | 'subtle';
  style?: object;
}>) {
  const { styles } = useCardStyles();
  const resolvedVariant = variant ?? (small ? 'subtle' : 'standard');
  return <View style={[styles[resolvedVariant], style]}>{children}</View>;
}

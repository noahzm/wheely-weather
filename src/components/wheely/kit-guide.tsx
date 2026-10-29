// The home screen's kit card: the ride's hours and temperatures, then what to
// wear head to toe, why each add-on is there, and when layers come off, with
// what to pack and do before setting out at the bottom. The plan comes from
// getKitPlan; this file only lays it out.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import {
  KIT_ZONE_LABELS,
  RIDE_LENGTH_MESSAGES,
  formatKitReason,
  formatKitTiming,
  getKitPlan,
  type KitPlanHour,
  type KitPlanItem,
  type RideHours,
} from '@/domain';
import type { Thresholds } from '@/domain/constants';
import type { KitReason } from '@/domain/kit-plan';
import { useResolvedTempUnit, useRideDuration } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import {
  Fonts,
  FontWeightSemibold,
  LabelText,
  PosterLightText,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import { RIDE_DURATION_HOURS, type GearMode, type RideDuration } from '@/types/settings';
import type { Weather } from '@/types/weather';
import { withAlpha } from '@/utils/colors';
import { formatTemperature, type TempUnit } from '@/utils/temperature';
import { formatHourSpan, fullHourLabel } from '@/utils/timeFormat';
import {
  ChevronRight,
  Droplet,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
  type IconComponent,
} from './icons';
import {
  BrutalCard,
  CardInnerRadius,
  HapticPressable,
  KitGearIcon,
  PlatformIcon,
  StickerTag,
} from './primitives';

// The timeline's time and temperature labels are wider than an hour's column
// on long rides; only spaced-out hours are labeled, so they may overhang.
const TIMELINE_LABEL_WIDTH = 56;
const DOT_BOX = 14;
// Center of the dots: the time label's line, the gap, then half a dot box.
const TIMELINE_LINE_TOP = Type.micro.lineHeight + Spacing.one + 2 + DOT_BOX / 2 - 1;
const ICON_SIZE = 28;
// Wide enough for "Before you go" to wrap as two words.
const ZONE_LABEL_WIDTH = 62;
const STICKER_TILTS = [-1.5, 1, -1, 1.5];

const REASON_GLYPHS: Record<KitReason['kind'], { icon: IconComponent; sf: SFSymbol }> = {
  cold: { icon: Thermometer, sf: 'thermometer.medium' },
  swing: { icon: Thermometer, sf: 'thermometer.medium' },
  rain: { icon: Umbrella, sf: 'umbrella.fill' },
  wetRoads: { icon: Droplet, sf: 'drop.fill' },
  wind: { icon: Wind, sf: 'wind' },
  uv: { icon: Sun, sf: 'sun.max.fill' },
  muggy: { icon: Droplet, sf: 'drop.fill' },
};

function makeHeaderStyles(c: WheelyPalette) {
  return StyleSheet.create({
    cardPanel: {
      padding: 0,
      gap: 0,
    },
    cardClip: {
      borderRadius: CardInnerRadius,
      overflow: 'hidden',
    },
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two + Spacing.one,
      paddingBottom: Spacing.three - Spacing.half,
      gap: Spacing.two + Spacing.half,
      borderBottomWidth: 1,
      borderColor: c.divider,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    spanText: {
      flexShrink: 1,
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.small,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.half,
      marginLeft: 'auto',
      paddingLeft: Spacing.two + Spacing.half,
      paddingRight: Spacing.one + Spacing.half,
      paddingVertical: Spacing.half,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.pill,
    },
    chipPressed: {
      backgroundColor: withAlpha(c.ink, 0.08),
    },
    chipText: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
    },
    timeline: {
      flexDirection: 'row',
    },
    timelineLine: {
      position: 'absolute',
      top: TIMELINE_LINE_TOP,
      height: 2,
    },
    timelineColumn: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: Spacing.one + 2,
    },
    timelineTime: {
      width: TIMELINE_LABEL_WIDTH,
      textAlign: 'center',
      color: c.mutedInk,
      ...LabelText,
      ...Type.micro,
    },
    dotBox: {
      width: DOT_BOX,
      height: DOT_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      borderRadius: Radius.pill,
    },
    dotPlain: {
      width: 6,
      height: 6,
      backgroundColor: c.ink,
    },
    dotLabeled: {
      width: 12,
      height: 12,
      borderWidth: 2,
      borderColor: c.ink,
      backgroundColor: c.paper,
    },
    dotChange: {
      width: DOT_BOX,
      height: DOT_BOX,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.accent,
    },
    timelineTemp: {
      width: TIMELINE_LABEL_WIDTH,
      minHeight: 24,
      textAlign: 'center',
      color: c.ink,
      ...PosterLightText,
      fontSize: 20,
      lineHeight: 24,
    },
  });
}

function makeRowStyles(c: WheelyPalette) {
  return StyleSheet.create({
    zoneRow: {
      flexDirection: 'row',
      gap: Spacing.two + Spacing.half,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + Spacing.half,
    },
    zoneRowSoftDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(c.ink, 0.2),
    },
    zoneRowDivider: {
      borderTopWidth: 1,
      borderColor: c.divider,
    },
    shelfRow: {
      backgroundColor: c.background,
    },
    zoneLabel: {
      width: ZONE_LABEL_WIDTH,
      paddingTop: Spacing.one + 2,
      color: c.mutedInk,
      ...LabelText,
      letterSpacing: 0.6,
      ...Type.micro,
    },
    zoneItems: {
      flex: 1,
      minWidth: 0,
      gap: Spacing.two + Spacing.half,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.two + Spacing.half,
    },
    itemText: {
      flex: 1,
      minWidth: 0,
      gap: Spacing.one,
      paddingTop: Spacing.half + 1,
    },
    itemLabel: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.body,
    },
    itemMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: Spacing.two,
      rowGap: Spacing.one + 2,
    },
    reason: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    reasonText: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
    },
    timingSticker: {
      backgroundColor: c.accent,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.half,
    },
    timingText: {
      color: c.accentInk,
      fontWeight: '400',
      ...Type.micro,
    },
  });
}

function makeStyles(c: WheelyPalette) {
  return { ...makeHeaderStyles(c), ...makeRowStyles(c) };
}

type Styles = ReturnType<typeof makeStyles>;

function rideLengthChip(rideDuration: RideDuration): string {
  return RIDE_LENGTH_MESSAGES.CHIP(
    rideDuration === 'allDay' ? 'allDay' : RIDE_DURATION_HOURS[rideDuration],
  );
}

/** "9 AM–12 PM", plus the temperature when a one-hour ride has no timeline. */
function spanLabel(hours: KitPlanHour[], unit: TempUnit): string | null {
  const first = hours[0];
  const last = hours.at(-1);
  if (!first || !last) return null;
  const span = formatHourSpan(first.hour, last.hour + 1);
  return hours.length === 1 ? `${span} · ${formatTemperature(first.temperature, unit)}` : span;
}

function KitTimeline({
  hours,
  unit,
  c,
  styles,
}: Readonly<{ hours: KitPlanHour[]; unit: TempUnit; c: WheelyPalette; styles: Styles }>) {
  // From the first column's center to the last one's.
  const inset = `${50 / hours.length}%` as const;
  const description = hours
    .map((hour) => `${fullHourLabel(hour.hour)} ${formatTemperature(hour.temperature, unit)}`)
    .join(', ');
  return (
    <View
      style={styles.timeline}
      accessible
      accessibilityLabel={`Ride temperatures: ${description}`}
    >
      <View style={[styles.timelineLine, { left: inset, right: inset }]} pointerEvents="none">
        <Svg width="100%" height={2}>
          <Line
            x1="0"
            y1="1"
            x2="100%"
            y2="1"
            stroke={c.ink}
            strokeWidth={2}
            strokeDasharray="0.1 5"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      {hours.map((hour, index) => {
        let dot = styles.dotPlain;
        if (hour.change) dot = styles.dotChange;
        else if (hour.labeled) dot = styles.dotLabeled;
        return (
          <View key={`${index}-${hour.hour}`} style={styles.timelineColumn}>
            <ThemedText style={styles.timelineTime} numberOfLines={1}>
              {hour.labeled ? fullHourLabel(hour.hour) : ''}
            </ThemedText>
            <View style={styles.dotBox}>
              <View style={[styles.dot, dot]} />
            </View>
            <ThemedText style={styles.timelineTemp} numberOfLines={1}>
              {hour.labeled ? formatTemperature(hour.temperature, unit) : ''}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function KitHeader({
  hours,
  rideDuration,
  unit,
  c,
  styles,
}: Readonly<{
  hours: KitPlanHour[];
  rideDuration: RideDuration;
  unit: TempUnit;
  c: WheelyPalette;
  styles: Styles;
}>) {
  const router = useRouter();
  const span = spanLabel(hours, unit);
  const chip = rideLengthChip(rideDuration);
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {span && <ThemedText style={styles.spanText}>{span}</ThemedText>}
        <HapticPressable
          onPress={() => {
            router.navigate('/settings');
          }}
          accessibilityRole="button"
          accessibilityLabel={`${chip}. Change ride length in Settings`}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <ThemedText style={styles.chipText}>{chip}</ThemedText>
          <PlatformIcon
            icon={ChevronRight}
            sf="chevron.right"
            size={11}
            color={c.ink}
            strokeWidth={2.5}
          />
        </HapticPressable>
      </View>
      {hours.length > 1 && <KitTimeline hours={hours} unit={unit} c={c} styles={styles} />}
    </View>
  );
}

function KitItemRow({
  item,
  unit,
  tilt,
  delay,
  animate,
  c,
  styles,
}: Readonly<{
  item: KitPlanItem;
  unit: TempUnit;
  tilt: number;
  delay: number;
  animate: boolean;
  c: WheelyPalette;
  styles: Styles;
}>) {
  const reason = item.reason ? formatKitReason(item.reason, unit) : null;
  const glyph = item.reason ? REASON_GLYPHS[item.reason.kind] : null;
  const timing = item.timing ? formatKitTiming(item.timing) : null;
  const description = [item.label, reason, timing].filter(Boolean).join('. ');
  return (
    <Animated.View
      entering={animate ? FadeInDown.delay(delay).duration(200) : undefined}
      style={styles.itemRow}
      accessible
      accessibilityLabel={description}
    >
      <KitGearIcon iconKey={item.icon} size={ICON_SIZE} color={c.ink} />
      <View style={styles.itemText}>
        <ThemedText style={styles.itemLabel}>{item.label}</ThemedText>
        {(reason ?? timing) && (
          <View style={styles.itemMeta}>
            {reason && glyph && (
              <View style={styles.reason}>
                <PlatformIcon icon={glyph.icon} sf={glyph.sf} size={12} color={c.mutedInk} />
                <ThemedText style={styles.reasonText}>{reason}</ThemedText>
              </View>
            )}
            {timing && (
              <StickerTag tilt={tilt} style={styles.timingSticker}>
                <ThemedText style={styles.timingText}>{timing}</ThemedText>
              </StickerTag>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

interface ZoneRowData {
  key: string;
  label: string;
  items: { item: KitPlanItem; tilt: number; delay: number }[];
  shelf: boolean;
}

/** The card's rows: body zones, then the shelves, each item with its sticker tilt and entry delay. */
function buildRows(plan: ReturnType<typeof getKitPlan>): ZoneRowData[] {
  const groups = [
    ...plan.zones.map((zone) => ({
      key: zone.zone,
      label: KIT_ZONE_LABELS[zone.zone],
      items: zone.items,
      shelf: false,
    })),
    { key: 'pack', label: KIT_ZONE_LABELS.pack, items: plan.pack, shelf: true },
    { key: 'prep', label: KIT_ZONE_LABELS.prep, items: plan.prep, shelf: true },
  ].filter((group) => group.items.length > 0);
  let stickers = 0;
  let delay = 0;
  const rows: ZoneRowData[] = [];
  for (const group of groups) {
    const items = [];
    for (const item of group.items) {
      delay += 30;
      items.push({ item, tilt: STICKER_TILTS[stickers % STICKER_TILTS.length] ?? -1, delay });
      if (item.timing) stickers += 1;
    }
    rows.push({ ...group, items });
  }
  return rows;
}

export function KitGuide({
  weather,
  rideHours = null,
  thresholds,
  mode,
  rideDuration,
}: Readonly<{
  weather: Weather;
  /** The verdict's window to dress for; without one, the next few hours. */
  rideHours?: RideHours | null;
  thresholds: Thresholds;
  mode: GearMode;
  /** The ride length `weather` was built for; falls back to the active setting. */
  rideDuration?: RideDuration;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const unit = useResolvedTempUnit();
  const [settingRideDuration] = useRideDuration();
  const activeRideDuration = rideDuration ?? settingRideDuration;
  // Stagger brings the whole section in on launch; item rows only fade in when
  // the rider flips Casual/Roadie after mount.
  const [initialMode] = useState(mode);
  const [animateModeSwitch, setAnimateModeSwitch] = useState(false);
  if (!animateModeSwitch && mode !== initialMode) {
    setAnimateModeSwitch(true);
  }
  const plan = getKitPlan(
    weather,
    mode,
    rideHours,
    thresholds,
    RIDE_DURATION_HOURS[activeRideDuration],
  );
  const rows = buildRows(plan);

  return (
    <BrutalCard style={styles.cardPanel}>
      <View style={styles.cardClip} accessibilityLiveRegion="polite">
        <KitHeader
          hours={plan.hours}
          rideDuration={activeRideDuration}
          unit={unit}
          c={c}
          styles={styles}
        />
        {rows.map((row, index) => {
          const previous = rows[index - 1];
          // A soft line between body zones, the card's divider where the shelves start.
          let divider = null;
          if (previous)
            divider =
              row.shelf && !previous.shelf ? styles.zoneRowDivider : styles.zoneRowSoftDivider;
          return (
            <View key={row.key} style={[styles.zoneRow, divider, row.shelf && styles.shelfRow]}>
              <ThemedText style={styles.zoneLabel}>{row.label}</ThemedText>
              <View style={styles.zoneItems}>
                {row.items.map(({ item, tilt, delay }) => (
                  <KitItemRow
                    // Remount on a rider-style switch so the new kit animates in.
                    key={`${mode}-${item.icon}-${item.label}`}
                    item={item}
                    unit={unit}
                    tilt={tilt}
                    delay={delay}
                    animate={animateModeSwitch}
                    c={c}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </BrutalCard>
  );
}

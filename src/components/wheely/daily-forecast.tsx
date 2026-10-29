import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ChevronRight, type IconComponent } from './icons';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY, getDayGearSuggestion } from '@/domain';
import { DAYLIGHT_MESSAGES } from '@/domain/copy';
import { dayLabel, getBestDayInfo, formatPercent } from '@/utils';
import {
  formatDayRowNote,
  getDayConditionReason,
  getDayRowNote,
  isGenericDayReason,
} from '@/utils/forecastHelpers';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import {
  Fonts,
  LabelText,
  PosterText,
  Spacing,
  Type,
  type WheelyPalette,
  FontWeightSemibold,
  TabularNumbers,
} from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import type { Thresholds } from '@/domain/constants';
import type { DailyWeather, GearTipItem } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import { DaylightAxis, DaylightStrip } from './daylight-strip';
import {
  BrutalCard,
  CardInnerRadius,
  HapticPressable,
  KitGearIcon,
  PlatformIcon,
  asCondition,
  weatherIconFor,
  weatherSfSymbol,
} from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    weekSection: { gap: Spacing.three },
    dailyList: { padding: 0, gap: 0, overflow: 'visible' },
    // Concentric radius so row press states follow the inside of the card border.
    dailyClip: { borderRadius: CardInnerRadius, overflow: 'hidden' },
    dayRowContainer: {
      position: 'relative',
      flexDirection: 'column',
      borderBottomWidth: 1,
      borderColor: c.divider,
    },
    // Tighter than a one-line row would want: most rows carry a note line too.
    dayRowHeader: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + Spacing.half,
      gap: Spacing.half,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    dayRowLast: { borderBottomWidth: 0 },
    // The week's best day wears the pink that marks "when to go" across the
    // app (the chart's ride window, the wait card), at the chart band's strength.
    dayRowBest: { backgroundColor: withAlpha(c.accent, 0.35) },
    dayRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    // Fits "Tomorrow"; the label shrinks a little on the narrowest phones.
    dayLabelCell: { width: 98 },
    // The note runs under the whole row, so it isn't squeezed into the label's column.
    dayNote: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.small,
    },
    dayNoteLead: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
    },
    dayLabel: {
      color: c.ink,
      ...PosterText,
      ...Type.dayTitle,
    },
    weatherGlyph: { width: 22, alignItems: 'center' },
    // Body size, not heading: the rating, not the temperature, leads the row.
    dayTemp: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.body,
      ...TabularNumbers,
      ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null),
    },
    dayLow: { color: c.mutedInk, fontWeight: '400', fontSize: Type.small.fontSize },
    // The ratings form a column at the right, beside the chevron. Pushed there by
    // its margin; a spacer view would cost the row another gap.
    dayRating: {
      marginLeft: 'auto',
      color: c.ink,
      ...LabelText,
      ...Type.micro,
    },
    dayRatingDone: { color: c.mutedInk },
    chevronWrap: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      color: c.mutedInk,
      ...Type.small,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function preventOrphans(text: string): string {
  const glued = text
    .replaceAll(' mph', '\u00A0mph')
    .replaceAll(' km/h', '\u00A0km/h')
    .replaceAll(' kph', '\u00A0kph')
    .replaceAll(' AM', '\u00A0AM')
    .replaceAll(' PM', '\u00A0PM');
  const lastSpaceIdx = glued.lastIndexOf(' ');
  if (lastSpaceIdx <= 0 || glued.indexOf(' ') === lastSpaceIdx) return glued;
  return `${glued.slice(0, lastSpaceIdx)}\u00A0${glued.slice(lastSpaceIdx + 1)}`;
}

function makeDetailStyles(c: WheelyPalette) {
  const rule = withAlpha(c.ink, 0.15);
  const smallCaps = {
    color: c.mutedInk,
    fontFamily: Fonts.bold,
    fontWeight: FontWeightSemibold,
    ...Type.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as const;
  return StyleSheet.create({
    // Same surface as the row, set off by a hairline rather than a sunken
    // panel, so the day reads as one piece.
    drawer: {
      marginHorizontal: Spacing.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: rule,
      paddingTop: Spacing.two + Spacing.one,
      paddingBottom: Spacing.three,
      gap: Spacing.three,
    },
    reason: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.small,
    },
    stats: { flexDirection: 'row' },
    stat: { flex: 1, gap: Spacing.half },
    statDivided: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: rule,
      paddingLeft: Spacing.three,
    },
    label: smallCaps,
    value: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.body,
      ...TabularNumbers,
    },
    detail: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
      ...TabularNumbers,
    },
    kit: { flexDirection: 'row', gap: Spacing.three },
    kitColumn: { flex: 1, gap: Spacing.one + Spacing.half },
    kitItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    kitIcon: { width: 22, alignItems: 'center' },
    kitLabel: {
      flex: 1,
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.small,
    },
  });
}

interface DayStat {
  label: string;
  value: string;
  detail?: string | null;
}

function DayKitColumn({
  title,
  items,
  styles,
  ink,
}: Readonly<{
  title: string;
  items: GearTipItem[];
  styles: ReturnType<typeof makeDetailStyles>;
  ink: string;
}>) {
  return (
    <View style={styles.kitColumn}>
      <ThemedText style={styles.label}>{title}</ThemedText>
      {items.map((item) => (
        <View key={item.label} style={styles.kitItem}>
          <View style={styles.kitIcon}>
            <KitGearIcon iconKey={item.icon} size={18} color={ink} />
          </View>
          <ThemedText style={styles.kitLabel}>{preventOrphans(item.label)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * A day's details, opened from its row: why it rates as it does, the ride
 * window's numbers side by side, and what to wear and bring. The window's
 * time is already in the row's note, so it isn't repeated here.
 */
function DayRowDetail({
  day,
  isExpanded,
  bestRationale,
  tempUnit,
  thresholds,
}: Readonly<{
  day: DailyWeather;
  isExpanded: boolean;
  bestRationale: string | null;
  tempUnit: 'fahrenheit' | 'celsius';
  thresholds: Thresholds;
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeDetailStyles(c), [c]);
  const openProgress = useExpandAnimation(isExpanded);
  const [gearMode] = useGearMode();
  const { formatRange, formatWind } = useTemperatureDisplay();
  const dayReason = getDayConditionReason(day, tempUnit, thresholds);
  // A reason that names no cause ("Fair window") is left out; the numbers speak.
  const reasonText = bestRationale ?? (isGenericDayReason(dayReason) ? null : dayReason);
  const noRideToday =
    day.rideWindowUnavailable === true || day.condition === 'poor' || day.condition === 'bad';
  const gear = noRideToday ? null : getDayGearSuggestion(day, gearMode, thresholds);
  const window =
    day.rideWindow != null && !day.rideWindowUnavailable && day.condition !== 'bad'
      ? day.rideWindow
      : null;
  const gusts =
    day.windGust != null && Math.round(day.windGust) > Math.round(day.windSpeed)
      ? `gusts ${formatWind(day.windGust)}`
      : null;
  const stats: DayStat[] = [
    ...(window
      ? [
          {
            label: 'Ride temps',
            value: formatRange(window.tempLow, window.tempHigh),
          },
        ]
      : []),
    { label: 'Wind', value: formatWind(day.windSpeed), detail: gusts },
    { label: 'Rain', value: formatPercent(day.rainChance) },
  ];

  return (
    <AnimatedExpand openProgress={openProgress}>
      <View style={styles.drawer} accessibilityLiveRegion="polite">
        {reasonText != null && (
          <ThemedText style={styles.reason}>{preventOrphans(reasonText)}</ThemedText>
        )}
        <View style={styles.stats}>
          {stats.map((stat, idx) => (
            <View key={stat.label} style={[styles.stat, idx > 0 && styles.statDivided]}>
              <ThemedText style={styles.label}>{stat.label}</ThemedText>
              <ThemedText style={styles.value}>{stat.value}</ThemedText>
              {stat.detail != null && (
                <ThemedText style={styles.detail}>{preventOrphans(stat.detail)}</ThemedText>
              )}
            </View>
          ))}
        </View>
        {gear && gear.wear.length > 0 && (
          <View style={styles.kit}>
            <DayKitColumn title="Wear" items={gear.wear} styles={styles} ink={c.ink} />
            {gear.bring.length > 0 && (
              <DayKitColumn title="Bring" items={gear.bring} styles={styles} ink={c.ink} />
            )}
          </View>
        )}
      </View>
    </AnimatedExpand>
  );
}

function DayRowChevron({ isExpanded, color }: Readonly<{ isExpanded: boolean; color: string }>) {
  const openProgress = useExpandAnimation(isExpanded);
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${openProgress.get() * 90}deg` }],
    }),
    [openProgress],
  );

  return (
    <Animated.View style={animatedStyle}>
      {Platform.OS === 'ios' ? (
        <SymbolView name="chevron.right" size={13} tintColor={color} />
      ) : (
        <PlatformIcon icon={ChevronRight} size={14} color={color} strokeWidth={2.5} />
      )}
    </Animated.View>
  );
}

function DayRow({
  day,
  index,
  best,
  bestRationale,
  last,
  isExpanded,
  onToggle,
  icon: DayIcon,
  thresholds,
}: Readonly<{
  day: DailyWeather;
  index: number;
  best: boolean;
  bestRationale: string | null;
  last: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  icon: IconComponent;
  thresholds: Thresholds;
}>) {
  const { c, styles } = useStyles();
  const { format: formatTemp } = useTemperatureDisplay();
  const tempUnit = useResolvedTempUnit();
  const condition = asCondition(day.condition);
  // After sunset Today has no ride window left, and its rating would describe
  // hours already gone, so it shows a neutral "Done" instead.
  const dayDone = day.rideWindowUnavailable === true;
  const ratingLabel = dayDone ? DAYLIGHT_MESSAGES.DAY_DONE_A11Y : CONDITION_DISPLAY[condition];
  const note = getDayRowNote(day, tempUnit, thresholds);
  const noteText = formatDayRowNote(note, best);
  const noteA11y = [best ? 'Best bet' : null, noteText].filter(Boolean).join(', ');
  const rowA11yLabel =
    `${dayLabel(day.date, index)}: high ${formatTemp(day.high)}, low ${formatTemp(day.low)}, ${ratingLabel}` +
    (noteA11y ? '. ' + noteA11y : '');

  return (
    <View
      style={[
        styles.dayRowContainer,
        last && styles.dayRowLast,
        // The whole day, row and details, is tinted while open; the best day keeps its pink.
        isExpanded && { backgroundColor: withAlpha(c.ink, 0.04) },
        best && styles.dayRowBest,
      ]}
    >
      <HapticPressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${rowA11yLabel}. Tap to ${isExpanded ? 'collapse' : 'expand'} details.`}
        accessibilityState={{ expanded: isExpanded }}
        style={({ pressed }) => [
          styles.dayRowHeader,
          pressed && { backgroundColor: withAlpha(c.ink, 0.07) },
        ]}
      >
        <View style={styles.dayRowMain}>
          <View style={styles.dayLabelCell}>
            <ThemedText
              style={styles.dayLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {dayLabel(day.date, index)}
            </ThemedText>
          </View>
          <View style={styles.weatherGlyph}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name={weatherSfSymbol(day.weatherCode) as SFSymbol}
                size={20}
                tintColor={c.mutedInk}
              />
            ) : (
              <PlatformIcon icon={DayIcon} size={20} color={c.mutedInk} filled />
            )}
          </View>
          <ThemedText style={styles.dayTemp} numberOfLines={1}>
            {formatTemp(day.high)}
            <ThemedText style={styles.dayLow}>/{formatTemp(day.low)}</ThemedText>
          </ThemedText>
          {/* A plain word: the strip below carries the color. */}
          <ThemedText style={[styles.dayRating, dayDone && styles.dayRatingDone]} numberOfLines={1}>
            {dayDone ? DAYLIGHT_MESSAGES.DAY_DONE : CONDITION_DISPLAY[condition]}
          </ThemedText>
          <View style={styles.chevronWrap}>
            <DayRowChevron isExpanded={isExpanded} color={c.mutedInk} />
          </View>
        </View>
        {day.daylight && !dayDone && (
          <>
            <DaylightStrip hours={day.daylight} window={note.window} />
            <DaylightAxis hours={day.daylight} isExpanded={isExpanded} />
          </>
        )}
        {(noteText != null || best) && (
          <ThemedText style={styles.dayNote}>
            {best && <ThemedText style={styles.dayNoteLead}>Best bet</ThemedText>}
            {best && noteText != null && ' · '}
            {noteText != null && preventOrphans(noteText)}
          </ThemedText>
        )}
      </HapticPressable>
      <DayRowDetail
        day={day}
        isExpanded={isExpanded}
        bestRationale={best ? bestRationale : null}
        tempUnit={tempUnit}
        thresholds={thresholds}
      />
    </View>
  );
}

export function DailyForecast({
  daily,
  thresholds,
}: Readonly<{ daily: DailyWeather[]; thresholds: Thresholds }>) {
  const { styles } = useStyles();
  const tempUnit = useResolvedTempUnit();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const bestDayInfo = getBestDayInfo(daily, tempUnit, thresholds);

  if (daily.length === 0) {
    return (
      <BrutalCard small>
        <ThemedText style={styles.muted}>
          The daily outlook is unavailable right now. Check back in a bit.
        </ThemedText>
      </BrutalCard>
    );
  }

  return (
    <View style={styles.weekSection}>
      <BrutalCard style={styles.dailyList}>
        <View style={styles.dailyClip}>
          {daily.map((day, index) => (
            <DayRow
              key={`${String(day.date)}-${index}`}
              day={day}
              index={index}
              best={index === bestDayInfo.index}
              bestRationale={index === bestDayInfo.index ? bestDayInfo.rationale : null}
              last={index === daily.length - 1}
              isExpanded={expandedIndex === index}
              onToggle={() => {
                setExpandedIndex((prev) => (prev === index ? null : index));
              }}
              icon={weatherIconFor(day.weatherCode)}
              thresholds={thresholds}
            />
          ))}
        </View>
      </BrutalCard>
    </View>
  );
}

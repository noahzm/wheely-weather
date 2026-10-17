import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ChevronRight, Clock, CloudRain, Wind, type IconComponent } from './icons';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY, getDayGearSuggestion } from '@/domain';
import { DAYLIGHT_MESSAGES } from '@/domain/copy';
import { dayLabel, getBestDayInfo, formatPercent } from '@/utils';
import { getDayConditionReason } from '@/utils/forecastHelpers';
import { fullHourLabel } from '@/utils/timeFormat';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import {
  FontWeightBlack,
  Fonts,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import type { Thresholds } from '@/domain/constants';
import type { DailyWeather } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import {
  BrutalCard,
  CardInnerRadius,
  Chip,
  ConditionPill,
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
      borderColor: c.border,
    },
    dayRowHeader: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    dayRowLast: { borderBottomWidth: 0 },
    dayRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    // Fits "Tomorrow"; the label shrinks a little on the narrowest phones. The
    // best-bet tag sits under the day name, so no column gives up width for it.
    dayLabelCell: { width: 98, gap: Spacing.half },
    bestTag: { paddingHorizontal: 6, paddingVertical: 1 },
    dayLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.body,
    },
    weatherGlyph: { width: 22, alignItems: 'center' },
    // Body size, not heading: the rating, not the temperature, leads the row.
    dayTemp: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.body,
      ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null),
    },
    dayLow: { color: c.mutedInk, fontSize: Type.small.fontSize },
    // The ratings form a column at the right, beside the chevron. Pushed there by
    // its margin; a spacer view would cost the row another gap.
    ratingCell: { marginLeft: 'auto' },
    chevronWrap: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayDetailDrawer: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
      paddingTop: Spacing.two,
      gap: Spacing.two,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(c.ink, 0.15),
    },
    dayDetailReason: {
      color: c.ink,
      fontFamily: Fonts.bold,
      ...Type.small,
      fontWeight: FontWeightBlack,
    },
    dayDetailGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.one,
    },
    dayDetailPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.paper,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    dayDetailPillText: {
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.micro,
      fontWeight: '400',
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

function DayRowDetail({
  day,
  isExpanded,
  bestRationale,
  tempUnit,
  thresholds,
  formatTemp,
  formatWind,
  styles,
  c,
}: Readonly<{
  day: DailyWeather;
  isExpanded: boolean;
  bestRationale: string | null;
  tempUnit: 'fahrenheit' | 'celsius';
  thresholds: Thresholds;
  formatTemp: (f: number) => string;
  formatWind: (mph: number) => string;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const openProgress = useExpandAnimation(isExpanded);
  const [gearMode] = useGearMode();
  const reasonText = bestRationale ?? getDayConditionReason(day, tempUnit, thresholds);
  const effectiveGust =
    day.windGust != null && Math.round(day.windGust) > Math.round(day.windSpeed)
      ? ` (gusts ${formatWind(day.windGust)})`
      : '';
  const noRideToday =
    day.rideWindowUnavailable === true || day.condition === 'poor' || day.condition === 'bad';
  const dayGear = noRideToday ? null : getDayGearSuggestion(day, gearMode, thresholds);
  const kitItems = dayGear ? [...dayGear.wear, ...dayGear.bring] : [];
  const showRideWindow =
    day.rideWindow != null && !day.rideWindowUnavailable && day.condition !== 'bad';

  return (
    <AnimatedExpand openProgress={openProgress}>
      <View style={styles.dayDetailDrawer} accessibilityLiveRegion="polite">
        <ThemedText style={styles.dayDetailReason}>{preventOrphans(reasonText)}</ThemedText>
        <View style={styles.dayDetailGrid}>
          {showRideWindow && day.rideWindow && (
            <View style={styles.dayDetailPill}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="clock.fill" size={13} tintColor={c.ink} />
              ) : (
                <PlatformIcon icon={Clock} size={13} color={c.ink} filled />
              )}
              <ThemedText style={styles.dayDetailPillText}>
                {`${fullHourLabel(day.rideWindow.startHour)}–${fullHourLabel(day.rideWindow.endHour)} · ${formatTemp(day.rideWindow.tempLow)}–${formatTemp(day.rideWindow.tempHigh)}`}
              </ThemedText>
            </View>
          )}
          <View style={styles.dayDetailPill}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="wind" size={13} tintColor={c.ink} />
            ) : (
              <PlatformIcon icon={Wind} size={13} color={c.ink} />
            )}
            <ThemedText style={styles.dayDetailPillText}>
              {`${formatWind(day.windSpeed)}${effectiveGust}`}
            </ThemedText>
          </View>
          <View style={styles.dayDetailPill}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="drop.fill" size={13} tintColor={c.ink} />
            ) : (
              <PlatformIcon icon={CloudRain} size={13} color={c.ink} filled />
            )}
            <ThemedText style={styles.dayDetailPillText}>
              {`${formatPercent(day.rainChance)} rain`}
            </ThemedText>
          </View>
        </View>
        {kitItems.length > 0 && (
          <View style={styles.dayDetailGrid}>
            {kitItems.map((item, idx) => (
              <View key={`kit-${item.label}-${idx}`} style={styles.dayDetailPill}>
                <KitGearIcon iconKey={item.icon} size={13} color={c.ink} />
                <ThemedText style={styles.dayDetailPillText}>{item.label}</ThemedText>
              </View>
            ))}
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
  const { format: formatTemp, formatWind } = useTemperatureDisplay();
  const tempUnit = useResolvedTempUnit();
  const condition = asCondition(day.condition);
  // After sunset Today has no ride window left, and its rating would describe
  // hours already gone, so it shows a neutral "Done" instead.
  const dayDone = day.rideWindowUnavailable === true;
  const ratingLabel = dayDone ? DAYLIGHT_MESSAGES.DAY_DONE_A11Y : CONDITION_DISPLAY[condition];
  const rowA11yLabel = `${dayLabel(day.date, index)}: high ${formatTemp(day.high)}, low ${formatTemp(day.low)}, ${ratingLabel}${best ? ', Best bet' : ''}`;

  return (
    <View style={[styles.dayRowContainer, last && styles.dayRowLast]}>
      <HapticPressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${rowA11yLabel}. Tap to ${isExpanded ? 'collapse' : 'expand'} details.`}
        accessibilityState={{ expanded: isExpanded }}
        style={({ pressed }) => [
          styles.dayRowHeader,
          isExpanded && { backgroundColor: withAlpha(c.ink, 0.03) },
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
            {best ? (
              <View accessibilityRole="text" accessibilityLabel="Best bet">
                <Chip accent style={styles.bestTag}>
                  Best bet
                </Chip>
              </View>
            ) : null}
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
          {/* The pill aligns itself to the top; this wrapper lets the row center it. */}
          <View style={styles.ratingCell}>
            {dayDone ? (
              <ConditionPill large>{DAYLIGHT_MESSAGES.DAY_DONE}</ConditionPill>
            ) : (
              <ConditionPill condition={condition} large>
                {CONDITION_DISPLAY[condition]}
              </ConditionPill>
            )}
          </View>
          <View style={styles.chevronWrap}>
            <DayRowChevron isExpanded={isExpanded} color={c.mutedInk} />
          </View>
        </View>
      </HapticPressable>
      <DayRowDetail
        day={day}
        isExpanded={isExpanded}
        bestRationale={best ? bestRationale : null}
        tempUnit={tempUnit}
        thresholds={thresholds}
        formatTemp={formatTemp}
        formatWind={formatWind}
        styles={styles}
        c={c}
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

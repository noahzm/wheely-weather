import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ChevronDown, Clock, CloudRain, Wind, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY } from '@/domain';
import { dayLabel, getBestDayInfo, formatPercent } from '@/utils';
import { getDayConditionReason } from '@/utils/forecastHelpers';
import { fullHourLabel } from '@/utils/timeFormat';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { useResolvedTempUnit } from '@/hooks/settings-context';
import {
  FontWeightBlack,
  Fonts,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import type { DailyWeather } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import {
  BrutalCard,
  CardInnerRadius,
  Chip,
  ConditionPill,
  HapticPressable,
  PlatformIcon,
  asCondition,
  weatherIconFor,
  weatherSfSymbol,
} from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    weekSection: { gap: Spacing.three },
    dailyList: { padding: 0, gap: 0, overflow: 'visible' },
    // Clips the best-bet row's accent border at the card's corners; concentric
    // radius so the clip follows the inside of the card border.
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
    dayRowBest: {
      borderLeftWidth: 5,
      borderLeftColor: c.accent,
      paddingLeft: 11,
    },
    dayRowLast: { borderBottomWidth: 0 },
    dayRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
    },
    dayLabelCell: { width: 72 },
    dayLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.body,
    },
    weatherGlyph: { width: 22, alignItems: 'center' },
    dayTemp: {
      color: c.ink,
      minWidth: 82,
      flex: 1,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.heading,
      ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null),
    },
    dayLow: { color: c.mutedInk, fontSize: Type.small.fontSize },
    chevronWrap: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayDetailDrawer: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
      paddingTop: Spacing.one,
      gap: Spacing.two,
    },
    dayDetailReason: {
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.small,
      fontWeight: '600',
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
      fontSize: Type.micro.fontSize,
      fontWeight: '500',
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

function DayRowDetail({
  day,
  isExpanded,
  bestRationale,
  tempUnit,
  formatTemp,
  styles,
  c,
}: Readonly<{
  day: DailyWeather;
  isExpanded: boolean;
  bestRationale: string | null;
  tempUnit: 'fahrenheit' | 'celsius';
  formatTemp: (f: number) => string;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const openProgress = useExpandAnimation(isExpanded);
  const reasonText = bestRationale ?? getDayConditionReason(day, tempUnit);
  const effectiveGust =
    day.windGust != null && Math.round(day.windGust) > Math.round(day.windSpeed)
      ? ` (gusts ${Math.round(day.windGust)} mph)`
      : '';

  return (
    <AnimatedExpand openProgress={openProgress}>
      <View style={styles.dayDetailDrawer} accessibilityLiveRegion="polite">
        <ThemedText style={styles.dayDetailReason}>{reasonText}</ThemedText>
        <View style={styles.dayDetailGrid}>
          {day.rideWindow && (
            <View style={styles.dayDetailPill}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="clock.fill" size={13} tintColor={c.ink} />
              ) : (
                <PlatformIcon icon={Clock} size={13} color={c.ink} />
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
              {`${Math.round(day.windSpeed)} mph${effectiveGust}`}
            </ThemedText>
          </View>
          <View style={styles.dayDetailPill}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="drop.fill" size={13} tintColor={c.ink} />
            ) : (
              <PlatformIcon icon={CloudRain} size={13} color={c.ink} />
            )}
            <ThemedText style={styles.dayDetailPillText}>
              {`${formatPercent(day.rainChance)} rain`}
            </ThemedText>
          </View>
        </View>
      </View>
    </AnimatedExpand>
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
}: Readonly<{
  day: DailyWeather;
  index: number;
  best: boolean;
  bestRationale: string | null;
  last: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  icon: LucideIcon;
}>) {
  const { c, styles } = useStyles();
  const { format: formatTemp } = useTemperatureDisplay();
  const tempUnit = useResolvedTempUnit();
  const condition = asCondition(day.condition);
  const rowA11yLabel = `${dayLabel(day.date, index)}: high ${formatTemp(day.high)}, low ${formatTemp(day.low)}, ${CONDITION_DISPLAY[condition]}${best ? ', Best bet' : ''}`;

  return (
    <View style={[styles.dayRowContainer, last && styles.dayRowLast]}>
      <HapticPressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${rowA11yLabel}. Tap to ${isExpanded ? 'collapse' : 'expand'} details.`}
        accessibilityState={{ expanded: isExpanded }}
        style={[styles.dayRowHeader, best && styles.dayRowBest]}
      >
        <View style={styles.dayRowMain}>
          <View style={styles.dayLabelCell}>
            <ThemedText style={styles.dayLabel}>{dayLabel(day.date, index)}</ThemedText>
          </View>
          <View style={styles.weatherGlyph}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name={weatherSfSymbol(day.weatherCode) as SFSymbol}
                size={20}
                tintColor={c.mutedInk}
              />
            ) : (
              <PlatformIcon icon={DayIcon} size={20} color={c.mutedInk} strokeWidth={2} />
            )}
          </View>
          <ThemedText style={styles.dayTemp} numberOfLines={1}>
            {formatTemp(day.high)}
            <ThemedText style={styles.dayLow}>/{formatTemp(day.low)}</ThemedText>
          </ThemedText>
          <ConditionPill condition={condition}>{CONDITION_DISPLAY[condition]}</ConditionPill>
          {best ? (
            <View accessibilityRole="text" accessibilityLabel="Best bet">
              <Chip accent>Best</Chip>
            </View>
          ) : null}
          <View style={styles.chevronWrap}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name={isExpanded ? 'chevron.down' : 'chevron.right'}
                size={13}
                tintColor={c.mutedInk}
              />
            ) : (
              <View style={isExpanded && { transform: [{ rotate: '180deg' }] }}>
                <PlatformIcon icon={ChevronDown} size={16} color={c.mutedInk} strokeWidth={2.5} />
              </View>
            )}
          </View>
        </View>
      </HapticPressable>
      <DayRowDetail
        day={day}
        isExpanded={isExpanded}
        bestRationale={best ? bestRationale : null}
        tempUnit={tempUnit}
        formatTemp={formatTemp}
        styles={styles}
        c={c}
      />
    </View>
  );
}

export function DailyForecast({ daily }: Readonly<{ daily: DailyWeather[] }>) {
  const { styles } = useStyles();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const bestDayInfo = getBestDayInfo(daily);

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
            />
          ))}
        </View>
      </BrutalCard>
    </View>
  );
}

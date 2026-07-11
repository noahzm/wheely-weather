import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY } from '@/domain';
import { dayLabel, getBestDayInfo, getBestDaysBlurb, getDayConditionReason } from '@/utils';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { DailyWeather } from '@/types/weather';
import { BrutalCard, BurstChip, asCondition, weatherIconFor, weatherSfSymbol } from './primitives';

// Width reserved on the best-day row so its text clears the burst sticker.
// Sized against the rendered width of the large BurstChip ("BEST DAY") — revisit
// if BURST_CHIP_SIZES.large padding or the sticker copy changes.
const BEST_STICKER_RESERVE = 128;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    weekSection: { gap: Spacing.three },
    weekBlurb: {
      color: c.mutedInk,
      fontFamily: Fonts.heading,
      fontSize: 16,
      fontWeight: FontWeightBold,
      lineHeight: 26,
    },
    dailyList: { padding: 0, gap: 0, overflow: 'visible' },
    dayRow: {
      position: 'relative',
      flexDirection: 'column',
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      borderBottomWidth: 2,
      borderColor: c.border,
      overflow: 'visible',
    },
    dayRowBest: { paddingRight: BEST_STICKER_RESERVE },
    dayRowLast: { borderBottomWidth: 0 },
    dayRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    dayLabelCell: { minWidth: 96 },
    dayLabel: {
      color: c.ink,
      fontFamily: Fonts.heading,
      fontSize: 16,
      fontWeight: FontWeightBold,
      textTransform: 'uppercase',
    },
    weatherGlyph: { width: 26, alignItems: 'center' },
    dayTemp: {
      color: c.ink,
      flexShrink: 0,
      fontFamily: Fonts.display,
      fontSize: 24,
      fontWeight: FontWeightBold,
      ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null),
    },
    dayLow: { color: c.mutedInk, fontSize: 15 },
    conditionCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    conditionSwatch: {
      width: 10,
      height: 10,
      borderWidth: 1,
      borderColor: c.shadow,
    },
    conditionLabel: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    bestSticker: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: -Spacing.one,
      justifyContent: 'center',
      zIndex: 1,
      transform: [{ rotate: '-3deg' }],
    },
    dayReason: {
      color: c.mutedInk,
      fontSize: 14,
      lineHeight: 20,
    },
    muted: {
      color: c.mutedInk,
      fontSize: 15,
      lineHeight: 22,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function DayRow({
  day,
  index,
  best,
  last,
  icon: DayIcon,
}: Readonly<{
  day: DailyWeather;
  index: number;
  best: boolean;
  last: boolean;
  icon: LucideIcon;
}>) {
  const { c, styles } = useStyles();
  const { unit: tempUnit, format: formatTemp } = useTemperatureDisplay();
  const condition = asCondition(day.condition);
  return (
    <View style={[styles.dayRow, best && styles.dayRowBest, last && styles.dayRowLast]}>
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
            <DayIcon size={20} color={c.mutedInk} strokeWidth={2} />
          )}
        </View>
        <ThemedText style={styles.dayTemp} numberOfLines={1}>
          {formatTemp(day.high)}
          <ThemedText style={styles.dayLow}>/{formatTemp(day.low)}</ThemedText>
        </ThemedText>
        <View style={styles.conditionCell}>
          <View style={[styles.conditionSwatch, { backgroundColor: c.condition[condition].bg }]} />
          <ThemedText style={styles.conditionLabel}>{CONDITION_DISPLAY[condition]}</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.dayReason}>{getDayConditionReason(day, tempUnit)}</ThemedText>
      {best ? (
        <View
          style={[styles.bestSticker, { pointerEvents: 'none' }]}
          accessibilityRole="text"
          accessibilityLabel="Best ride day"
        >
          <BurstChip backgroundColor={c.condition.good.bg} color={c.condition.good.ink} large>
            Best day
          </BurstChip>
        </View>
      ) : null}
    </View>
  );
}

export function DailyForecast({ daily }: Readonly<{ daily: DailyWeather[] }>) {
  const { styles } = useStyles();
  const { index: bestDayIdx, rationale } = getBestDayInfo(daily);
  const blurb = getBestDaysBlurb(daily, bestDayIdx, rationale);

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
      <BrutalCard small>
        <ThemedText style={styles.weekBlurb}>{blurb}</ThemedText>
      </BrutalCard>
      <BrutalCard style={styles.dailyList}>
        {daily.map((day, index) => (
          <DayRow
            key={`${String(day.date)}-${index}`}
            day={day}
            index={index}
            best={index === bestDayIdx}
            last={index === daily.length - 1}
            icon={weatherIconFor(day.weatherCode)}
          />
        ))}
      </BrutalCard>
    </View>
  );
}

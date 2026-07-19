import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY } from '@/domain';
import { dayLabel, getBestDayInfo, getBestDaysBlurb, getDayConditionReason } from '@/utils';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { FontWeightBlack, Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { DailyWeather } from '@/types/weather';
import {
  BrutalCard,
  CardInnerRadius,
  Chip,
  ConditionPill,
  PlatformIcon,
  asCondition,
  weatherIconFor,
  weatherSfSymbol,
} from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    weekSection: { gap: Spacing.three },
    weekBlurb: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.small,
    },
    weekBlurbLead: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
    },
    dailyList: { padding: 0, gap: 0, overflow: 'visible' },
    // Clips the best-bet row's accent border at the card's corners; concentric
    // radius so the clip follows the inside of the card border.
    dailyClip: { borderRadius: CardInnerRadius, overflow: 'hidden' },
    dayRow: {
      position: 'relative',
      flexDirection: 'column',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: c.border,
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
      fontFamily: Fonts.heading,
      fontSize: Type.body.fontSize,
    },
    weatherGlyph: { width: 22, alignItems: 'center' },
    dayTemp: {
      color: c.ink,
      minWidth: 82,
      flex: 1,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      fontSize: Type.heading.fontSize,
      ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : null),
    },
    dayLow: { color: c.mutedInk, fontSize: Type.small.fontSize },
    dayMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    dayReason: {
      color: c.mutedInk,
      flex: 1,
      ...Type.small,
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
            <PlatformIcon icon={DayIcon} size={20} color={c.mutedInk} strokeWidth={2} />
          )}
        </View>
        <ThemedText style={styles.dayTemp} numberOfLines={1}>
          {formatTemp(day.high)}
          <ThemedText style={styles.dayLow}>/{formatTemp(day.low)}</ThemedText>
        </ThemedText>
        <ConditionPill condition={condition}>{CONDITION_DISPLAY[condition]}</ConditionPill>
      </View>
      <View style={styles.dayMetaRow}>
        <ThemedText style={styles.dayReason}>{getDayConditionReason(day, tempUnit)}</ThemedText>
        {best ? (
          <View accessibilityRole="text" accessibilityLabel="Best bet">
            <Chip accent>Best bet</Chip>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function DailyForecast({ daily }: Readonly<{ daily: DailyWeather[] }>) {
  const { styles } = useStyles();
  const { index: bestDayIdx, rationale } = getBestDayInfo(daily);
  const blurb = getBestDaysBlurb(daily, bestDayIdx, rationale);
  const firstSentenceEnd = blurb.indexOf('.');
  const blurbLead = firstSentenceEnd === -1 ? blurb : blurb.slice(0, firstSentenceEnd + 1);
  const blurbRest = firstSentenceEnd === -1 ? '' : blurb.slice(firstSentenceEnd + 1);

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
        <ThemedText style={styles.weekBlurb}>
          <ThemedText style={styles.weekBlurbLead}>{blurbLead}</ThemedText>
          {blurbRest}
        </ThemedText>
      </BrutalCard>
      <BrutalCard style={styles.dailyList}>
        <View style={styles.dailyClip}>
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
        </View>
      </BrutalCard>
    </View>
  );
}

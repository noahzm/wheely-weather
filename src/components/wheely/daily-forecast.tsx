import { useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY } from '@/domain';
import { dayLabel, getBestDayInfo, getBestDaysBlurb, getDayConditionReason } from '@/utils';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { DailyWeather } from '@/types/weather';
import { BrutalCard, Chip, asCondition, weatherIconFor, weatherSfSymbol } from './primitives';

function makeStyles(c: WheelyPalette, isCompact: boolean) {
  return StyleSheet.create({
    weekSection: { gap: Spacing.three },
    weekBlurb: {
      color: c.mutedInk,
      fontFamily: Fonts.monoBold,
      fontSize: 16,
      fontWeight: FontWeightBold,
      lineHeight: 26,
    },
    dailyList: { padding: 0, gap: 0, overflow: 'visible' },
    dayRow: {
      position: 'relative',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.four,
      paddingRight: 80,
      borderBottomWidth: 2,
      borderColor: c.border,
      overflow: 'visible',
      ...(isCompact
        ? { flexDirection: 'column', gap: Spacing.one }
        : { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }),
    },
    dayRowLast: { borderBottomWidth: 0 },
    dayRowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    conditionSticker: {
      position: 'absolute',
      right: Spacing.two,
      top: Spacing.two,
      bottom: Spacing.two,
      justifyContent: 'center',
      zIndex: 1,
    },
    dayLabelCell: { minWidth: 96 },
    bestDayLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    dayLabel: {
      color: c.ink,
      fontFamily: Fonts.monoBold,
      fontSize: 16,
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
    dayReason: {
      color: c.mutedInk,
      fontSize: 14,
      lineHeight: 20,
      ...(isCompact ? { alignSelf: 'stretch' } : { flex: 1, minWidth: 0 }),
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
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== 'web' || width < 640;
  const styles = useMemo(() => makeStyles(c, isCompact), [c, isCompact]);
  return { c, styles, isCompact };
}

export function DailyForecast({ daily }: Readonly<{ daily: DailyWeather[] }>) {
  const { c, styles, isCompact } = useStyles();
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
        {daily.map((day, index) => {
          const best = index === bestDayIdx;
          const reason = getDayConditionReason(day);
          const DayIcon = weatherIconFor(day.weatherCode);
          const summary = (
            <>
              <View style={styles.dayLabelCell}>
                {best ? (
                  <View style={styles.bestDayLabel}>
                    <ThemedText style={styles.dayLabel}>{dayLabel(day.date, index)}</ThemedText>
                    {Platform.OS === 'ios' ? (
                      <SymbolView name="star.fill" size={16} tintColor={c.condition.good.bg} />
                    ) : (
                      <Star
                        size={16}
                        color={c.condition.good.bg}
                        strokeWidth={2.5}
                        fill={c.condition.good.bg}
                      />
                    )}
                  </View>
                ) : (
                  <ThemedText style={styles.dayLabel}>{dayLabel(day.date, index)}</ThemedText>
                )}
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
                {day.high}°<ThemedText style={styles.dayLow}>/{day.low}°</ThemedText>
              </ThemedText>
            </>
          );
          return (
            <View
              key={`${String(day.date)}-${index}`}
              style={[styles.dayRow, index === daily.length - 1 && styles.dayRowLast]}
            >
              {isCompact ? <View style={styles.dayRowMain}>{summary}</View> : summary}
              <ThemedText style={styles.dayReason} numberOfLines={isCompact ? undefined : 2}>
                {reason}
              </ThemedText>
              <View style={[styles.conditionSticker, { pointerEvents: 'none' }]}>
                <Chip condition={asCondition(day.condition)} burst={false}>
                  {CONDITION_DISPLAY[asCondition(day.condition)]}
                </Chip>
              </View>
            </View>
          );
        })}
      </BrutalCard>
    </View>
  );
}

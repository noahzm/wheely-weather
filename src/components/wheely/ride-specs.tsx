import { useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Droplet,
  Droplets,
  Gauge,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY, evaluateCondition, THRESHOLDS } from '@/domain';
import {
  getAqiLabel,
  getDewpointLabel,
  getUvCondition,
  getUvLabel,
  getWindArrowRotation,
  getWindDirectionLabel,
} from '@/utils';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { Weather } from '@/types/weather';
import { BrutalCard, Chip, asCondition, PlatformIcon, type MaterialIconName } from './primitives';

interface RideSpecMetric {
  Icon: LucideIcon;
  webIcon: MaterialIconName;
  sf: string;
  label: string;
  value: string;
  qualifier?: string | null;
  condition?: string;
  iconRotation?: number;
}

function rideSpecMetrics(
  weather: Weather,
  thresholds: typeof THRESHOLDS,
  formatTemp: (value: number) => string,
): RideSpecMetric[] {
  return [
    {
      Icon: Droplets,
      webIcon: 'water',
      sf: 'drop.fill',
      label: 'Rain Chance',
      value: `${weather.rainChance}%`,
      condition: evaluateCondition(weather.rainChance, 'rainChance', thresholds),
    },
    {
      Icon: Thermometer,
      webIcon: 'thermometer',
      sf: 'thermometer.medium',
      label: 'Temperature',
      value: formatTemp(weather.temperature),
      qualifier: `feels ${formatTemp(weather.feelsLike)}`,
      condition: evaluateCondition(weather.temperature, 'temperature', thresholds),
    },
    {
      Icon: Wind,
      webIcon: 'weather-windy',
      sf: 'wind',
      label: 'Wind',
      value: `${Math.round(weather.windSpeed)} mph`,
      qualifier:
        weather.windDirection == null
          ? null
          : `from ${getWindDirectionLabel(weather.windDirection)}`,
      condition: evaluateCondition(weather.windSpeed, 'windSpeed', thresholds),
      iconRotation:
        weather.windDirection == null
          ? undefined
          : (getWindArrowRotation(weather.windDirection) ?? undefined),
    },
    {
      Icon: Gauge,
      webIcon: 'gauge',
      sf: 'aqi.medium',
      label: 'Air Quality',
      value: weather.aqi == null ? '—' : `${weather.aqi}`,
      qualifier: weather.aqi == null ? null : getAqiLabel(weather.aqi),
      condition:
        weather.aqi == null ? undefined : evaluateCondition(weather.aqi, 'aqi', thresholds),
    },
    {
      Icon: Droplet,
      webIcon: 'water',
      sf: 'humidity.fill',
      label: 'Dewpoint',
      value: formatTemp(weather.dewpoint),
      qualifier: getDewpointLabel(weather.dewpoint),
      condition: evaluateCondition(weather.dewpoint, 'dewpoint', thresholds),
    },
    {
      Icon: Sun,
      webIcon: 'weather-sunny',
      sf: 'sun.max.fill',
      label: 'UV Index',
      value: weather.uvIndex == null ? '—' : `${Math.round(weather.uvIndex)}`,
      qualifier: weather.uvIndex == null ? null : getUvLabel(weather.uvIndex),
      condition: getUvCondition(weather.uvIndex),
    },
    {
      Icon: Sunrise,
      webIcon: 'weather-sunset-up',
      sf: 'sunrise.fill',
      label: 'Sunrise',
      value: weather.sunrise ?? '—',
    },
    {
      Icon: Sunset,
      webIcon: 'weather-sunset-down',
      sf: 'sunset.fill',
      label: 'Sunset',
      value: weather.sunset ?? '—',
    },
  ];
}

function makeStyles(c: WheelyPalette, isCompact: boolean) {
  return StyleSheet.create({
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.three,
      overflow: 'visible',
      ...(isCompact ? { justifyContent: 'space-between' as const } : null),
    },
    metricCard: {
      position: 'relative',
      width: isCompact ? '47%' : '23%',
      minWidth: isCompact ? undefined : 150,
      gap: Spacing.two,
      overflow: 'visible',
      paddingBottom: Spacing.four,
      paddingRight: Spacing.five,
    },
    conditionSticker: {
      position: 'absolute',
      right: -12,
      bottom: -12,
      zIndex: 1,
    },
    rotatedSticker: {
      transform: [{ rotate: '4deg' }, { scale: 1.12 }],
    },
    metricLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    metricIconWrap: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricLabel: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '400',
    },
    metricValue: {
      color: c.ink,
      fontFamily: Fonts.display,
      fontSize: 30,
      lineHeight: 34,
      fontWeight: FontWeightBold,
    },
    metricFooter: {
      gap: Spacing.two,
    },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== 'web' || width < 640;
  const styles = useMemo(() => makeStyles(c, isCompact), [c, isCompact]);
  return { c, styles };
}

export function RideSpecs({
  weather,
  thresholds = THRESHOLDS,
}: Readonly<{ weather: Weather; thresholds?: typeof THRESHOLDS }>) {
  const { c, styles } = useStyles();
  const { format: formatTemp } = useTemperatureDisplay();
  const metrics = rideSpecMetrics(weather, thresholds, formatTemp);

  return (
    <View style={styles.metricsGrid}>
      {metrics.map(({ Icon, webIcon, sf, label, value, qualifier, condition, iconRotation }) => (
        <BrutalCard key={label} small style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <View
              style={[
                styles.metricIconWrap,
                iconRotation == null ? null : { transform: [{ rotate: `${iconRotation}deg` }] },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView name={sf as SFSymbol} size={18} tintColor={c.mutedInk} />
              ) : (
                <PlatformIcon
                  icon={Icon}
                  webName={webIcon}
                  size={18}
                  color={c.mutedInk}
                  strokeWidth={2}
                />
              )}
            </View>
            <ThemedText style={styles.metricLabel}>{label}</ThemedText>
          </View>
          <ThemedText style={styles.metricValue}>{value}</ThemedText>
          <View style={styles.metricFooter}>
            {!!qualifier && <ThemedText style={styles.muted}>{qualifier}</ThemedText>}
          </View>
          {condition && ['marginal', 'poor', 'bad'].includes(condition) && (
            <View style={[styles.conditionSticker, { pointerEvents: 'none' }]}>
              <Chip condition={asCondition(condition)} large style={styles.rotatedSticker}>
                {CONDITION_DISPLAY[asCondition(condition)]}
              </Chip>
            </View>
          )}
        </BrutalCard>
      ))}
    </View>
  );
}

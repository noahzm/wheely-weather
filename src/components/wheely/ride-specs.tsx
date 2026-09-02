import { useMemo, useState } from 'react';
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
import { CONDITION_DISPLAY, evaluateCondition, evaluateWind, THRESHOLDS } from '@/domain';
import {
  getAqiLabel,
  getDewpointLabel,
  formatPercent,
  getUvCondition,
  getUvLabel,
  getWindArrowRotation,
  getWindDirectionLabel,
} from '@/utils';
import { getMetricExplainer, type MetricExplainer } from '@/utils/metricExplainers';
import { useWheelyColors } from '@/hooks/use-theme';
import { useTemperatureDisplay } from '@/hooks/use-temperature-display';
import { FontWeightBlack, Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { Weather } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import {
  BrutalCard,
  ConditionPill,
  asCondition,
  HapticPressable,
  PlatformIcon,
} from './primitives';

interface RideSpecMetric {
  Icon: LucideIcon;
  sf: string;
  label: string;
  value: string;
  qualifier?: string | null;
  condition?: string;
  iconRotation?: number;
}

// The verdict and hourly drawer name gusts when they set the rating, so the
// Wind cell surfaces them too — otherwise a gust-driven rating has no number
// here to explain itself. Gusts only appear when they exceed the sustained
// reading (rounded, so "8 mph" never pairs with "gusts 8 mph").
function windQualifier(weather: Weather): string | null {
  const parts: string[] = [];
  if (weather.windDirection != null) {
    parts.push(`from ${getWindDirectionLabel(weather.windDirection)}`);
  }
  if (weather.windGust != null && Math.round(weather.windGust) > Math.round(weather.windSpeed)) {
    parts.push(`gusts ${Math.round(weather.windGust)} mph`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function rideSpecMetrics(
  weather: Weather,
  thresholds: typeof THRESHOLDS,
  formatTemp: (value: number) => string,
): RideSpecMetric[] {
  return [
    {
      Icon: Droplets,
      sf: 'drop.fill',
      label: 'Rain Chance',
      value: formatPercent(weather.rainChance),
      condition: evaluateCondition(weather.rainChance, 'rainChance', thresholds),
    },
    {
      Icon: Thermometer,
      sf: 'thermometer.medium',
      label: 'Temperature',
      value: formatTemp(weather.temperature),
      qualifier:
        formatTemp(weather.feelsLike) === formatTemp(weather.temperature)
          ? null
          : `feels ${formatTemp(weather.feelsLike)}`,
      condition: evaluateCondition(weather.temperature, 'temperature', thresholds),
    },
    {
      Icon: Wind,
      sf: 'wind',
      label: 'Wind',
      value: `${Math.round(weather.windSpeed)} mph`,
      qualifier: windQualifier(weather),
      // Gust-aware, matching the verdict hero and the hourly drawer's rating.
      condition: evaluateWind(weather.windSpeed, weather.windGust, thresholds),
      iconRotation:
        weather.windDirection == null
          ? undefined
          : (getWindArrowRotation(weather.windDirection) ?? undefined),
    },
    {
      Icon: Gauge,
      sf: 'aqi.medium',
      label: 'Air Quality',
      value: weather.aqi == null ? '—' : `${weather.aqi}`,
      qualifier: weather.aqi == null ? null : getAqiLabel(weather.aqi),
      condition:
        weather.aqi == null ? undefined : evaluateCondition(weather.aqi, 'aqi', thresholds),
    },
    {
      Icon: Droplet,
      sf: 'humidity.fill',
      label: 'Dewpoint',
      value: formatTemp(weather.dewpoint),
      qualifier: getDewpointLabel(weather.dewpoint),
      condition: evaluateCondition(weather.dewpoint, 'dewpoint', thresholds),
    },
    {
      Icon: Sun,
      sf: 'sun.max.fill',
      label: 'UV Index',
      value: weather.uvIndex == null ? '—' : `${Math.round(weather.uvIndex)}`,
      qualifier: weather.uvIndex == null ? null : getUvLabel(weather.uvIndex),
      condition: getUvCondition(weather.uvIndex),
    },
    {
      Icon: Sunrise,
      sf: 'sunrise.fill',
      label: 'Sunrise',
      value: weather.sunrise ?? '—',
    },
    {
      Icon: Sunset,
      sf: 'sunset.fill',
      label: 'Sunset',
      value: weather.sunset ?? '—',
    },
  ];
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    metricsPanel: {
      overflow: 'hidden',
      padding: 0,
      gap: 0,
    },
    rowContainer: {
      width: '100%',
    },
    metricRow: {
      flexDirection: 'row',
      width: '100%',
    },
    metricCell: {
      flex: 1,
      minHeight: 112,
      gap: Spacing.one,
      padding: Spacing.three,
      borderColor: c.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    metricCellActive: {
      backgroundColor: c.accent,
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
      color: c.ink,
      fontFamily: Fonts.body,
      fontSize: Type.small.fontSize,
      fontWeight: '400',
    },
    metricValue: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.stat,
    },
    metricFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.one,
    },
    explainerDrawer: {
      borderColor: c.border,
      borderTopWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      padding: Spacing.three,
      backgroundColor: c.accent,
      gap: Spacing.one,
      width: '100%',
    },
    explainerTitle: {
      color: c.accentInk,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.body,
    },
    explainerSummary: {
      color: c.accentInk,
      fontFamily: Fonts.body,
      ...Type.small,
      opacity: 0.85,
    },
    explainerTip: {
      color: c.accentInk,
      fontFamily: Fonts.body,
      ...Type.small,
      lineHeight: 22,
      marginTop: 2,
    },
    tipPrefix: {
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      color: c.accentInk,
    },
    muted: {
      color: c.mutedInk,
      ...Type.small,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== 'web' || width < 640;
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles, columns: isCompact ? 2 : 4 };
}

function MetricCell({
  metric,
  isLastColumn,
  hasBottomBorder,
  isSelected,
  onPress,
  styles,
  c,
}: Readonly<{
  metric: RideSpecMetric;
  isLastColumn: boolean;
  hasBottomBorder: boolean;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const { Icon, sf, label, value, qualifier, condition, iconRotation } = metric;
  const conditionText =
    condition && condition !== 'good' ? CONDITION_DISPLAY[asCondition(condition)] : null;
  const cellA11yLabel = [`${label}: ${value}`, qualifier, conditionText, 'Tap for cycling guidance']
    .filter(Boolean)
    .join(', ');

  const inkColor = isSelected ? c.accentInk : c.ink;

  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cellA11yLabel}
      accessibilityState={{ selected: isSelected, expanded: isSelected }}
      style={({ pressed }) => [
        styles.metricCell,
        {
          borderRightWidth: isLastColumn ? 0 : 1,
          borderBottomWidth: hasBottomBorder ? 1 : 0,
        },
        isSelected && styles.metricCellActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.metricLabelRow}>
        <View
          style={[
            styles.metricIconWrap,
            iconRotation == null ? null : { transform: [{ rotate: `${iconRotation}deg` }] },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <SymbolView name={sf as SFSymbol} size={18} tintColor={inkColor} />
          ) : (
            <PlatformIcon icon={Icon} size={18} color={inkColor} strokeWidth={2} />
          )}
        </View>
        <ThemedText style={[styles.metricLabel, isSelected && { color: c.accentInk }]}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={[styles.metricValue, isSelected && { color: c.accentInk }]}>
        {value}
      </ThemedText>
      <View style={styles.metricFooter}>
        {!!qualifier && (
          <ThemedText style={[styles.muted, isSelected && { color: c.accentInk }]}>
            {qualifier}
          </ThemedText>
        )}
        {condition && condition !== 'good' && (
          <ConditionPill condition={asCondition(condition)}>
            {CONDITION_DISPLAY[asCondition(condition)]}
          </ConditionPill>
        )}
      </View>
    </HapticPressable>
  );
}

function MetricExplainerDrawer({
  explainer,
  styles,
  isLastRow,
}: Readonly<{
  explainer: MetricExplainer | null;
  styles: ReturnType<typeof makeStyles>;
  isLastRow: boolean;
}>) {
  const isOpen = explainer != null;
  const openProgress = useExpandAnimation(isOpen);
  const [cachedExplainer, setCachedExplainer] = useState(explainer);

  const activeExplainer = explainer ?? cachedExplainer;

  if (explainer != null && explainer !== cachedExplainer) {
    setCachedExplainer(explainer);
  }

  if (!activeExplainer) return null;

  return (
    <AnimatedExpand openProgress={openProgress}>
      <View
        style={[
          styles.explainerDrawer,
          {
            borderBottomWidth: isLastRow ? 0 : 1,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <ThemedText style={styles.explainerTitle}>{activeExplainer.title}</ThemedText>
        <ThemedText style={styles.explainerSummary}>{activeExplainer.summary}</ThemedText>
        <ThemedText style={styles.explainerTip}>
          <ThemedText style={styles.tipPrefix}>Rider tip: </ThemedText>
          {activeExplainer.tip}
        </ThemedText>
      </View>
    </AnimatedExpand>
  );
}

function MetricRow({
  rowMetrics,
  rowIndex,
  totalRows,
  selectedLabel,
  onSelectMetric,
  explainer,
  styles,
  c,
}: Readonly<{
  rowMetrics: RideSpecMetric[];
  rowIndex: number;
  totalRows: number;
  selectedLabel: string | null;
  onSelectMetric: (label: string) => void;
  explainer: MetricExplainer | null;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const isSelectedInRow = rowMetrics.some((m) => m.label === selectedLabel);
  const isLastRow = rowIndex === totalRows - 1;
  const hasBottomBorder = !isLastRow || isSelectedInRow;

  return (
    <View style={styles.rowContainer}>
      <View style={styles.metricRow}>
        {rowMetrics.map((metric, colIndex) => {
          const isLastColumn = colIndex === rowMetrics.length - 1;
          return (
            <MetricCell
              key={metric.label}
              metric={metric}
              isLastColumn={isLastColumn}
              hasBottomBorder={hasBottomBorder}
              isSelected={selectedLabel === metric.label}
              onPress={() => {
                onSelectMetric(metric.label);
              }}
              styles={styles}
              c={c}
            />
          );
        })}
      </View>
      <MetricExplainerDrawer
        explainer={isSelectedInRow ? explainer : null}
        styles={styles}
        isLastRow={isLastRow}
      />
    </View>
  );
}

export function RideSpecs({
  weather,
  thresholds = THRESHOLDS,
}: Readonly<{ weather: Weather; thresholds?: typeof THRESHOLDS }>) {
  const { c, styles, columns } = useStyles();
  const { format: formatTemp } = useTemperatureDisplay();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const metrics = rideSpecMetrics(weather, thresholds, formatTemp);
  const explainer = selectedLabel ? getMetricExplainer(selectedLabel) : null;

  const rows = useMemo(() => {
    const chunked: RideSpecMetric[][] = [];
    for (let i = 0; i < metrics.length; i += columns) {
      chunked.push(metrics.slice(i, i + columns));
    }
    return chunked;
  }, [metrics, columns]);

  const handleSelectMetric = (label: string) => {
    setSelectedLabel((prev) => (prev === label ? null : label));
  };

  return (
    <BrutalCard style={styles.metricsPanel}>
      {rows.map((rowMetrics, rowIndex) => (
        <MetricRow
          key={`row-${rowIndex}`}
          rowMetrics={rowMetrics}
          rowIndex={rowIndex}
          totalRows={rows.length}
          selectedLabel={selectedLabel}
          onSelectMetric={handleSelectMetric}
          explainer={explainer}
          styles={styles}
          c={c}
        />
      ))}
    </BrutalCard>
  );
}

import { useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  ChevronDown,
  Droplet,
  Droplets,
  Gauge,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  type IconComponent,
} from './icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import {
  CONDITION_DISPLAY,
  evaluateCondition,
  evaluateRain,
  evaluateWind,
  THRESHOLDS,
} from '@/domain';
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
import {
  Fonts,
  LabelText,
  PosterLightText,
  Spacing,
  Type,
  type WheelyPalette,
  FontWeightSemibold,
  TabularNumbers,
} from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import type { Condition, Weather } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import {
  BrutalCard,
  CardInnerRadius,
  ConditionPill,
  asCondition,
  HapticPressable,
  PlatformIcon,
} from './primitives';

interface RideSpecMetric {
  Icon: IconComponent;
  sf: string;
  label: string;
  shortLabel?: string;
  value: string;
  qualifier?: string | null;
  condition?: string;
  iconRotation?: number;
}

// The verdict and hourly drawer name gusts when they set the rating, so the
// Wind cell surfaces them too — otherwise a gust-driven rating has no number
// here to explain itself. Gusts only appear when they exceed the sustained
// reading (rounded, so "8 mph" never pairs with "gusts 8 mph").
function windQualifier(weather: Weather, formatWind: (mph: number) => string): string | null {
  const parts: string[] = [];
  if (weather.windDirection != null) {
    parts.push(`from ${getWindDirectionLabel(weather.windDirection)}`);
  }
  if (weather.windGust != null && Math.round(weather.windGust) > Math.round(weather.windSpeed)) {
    parts.push(`gusts ${formatWind(weather.windGust)}`);
  }
  // Each part holds together, so a narrow cell wraps at the dot rather than
  // leaving "mph" alone on the last line.
  return parts.length > 0 ? parts.map((part) => part.replaceAll(' ', '\u00A0')).join(' · ') : null;
}

const HOLDS_RIDE_BACK: ReadonlySet<Condition> = new Set(['marginal', 'poor', 'bad']);

function rideSpecMetrics(
  weather: Weather,
  thresholds: typeof THRESHOLDS,
  formatTemp: (value: number) => string,
  formatWind: (mph: number) => string,
): RideSpecMetric[] {
  return [
    {
      Icon: Droplet,
      sf: 'drop.fill',
      label: 'Rain Chance',
      shortLabel: 'Rain',
      value: formatPercent(weather.rainChance),
      condition: evaluateRain(weather.rainChance, weather.precipitation, thresholds),
    },
    {
      Icon: Thermometer,
      sf: 'thermometer.medium',
      label: 'Temperature',
      shortLabel: 'Temp',
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
      value: formatWind(weather.windSpeed),
      qualifier: windQualifier(weather, formatWind),
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
      Icon: Droplets,
      sf: 'humidity.fill',
      label: 'Dewpoint',
      value: formatTemp(weather.dewpoint),
      qualifier: getDewpointLabel(weather.dewpoint, thresholds),
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
      padding: 0,
      gap: 0,
    },
    metricsClip: {
      borderRadius: CardInnerRadius,
      overflow: 'hidden',
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
      gap: Spacing.one,
      padding: Spacing.three,
      borderColor: c.divider,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    compactCell: { minWidth: 0 },
    compactValue: { ...Type.heading },
    disclosure: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
      minHeight: 48,
      padding: Spacing.three,
      borderTopWidth: 1,
      borderColor: c.divider,
    },
    disclosureText: { flex: 1, gap: Spacing.one },
    moreMetrics: { borderTopWidth: 1, borderColor: c.divider },
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
      flexShrink: 1,
      color: c.ink,
      ...LabelText,
      ...Type.micro,
    },
    metricValue: {
      color: c.ink,
      ...PosterLightText,
      ...Type.stat,
      ...TabularNumbers,
    },
    metricFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.one,
    },
    explainerDrawer: {
      borderColor: c.divider,
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
      fontWeight: FontWeightSemibold,
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
      fontWeight: FontWeightSemibold,
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
  const { width, fontScale } = useWindowDimensions();
  const isCompact = Platform.OS !== 'web' || width < 640;
  const styles = useMemo(() => makeStyles(c), [c]);
  const columns = isCompact ? 2 : 3;
  return {
    c,
    styles,
    columns: fontScale > 1.15 ? 1 : columns,
    daylightColumns: fontScale > 1.15 ? 1 : 2,
    primaryColumns: fontScale > 1.15 ? 1 : 3,
  };
}

function MetricCell({
  metric,
  isLastColumn,
  compact,
  hasBottomBorder,
  isSelected,
  onPress,
  styles,
  c,
}: Readonly<{
  metric: RideSpecMetric;
  isLastColumn: boolean;
  compact: boolean;
  hasBottomBorder: boolean;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const { Icon, sf, label, value, qualifier, condition, iconRotation } = metric;
  const rating = condition ? asCondition(condition) : null;
  const conditionText = rating && rating !== 'good' ? CONDITION_DISPLAY[rating] : null;
  // Chips mark only what holds the ride back; good and fair stay quiet so
  // the problems stand out (the spoken label still names every rating).
  const showChip = rating != null && HOLDS_RIDE_BACK.has(rating);
  const hasFooter = !!qualifier || showChip;
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
        compact && styles.compactCell,
        {
          borderRightWidth: isLastColumn ? 0 : 1,
          borderBottomWidth: hasBottomBorder ? 1 : 0,
        },
        isSelected && styles.metricCellActive,
        pressed && (isSelected ? { opacity: 0.8 } : { backgroundColor: withAlpha(c.ink, 0.06) }),
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
            <PlatformIcon icon={Icon} size={18} color={inkColor} filled={sf.endsWith('.fill')} />
          )}
        </View>
        <ThemedText style={[styles.metricLabel, isSelected && { color: c.accentInk }]}>
          {compact ? (metric.shortLabel ?? label) : label}
        </ThemedText>
      </View>
      <ThemedText
        style={[
          styles.metricValue,
          compact && styles.compactValue,
          isSelected && { color: c.accentInk },
        ]}
      >
        {value}
      </ThemedText>
      {hasFooter && (
        <View style={styles.metricFooter}>
          {!!qualifier && (
            <ThemedText style={[styles.muted, isSelected && { color: c.accentInk }]}>
              {compact ? qualifier.replaceAll('\u00A0', ' ') : qualifier}
            </ThemedText>
          )}
          {showChip && (
            <ConditionPill condition={rating}>{CONDITION_DISPLAY[rating]}</ConditionPill>
          )}
        </View>
      )}
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
    <AnimatedExpand open={isOpen} openProgress={openProgress}>
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
  compact = false,
  rowIndex,
  totalRows,
  selectedLabel,
  onSelectMetric,
  explainer,
  styles,
  c,
}: Readonly<{
  rowMetrics: RideSpecMetric[];
  compact?: boolean;
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
              compact={compact}
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
  const { c, styles, columns, daylightColumns, primaryColumns } = useStyles();
  const { format: formatTemp, formatWind, unit } = useTemperatureDisplay();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreProgress = useExpandAnimation(moreOpen);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const metrics = rideSpecMetrics(weather, thresholds, formatTemp, formatWind);
  // The tip quotes the same thresholds the cells are rated with, in the rider's unit.
  const explainer = selectedLabel ? getMetricExplainer(selectedLabel, { thresholds, unit }) : null;

  const rows = useMemo(() => {
    const chunked: RideSpecMetric[][] = [];
    for (let i = 3; i < 6; i += columns) {
      chunked.push(metrics.slice(i, Math.min(6, i + columns)));
    }
    for (let i = 6; i < metrics.length; i += daylightColumns) {
      chunked.push(metrics.slice(i, i + daylightColumns));
    }
    return chunked;
  }, [metrics, columns, daylightColumns]);

  const primaryRows: RideSpecMetric[][] = [];
  for (let i = 0; i < 3; i += primaryColumns) {
    primaryRows.push(metrics.slice(i, i + primaryColumns));
  }
  const concerns = metrics
    .slice(3)
    .filter((metric) => metric.condition && HOLDS_RIDE_BACK.has(asCondition(metric.condition)))
    .map((metric) => `${metric.label}: ${CONDITION_DISPLAY[asCondition(metric.condition)]}`)
    .join(' · ');

  const handleSelectMetric = (label: string) => {
    setSelectedLabel((prev) => (prev === label ? null : label));
  };

  return (
    <BrutalCard style={styles.metricsPanel}>
      <View style={styles.metricsClip}>
        {primaryRows.map((rowMetrics, rowIndex) => (
          <MetricRow
            key={`primary-${rowIndex}`}
            rowMetrics={rowMetrics}
            compact
            rowIndex={rowIndex}
            totalRows={primaryRows.length}
            selectedLabel={selectedLabel}
            onSelectMetric={handleSelectMetric}
            explainer={explainer}
            styles={styles}
            c={c}
          />
        ))}
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={moreOpen ? 'Fewer weather details' : 'More weather details'}
          accessibilityState={{ expanded: moreOpen }}
          accessibilityHint={concerns || 'Air quality, dewpoint, UV index, sunrise and sunset'}
          onPress={() => {
            setMoreOpen(!moreOpen);
            if (moreOpen && metrics.slice(3).some((metric) => metric.label === selectedLabel)) {
              setSelectedLabel(null);
            }
          }}
          style={({ pressed }) => [
            styles.disclosure,
            pressed && { backgroundColor: withAlpha(c.ink, 0.06) },
          ]}
        >
          <View style={styles.disclosureText}>
            <ThemedText style={styles.muted}>
              {moreOpen ? 'Fewer weather details' : 'More weather details'}
            </ThemedText>
            {!!concerns && <ThemedText style={styles.muted}>{concerns}</ThemedText>}
          </View>
          <PlatformIcon
            icon={ChevronDown}
            sf="chevron.down"
            size={14}
            color={c.mutedInk}
            style={moreOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </HapticPressable>
        <AnimatedExpand open={moreOpen} openProgress={moreProgress}>
          <View style={styles.moreMetrics}>
            {rows.map((rowMetrics, rowIndex) => (
              <MetricRow
                key={`secondary-${rowIndex}`}
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
          </View>
        </AnimatedExpand>
      </View>
    </BrutalCard>
  );
}

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import {
  AlertTriangle,
  Bike,
  ChevronDown,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplet,
  Droplets,
  Footprints,
  Gauge,
  Glasses,
  Hand,
  Layers,
  MapPin,
  Package,
  PersonStanding,
  RefreshCw,
  Shirt,
  Snowflake,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Umbrella,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import {
  CONDITION_DISPLAY,
  evaluateCondition,
  getGearSuggestion,
  getWeatherDescription,
} from '@/domain';
import {
  dayLabel,
  getAqiLabel,
  getBestDayInfo,
  getBestDaysBlurb,
  getDayConditionReason,
  getDewpointLabel,
  getUvCondition,
  getUvLabel,
  getWindArrowRotation,
  getWindDirectionLabel,
} from '@/utils';
import { loadGearMode, saveGearMode } from '@/services/locationStorage';
import { useTheme, useWheelyColors } from '@/hooks/use-theme';
import { Fonts, MaxContentWidth, Spacing, type WheelyPalette } from '@/constants/theme';
import type {
  Condition,
  DailyWeather,
  GearTipItem,
  HourlyWeather,
  Weather,
  WeatherAlert,
} from '@/types/weather';

type ChartHour = HourlyWeather & { isPast: boolean; idx: number };

function useWheely() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function formatTime(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function hourLabel(h: number) {
  if (h === 0) return '12AM';
  if (h === 12) return '12PM';
  if (h < 12) return `${h}AM`;
  return `${h - 12}PM`;
}

function fullHourLabel(h: number) {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function brutalShadow(color: string, width: number, height = width) {
  return Platform.OS === 'web'
    ? ({ boxShadow: `${width}px ${height}px 0 ${color}` } as const)
    : {
        shadowColor: color,
        shadowOffset: { width, height },
        shadowOpacity: 1,
        shadowRadius: 0,
      };
}

function weatherIconFor(code: number | null | undefined): LucideIcon {
  if (code == null) return Cloud;
  if (code <= 1) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 65) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

const GEAR_ICONS: Record<string, LucideIcon> = {
  Shorts: Bike,
  Pants: PersonStanding,
  Jacket: Layers,
  Shirt,
  Layers,
  Hand,
  Footprints,
  Snowflake,
  CloudRain,
  Umbrella,
  Wind,
  Sun,
  Glasses,
  Thermometer,
};

function asCondition(value: unknown): Condition {
  return value === 'good' ||
    value === 'fair' ||
    value === 'marginal' ||
    value === 'poor' ||
    value === 'bad'
    ? value
    : 'fair';
}

export function SectionTitle({ index, title }: { index: string; title: string }) {
  const { styles } = useWheely();
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.indexBadge}>
        <ThemedText style={styles.indexText}>{index}</ThemedText>
      </View>
      <ThemedText style={styles.sectionHeading}>{title}</ThemedText>
    </View>
  );
}

export function Chip({
  children,
  condition,
  primary = false,
  ink = false,
  icon: Icon,
  style,
}: {
  children: ReactNode;
  condition?: Condition;
  primary?: boolean;
  ink?: boolean;
  icon?: LucideIcon;
  style?: object;
}) {
  const { c, styles } = useWheely();
  const backgroundColor = condition
    ? c.condition[condition].bg
    : primary
      ? c.primary
      : ink
        ? c.ink
        : c.paper;
  const color = condition
    ? c.condition[condition].ink
    : ink
      ? c.paper
      : c.ink;
  return (
    <View style={[styles.chip, { backgroundColor }, style]}>
      {Icon && <Icon size={12} color={color} strokeWidth={2.5} fill={color} />}
      <ThemedText style={[styles.chipText, { color }]}>{children}</ThemedText>
    </View>
  );
}

export function BrutalCard({
  children,
  small = false,
  style,
}: {
  children: ReactNode;
  small?: boolean;
  style?: object;
}) {
  const { styles } = useWheely();
  return <View style={[small ? styles.cardSmall : styles.card, style]}>{children}</View>;
}

export function WeatherHeader({
  location,
  lastUpdated,
  isFallbackLocation,
  isManualLocation,
  isDeviceLocation,
  statusMessage,
  onOpenLocation,
}: {
  location: string;
  lastUpdated: Date | null;
  isFallbackLocation: boolean;
  isManualLocation: boolean;
  isDeviceLocation: boolean;
  statusMessage: string;
  onOpenLocation: () => void;
}) {
  const { c, styles } = useWheely();
  return (
    <View style={styles.header}>
      <ThemedText style={styles.brand} accessibilityRole="header">
        Wheely <ThemedText style={[styles.brand, styles.brandMark]}>Weather</ThemedText>
      </ThemedText>
      <Pressable
        onPress={onOpenLocation}
        accessibilityRole="button"
        accessibilityLabel={location ? `Change location, currently ${location}` : 'Set location'}
        style={({ pressed }) => [styles.locationButton, pressed && styles.pressedButton]}>
        <MapPin size={14} color={c.ink} strokeWidth={2.5} />
        <ThemedText style={styles.locationButtonText}>{location || 'Set location'}</ThemedText>
      </Pressable>
      <View style={styles.metaRow}>
        {isManualLocation && <Chip primary>Manual</Chip>}
        {isDeviceLocation && <Chip>Device</Chip>}
        {isFallbackLocation && !isManualLocation && !isDeviceLocation && <Chip>Raleigh default</Chip>}
        {!!lastUpdated && <Chip>Updated {formatTime(lastUpdated)}</Chip>}
      </View>
      {!!statusMessage && (
        <ThemedText style={styles.statusMessage} accessibilityLiveRegion="polite" role="status">
          {statusMessage}
        </ThemedText>
      )}
    </View>
  );
}

export function RideVerdict({ status, message }: { status: 'yes' | 'maybe' | 'no'; message: string }) {
  const { c, styles } = useWheely();
  const meta = {
    yes: { label: 'Ride day', color: c.success, Icon: Bike },
    maybe: { label: 'Mixed conditions', color: c.warning, Icon: CloudSun },
    no: { label: 'Rest day', color: c.error, Icon: CloudOff },
  }[status || 'maybe'];
  const { Icon } = meta;
  return (
    <View
      style={[styles.verdict, { backgroundColor: meta.color }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${meta.label}. ${message}`}>
      <Icon
        size={190}
        color={c.ink}
        strokeWidth={1.6}
        style={styles.verdictIcon}
      />
      <Chip ink style={styles.rotatedChip}>
        {meta.label}
      </Chip>
      <ThemedText style={styles.verdictText}>{message}</ThemedText>
    </View>
  );
}

function HazardStripe({ extreme }: { extreme?: boolean }) {
  const c = useWheelyColors();
  const patternId = useId();
  const stripe = extreme ? c.error : c.warning;
  return (
    <View style={{ height: 10, borderBottomWidth: 2, borderColor: c.ink, overflow: 'hidden' }}>
      <Svg width="100%" height={10}>
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={20}
            height={20}
            patternTransform="rotate(-45)">
            <Rect width={10} height={20} fill={stripe} />
            <Rect x={10} width={10} height={20} fill={c.ink} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={10} fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

function AlertCard({ alert, defaultOpen }: { alert: WeatherAlert; defaultOpen: boolean }) {
  const { c, styles } = useWheely();
  const [open, setOpen] = useState(defaultOpen);
  const extreme = alert.severity === 'extreme';
  const isNws = alert.type === 'nws';
  const Icon = alert.icon === 'thermometer' ? Thermometer : AlertTriangle;
  const hasDetails = isNws && (!!alert.instruction || !!alert.expires);

  return (
    <BrutalCard small style={styles.alertCard}>
      <HazardStripe extreme={extreme} />
      <Pressable
        disabled={!hasDetails}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole={hasDetails ? 'button' : undefined}
        accessibilityState={hasDetails ? { expanded: open } : undefined}
        style={[styles.alertBody, extreme && styles.alertExtremeBody]}>
        <Icon size={20} color={c.ink} strokeWidth={2} />
        <View style={styles.alertTextWrap}>
          <ThemedText style={styles.alertTitle}>{alert.event || alert.message}</ThemedText>
          {!!alert.headline && alert.headline !== alert.event && (
            <ThemedText style={styles.muted} numberOfLines={open ? undefined : 2}>
              {alert.headline}
            </ThemedText>
          )}
        </View>
        {hasDetails && (
          <ChevronDown
            size={18}
            color={c.mutedInk}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        )}
      </Pressable>
      {hasDetails && open && (
        <View style={styles.alertContent}>
          {!!alert.instruction && <ThemedText style={styles.muted}>{alert.instruction}</ThemedText>}
          {!!alert.expires && (
            <ThemedText style={styles.muted}>Expires: {formatTime(alert.expires)}</ThemedText>
          )}
        </View>
      )}
    </BrutalCard>
  );
}

export function WeatherAlerts({ alerts = [] }: { alerts: WeatherAlert[] }) {
  const { styles } = useWheely();
  if (!alerts.length) return null;
  return (
    <View style={styles.alertStack} accessibilityLabel="Weather alerts">
      {alerts.map((alert, index) => (
        <AlertCard
          key={`${alert.type}-${alert.event || alert.message}-${index}`}
          alert={alert}
          defaultOpen={index === 0 && alert.severity === 'extreme'}
        />
      ))}
    </View>
  );
}

export function HourlyForecast({
  hourly = [],
  pastHourly = [],
}: {
  hourly: HourlyWeather[];
  pastHourly: HourlyWeather[];
}) {
  const [selected, setSelected] = useState<ChartHour | null>(null);
  const theme = useTheme();
  const { c, styles } = useWheely();
  const data = useMemo(() => {
    const past = (pastHourly ?? []).map((h) => ({ ...h, isPast: true }));
    const future = (hourly ?? []).slice(0, 24).map((h) => ({ ...h, isPast: false }));
    return [...past, ...future].map((d, i) => ({ ...d, idx: i })) as ChartHour[];
  }, [hourly, pastHourly]);
  const nowIdx = pastHourly?.length ?? 0;
  const width = Math.max(640, data.length * 44);
  const height = 176;
  const xFor = (idx: number) => 24 + idx * 44;
  const yFor = (condition: string) => {
    const score = { bad: 1, poor: 2, marginal: 3, fair: 4, good: 5 }[condition] ?? 3;
    return 146 - ((score - 1) / 4) * 112;
  };
  const points = data.map((d) => `${xFor(d.idx)},${yFor(d.condition)}`).join(' ');

  if (!hourly.length) {
    return (
      <BrutalCard style={styles.emptyCard}>
        <ThemedText style={styles.alertTitle}>Hourly forecast unavailable.</ThemedText>
        <ThemedText style={styles.muted}>Try refreshing the forecast.</ThemedText>
      </BrutalCard>
    );
  }

  return (
    <BrutalCard style={styles.hourlyCard}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        accessibilityRole="adjustable"
        accessibilityLabel="Hourly ride-condition chart. Tap a point for details."
        contentOffset={{ x: Math.max(0, nowIdx * 44 - 140), y: 0 }}>
        <View style={[styles.hourChart, { width, height }]}>
          <Svg width={width} height={height} style={styles.hourChartSvg}>
            {[0, 1, 2, 3].map((line) => (
              <Line
                key={line}
                x1={12}
                x2={width - 12}
                y1={34 + line * 32}
                y2={34 + line * 32}
                stroke={theme.backgroundSelected}
                strokeDasharray="3 5"
                strokeWidth={1}
              />
            ))}
            {nowIdx > 0 && <Line x1={xFor(nowIdx)} x2={xFor(nowIdx)} y1={20} y2={146} stroke={c.ink} strokeDasharray="2 3" />}
            <Polyline points={points} fill="none" stroke={c.ink} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.18} />
            <Polyline points={points} fill="none" stroke={c.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d) => {
              const x = xFor(d.idx);
              const y = yFor(d.condition);
              const color = c.condition[d.condition as keyof WheelyPalette['condition']]?.bg ?? c.ink;
              const isNow = d.idx === nowIdx;
              return (
                <Circle
                  key={d.idx}
                  cx={x}
                  cy={y}
                  r={isNow ? 7 : 5}
                  fill={color}
                  stroke={c.paper}
                  strokeWidth={2}
                  opacity={d.isPast && !isNow ? 0.58 : 1}
                />
              );
            })}
            {data.map((d) => {
              if (d.idx !== nowIdx && d.idx % 3 !== 0 && d.idx !== data.length - 1) return null;
              return (
                <SvgText
                  key={`label-${d.idx}`}
                  x={xFor(d.idx)}
                  y={166}
                  fontSize={10}
                  fontWeight={d.idx === nowIdx ? '800' : '600'}
                  textAnchor="middle"
                  fill={c.ink}>
                  {d.idx === nowIdx ? 'Now' : hourLabel(d.hour)}
                </SvgText>
              );
            })}
          </Svg>
          <View style={styles.hourTouchLayer}>
            {data.map((d) => {
              const x = xFor(d.idx);
              const y = yFor(d.condition);
              const selectedPoint = selected?.idx === d.idx;
              return (
                <Pressable
                  key={`hit-${d.idx}`}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.idx === nowIdx ? 'Now' : fullHourLabel(d.hour)}: ${CONDITION_DISPLAY[asCondition(d.condition)]}`}
                  accessibilityState={{ selected: selectedPoint }}
                  hitSlop={6}
                  style={[
                    styles.hourTouchTarget,
                    { left: x - 16, top: y - 16 },
                    selectedPoint && styles.hourTouchTargetSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={styles.hourLegend}>
        <Chip condition="good">Good ↑</Chip>
        <Chip condition="bad">Bad ↓</Chip>
      </View>
      <View style={styles.hourDetail}>
        {selected ? (
          <>
            <Chip condition={asCondition(selected.condition)}>
              {fullHourLabel(selected.hour)} · {CONDITION_DISPLAY[asCondition(selected.condition)]}
            </Chip>
            <ThemedText style={styles.muted}>
              Feels {Math.round(selected.feelsLike)}° · Rain {selected.rainChance}% · Wind {Math.round(selected.windSpeed)} mph · {getWeatherDescription(selected.weatherCode)}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.muted}>Tap an hour for details.</ThemedText>
        )}
      </View>
    </BrutalCard>
  );
}

export function KitGuide({ weather }: { weather: Weather }) {
  const [mode, setMode] = useState<'casual' | 'pro'>('casual');
  useEffect(() => {
    loadGearMode().then(setMode);
  }, []);
  const gear = getGearSuggestion(weather, mode);
  const select = (next: 'casual' | 'pro') => {
    setMode(next);
    saveGearMode(next).catch(() => {});
  };
  const { c, styles } = useWheely();
  return (
    <BrutalCard>
      <GearModeToggle mode={mode} onSelect={select} />
      {!!gear.headline && <ThemedText style={styles.bodyStrong}>{gear.headline}</ThemedText>}
      <View accessibilityLiveRegion="polite">
        {gear.items.map((item: GearTipItem, index: number) => {
          const Icon = GEAR_ICONS[item.icon] ?? Package;
          return (
            <View key={`${item.label}-${index}`} style={styles.kitRow}>
              <Icon size={20} color={c.mutedInk} strokeWidth={1.75} style={styles.kitIcon} />
              <View style={styles.flex}>
                <ThemedText style={styles.bodyStrong}>{item.label}</ThemedText>
                {!!item.qualifier && <ThemedText style={styles.muted}>{item.qualifier}</ThemedText>}
              </View>
            </View>
          );
        })}
      </View>
    </BrutalCard>
  );
}

function GearModeToggle({
  mode,
  onSelect,
}: {
  mode: 'casual' | 'pro';
  onSelect: (mode: 'casual' | 'pro') => void;
}) {
  const { styles } = useWheely();
  const options: { label: string; value: 'casual' | 'pro' }[] = [
    { label: 'Everyday', value: 'casual' },
    { label: 'Performance', value: 'pro' },
  ];

  return (
    <View accessibilityRole="tablist" style={styles.kitSegmentedControl}>
      {options.map((option, index) => {
        const selected = option.value === mode;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            style={({ pressed }) => [
              styles.kitSegment,
              index > 0 && styles.kitSegmentDivider,
              selected && styles.kitSegmentSelected,
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.kitSegmentText, selected && styles.kitSegmentTextSelected]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RideSpecs({ weather }: { weather: Weather }) {
  const { c, styles } = useWheely();
  const metrics: {
    Icon: LucideIcon;
    label: string;
    value: string;
    qualifier?: string | null;
    condition?: string;
    iconRotation?: number;
  }[] = [
    { Icon: Droplets, label: 'Rain Chance', value: `${weather.rainChance}%`, condition: evaluateCondition(weather.rainChance, 'rainChance') },
    { Icon: Thermometer, label: 'Feels Like', value: `${Math.round(weather.feelsLike)}°`, condition: evaluateCondition(weather.feelsLike, 'feelsLike') },
    {
      Icon: Wind,
      label: 'Wind',
      value: `${Math.round(weather.windSpeed)} mph`,
      qualifier: weather.windDirection != null ? `from ${getWindDirectionLabel(weather.windDirection)}` : null,
      condition: evaluateCondition(weather.windSpeed, 'windSpeed'),
      iconRotation: weather.windDirection != null ? getWindArrowRotation(weather.windDirection) ?? undefined : undefined,
    },
    {
      Icon: Gauge,
      label: 'Air Quality',
      value: weather.aqi != null ? `${weather.aqi}` : '—',
      qualifier: weather.aqi != null ? getAqiLabel(weather.aqi) : null,
      condition: weather.aqi != null ? evaluateCondition(weather.aqi, 'aqi') : undefined,
    },
    {
      Icon: Droplet,
      label: 'Dewpoint',
      value: weather.dewpoint != null ? `${Math.round(weather.dewpoint)}°` : '—',
      qualifier: weather.dewpoint != null ? getDewpointLabel(weather.dewpoint) : null,
      condition: weather.dewpoint != null ? evaluateCondition(weather.dewpoint, 'dewpoint') : undefined,
    },
    {
      Icon: Sun,
      label: 'UV Index',
      value: weather.uvIndex != null ? `${Math.round(weather.uvIndex)}` : '—',
      qualifier: weather.uvIndex != null ? getUvLabel(weather.uvIndex) : null,
      condition: getUvCondition(weather.uvIndex),
    },
    { Icon: Sunrise, label: 'Sunrise', value: weather.sunrise || '—' },
    { Icon: Sunset, label: 'Sunset', value: weather.sunset || '—' },
  ];
  return (
    <View style={styles.metricsGrid}>
      {metrics.map(({ Icon, label, value, qualifier, condition, iconRotation }) => (
        <BrutalCard key={label} small style={styles.metricCard}>
          <View style={styles.metricLabelRow}>
            <Icon
              size={16}
              color={c.mutedInk}
              strokeWidth={2}
              style={iconRotation != null ? { transform: [{ rotate: `${iconRotation}deg` }] } : undefined}
            />
            <ThemedText style={styles.metricLabel}>{label}</ThemedText>
          </View>
          <ThemedText style={styles.metricValue}>{value}</ThemedText>
          <View style={styles.metricFooter}>
            {!!qualifier && <ThemedText style={styles.muted}>{qualifier}</ThemedText>}
            {condition && ['marginal', 'poor', 'bad'].includes(condition) && (
              <Chip condition={asCondition(condition)}>
                {CONDITION_DISPLAY[asCondition(condition)]}
              </Chip>
            )}
          </View>
        </BrutalCard>
      ))}
    </View>
  );
}

export function DailyForecast({ daily = [] }: { daily: DailyWeather[] }) {
  const { c, styles } = useWheely();
  const { index: bestDayIdx, rationale } = getBestDayInfo(daily);
  const blurb = getBestDaysBlurb(daily, bestDayIdx, rationale);
  if (!daily.length) {
    return (
      <BrutalCard small>
        <ThemedText style={styles.muted}>The daily outlook is unavailable right now. Check back in a bit.</ThemedText>
      </BrutalCard>
    );
  }
  return (
    <View>
      <ThemedText style={styles.weekBlurb}>{blurb}</ThemedText>
      <BrutalCard style={styles.dailyList}>
        {daily.map((day, index) => {
          const best = index === bestDayIdx;
          const reason = getDayConditionReason(day);
          const DayIcon = weatherIconFor(day.weatherCode);
          return (
            <View key={`${day.date}-${index}`} style={styles.dayRow}>
              <View style={styles.dayLabelCell}>
                {best ? (
                  <Chip primary icon={Star}>
                    {dayLabel(day.date, index)}
                  </Chip>
                ) : (
                  <ThemedText style={styles.dayLabel}>{dayLabel(day.date, index)}</ThemedText>
                )}
              </View>
              <View style={styles.weatherGlyph}>
                <DayIcon size={18} color={c.mutedInk} strokeWidth={2} />
              </View>
              <ThemedText style={styles.dayTemp}>{day.high ?? '—'}°<ThemedText style={styles.dayLow}>/{day.low ?? '—'}°</ThemedText></ThemedText>
              <ThemedText style={styles.dayReason} numberOfLines={2}>{reason}</ThemedText>
              <Chip condition={asCondition(day.condition)}>
                {CONDITION_DISPLAY[asCondition(day.condition)]}
              </Chip>
            </View>
          );
        })}
      </BrutalCard>
    </View>
  );
}

export function ErrorState({ kind, onRetry }: { kind: 'network' | 'default'; onRetry: () => void }) {
  const { c, styles } = useWheely();
  const network = kind === 'network';
  const Icon = network ? CloudOff : AlertTriangle;
  return (
    <View style={styles.centerState}>
      <BrutalCard style={styles.centerCard}>
        <Icon size={42} color={c.ink} strokeWidth={2} style={styles.centerIcon} />
        <ThemedText style={styles.sectionHeading}>{network ? 'Forecast unavailable' : 'Something went sideways'}</ThemedText>
        <ThemedText style={styles.muted}>
          {network
            ? 'Check your connection and try again.'
            : 'The forecast could not be loaded right now.'}
        </ThemedText>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Refresh forecast"
          style={({ pressed }) => [styles.primaryButton, styles.buttonRow, pressed && styles.pressedButton]}>
          <RefreshCw size={14} color={c.ink} strokeWidth={2.5} />
          <ThemedText style={styles.primaryButtonText}>Refresh</ThemedText>
        </Pressable>
      </BrutalCard>
    </View>
  );
}

export function LoadingState() {
  const { c, styles } = useWheely();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={c.ink} />
      <ThemedText style={styles.statusMessage}>Loading forecast...</ThemedText>
    </View>
  );
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  brand: {
    fontFamily: Fonts?.display,
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: c.ink,
    ...(Platform.OS === 'web' ? ({ fontStretch: '116%', letterSpacing: -1 } as object) : null),
  },
  brandMark: {
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.ink,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: c.paper,
    borderWidth: 2,
    borderColor: c.ink,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    ...brutalShadow(c.ink, 3),
  },
  locationButtonText: {
    color: c.ink,
    fontWeight: '800',
    fontFamily: Fonts?.mono,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  statusMessage: {
    color: c.mutedInk,
    textAlign: 'center',
    fontSize: 13,
  },
  pressed: { opacity: 0.7 },
  pressedButton: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    ...brutalShadow(c.ink, 1),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  indexBadge: {
    backgroundColor: c.ink,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  indexText: {
    color: c.paper,
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeading: {
    color: c.ink,
    fontFamily: Fonts?.display,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontStretch: '112%' } as object) : null),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: c.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...brutalShadow(c.ink, 2),
    alignSelf: 'flex-start',
  },
  chipText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: c.paper,
    borderWidth: 2,
    borderColor: c.ink,
    padding: Spacing.three,
    ...brutalShadow(c.ink, 6),
    gap: Spacing.three,
  },
  cardSmall: {
    backgroundColor: c.paper,
    borderWidth: 2,
    borderColor: c.ink,
    padding: Spacing.three,
    ...brutalShadow(c.ink, 3),
  },
  verdict: {
    borderWidth: 2,
    borderColor: c.ink,
    padding: Spacing.four,
    minHeight: 190,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...brutalShadow(c.ink, 9),
  },
  verdictIcon: {
    position: 'absolute',
    right: -18,
    bottom: -54,
    opacity: 0.16,
  },
  rotatedChip: {
    transform: [{ rotate: '-2deg' }],
    marginBottom: Spacing.three,
  },
  verdictText: {
    color: c.ink,
    fontFamily: Fonts?.display,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '800',
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontStretch: '112%' } as object) : null),
  },
  alertStack: { gap: Spacing.three },
  alertCard: { padding: 0 },
  alertBody: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  alertExtremeBody: { backgroundColor: 'rgba(255,100,44,0.16)' },
  alertContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  alertTextWrap: { flex: 1, gap: Spacing.one },
  alertTitle: { color: c.ink, fontWeight: '900', fontSize: 16 },
  muted: {
    color: c.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  hourlyCard: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  hourLegend: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  hourChart: {
    position: 'relative',
  },
  hourChartSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hourTouchLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hourTouchTarget: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  hourTouchTargetSelected: {
    borderWidth: 2,
    borderColor: c.ink,
  },
  hourDetail: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  emptyCard: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kitSegmentedControl: {
    marginBottom: Spacing.two,
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: c.ink,
    backgroundColor: c.paper,
    overflow: 'hidden',
  },
  kitSegment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  kitSegmentDivider: {
    borderLeftWidth: 2,
    borderLeftColor: c.ink,
  },
  kitSegmentSelected: {
    backgroundColor: c.ink,
  },
  kitSegmentText: {
    color: c.mutedInk,
    fontFamily: Fonts?.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  kitSegmentTextSelected: {
    color: c.paper,
  },
  bodyStrong: {
    color: c.ink,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
  },
  kitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderColor: c.border,
  },
  kitIcon: {
    width: 28,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  metricCard: {
    width: Platform.OS === 'web' ? '23%' : '47%',
    minWidth: Platform.OS === 'web' ? 150 : undefined,
    gap: Spacing.two,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  metricLabel: {
    color: c.mutedInk,
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: c.ink,
    fontFamily: Fonts?.display,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  metricFooter: {
    gap: Spacing.two,
    minHeight: 28,
  },
  weekBlurb: {
    color: c.mutedInk,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  dailyList: { padding: 0, gap: 0 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderColor: c.border,
  },
  dayLabelCell: { width: 84 },
  dayLabel: {
    color: c.ink,
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  weatherGlyph: { width: 22, alignItems: 'center' },
  dayTemp: {
    color: c.ink,
    width: 66,
    fontSize: 20,
    fontWeight: '900',
  },
  dayLow: { color: c.mutedInk, fontSize: 13 },
  dayReason: {
    flex: 1,
    color: c.mutedInk,
    fontSize: 12,
    lineHeight: 16,
  },
  centerState: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: c.background,
  },
  centerCard: {
    maxWidth: MaxContentWidth,
    alignItems: 'center',
  },
  centerIcon: {
    marginBottom: Spacing.two,
  },
  primaryButton: {
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.ink,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    ...brutalShadow(c.ink, 3),
  },
  primaryButtonText: {
    color: c.ink,
    fontFamily: Fonts?.mono,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: c.ink,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryButtonText: {
    color: c.ink,
    fontFamily: Fonts?.mono,
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  });
}

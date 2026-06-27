import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY, getWeatherDescription } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import { chartX, chartY, chartSmoothPath } from '@/utils/hourlyChart';
import { hourLabel, fullHourLabel } from '@/utils/timeFormat';
import type { HourlyWeather } from '@/types/weather';
import { BrutalCard, Chip, asCondition } from './primitives';

type ChartHour = HourlyWeather & { isPast: boolean; idx: number };

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    hourlyCard: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
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
    alertTitle: { color: c.ink, fontWeight: '400', fontSize: 16 },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function HourlyChartGraphic({
  data,
  nowIdx,
  width,
  height,
  smoothPath,
}: Readonly<{
  data: ChartHour[];
  nowIdx: number;
  width: number;
  height: number;
  smoothPath: string;
}>) {
  const { c, styles } = useStyles();
  const firstIdx = data[0]?.idx ?? 0;
  const lastIdx = data.at(-1)?.idx ?? 0;
  const gradTotal = chartX(lastIdx) - chartX(firstIdx);

  return (
    <Svg width={width} height={height} style={styles.hourChartSvg}>
      {[0, 1, 2, 3].map((line) => (
        <Line
          key={line}
          x1={12}
          x2={width - 12}
          y1={34 + line * 32}
          y2={34 + line * 32}
          stroke={c.border}
          strokeDasharray="3 5"
          strokeWidth={1}
        />
      ))}
      {nowIdx > 0 && (
        <Line
          x1={chartX(nowIdx)}
          x2={chartX(nowIdx)}
          y1={20}
          y2={146}
          stroke={c.ink}
          strokeDasharray="2 3"
        />
      )}
      <Defs>
        <LinearGradient
          id="condGrad"
          x1={chartX(firstIdx)}
          y1="0"
          x2={chartX(lastIdx)}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          {data.map((d) => {
            const pct = gradTotal > 0 ? (chartX(d.idx) - chartX(firstIdx)) / gradTotal : 0;
            return <Stop key={d.idx} offset={pct} stopColor={c.condition[d.condition].bg} />;
          })}
        </LinearGradient>
      </Defs>
      <Path
        d={smoothPath}
        fill="none"
        stroke="url(#condGrad)"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d) => {
        const isNow = d.idx === nowIdx;
        return (
          <Circle
            key={d.idx}
            cx={chartX(d.idx)}
            cy={chartY(d.condition)}
            r={isNow ? 7 : 5}
            fill={c.condition[d.condition].bg}
            stroke={c.paper}
            strokeWidth={2}
            opacity={d.isPast && !isNow ? 0.58 : 1}
          />
        );
      })}
      {/* react-native-svg tags Text x/y as deprecated transform shorthands, but on
          <Text> they are the standard way to position text. */}
      {/* eslint-disable @typescript-eslint/no-deprecated */}
      {data.map((d) => {
        if (d.idx !== nowIdx && d.idx % 3 !== 0 && d.idx !== data.length - 1) return null;
        return (
          <SvgText
            key={`label-${d.idx}`}
            x={chartX(d.idx)}
            y={166}
            fontSize={10}
            fontWeight="400"
            textAnchor="middle"
            fill={c.ink}
          >
            {d.idx === nowIdx ? 'Now' : hourLabel(d.hour)}
          </SvgText>
        );
      })}
      {/* eslint-enable @typescript-eslint/no-deprecated */}
    </Svg>
  );
}

export function HourlyForecast({
  hourly,
  pastHourly,
}: Readonly<{
  hourly: HourlyWeather[];
  pastHourly: HourlyWeather[];
}>) {
  const [selected, setSelected] = useState<ChartHour | null>(null);
  const { styles } = useStyles();

  const data = useMemo(() => {
    const past = pastHourly.map((h) => ({ ...h, isPast: true }));
    const future = hourly.slice(0, 24).map((h) => ({ ...h, isPast: false }));
    return [...past, ...future].map((d, i) => ({ ...d, idx: i }));
  }, [hourly, pastHourly]);

  const nowIdx = pastHourly.length;
  const width = Math.max(640, data.length * 44);
  const height = 176;
  const smoothPath = useMemo(() => chartSmoothPath(data), [data]);

  if (hourly.length === 0) {
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
        contentOffset={{ x: Math.max(0, nowIdx * 44 - 140), y: 0 }}
      >
        <View style={[styles.hourChart, { width, height }]}>
          <HourlyChartGraphic
            data={data}
            nowIdx={nowIdx}
            width={width}
            height={height}
            smoothPath={smoothPath}
          />
          <View style={styles.hourTouchLayer}>
            {data.map((d) => {
              const x = chartX(d.idx);
              const y = chartY(d.condition);
              const isSelected = selected?.idx === d.idx;
              return (
                <Pressable
                  key={`hit-${d.idx}`}
                  onPress={() => {
                    setSelected(d);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.idx === nowIdx ? 'Now' : fullHourLabel(d.hour)}: ${CONDITION_DISPLAY[asCondition(d.condition)]}`}
                  accessibilityState={{ selected: isSelected }}
                  hitSlop={6}
                  style={[
                    styles.hourTouchTarget,
                    { left: x - 16, top: y - 16 },
                    isSelected && styles.hourTouchTargetSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.hourDetail}>
        {selected ? (
          <>
            <Chip condition={asCondition(selected.condition)}>
              {fullHourLabel(selected.hour)} · {CONDITION_DISPLAY[asCondition(selected.condition)]}
            </Chip>
            <ThemedText style={styles.muted}>
              Feels {Math.round(selected.feelsLike)}° · Rain {selected.rainChance}% · Wind{' '}
              {Math.round(selected.windSpeed)} mph · {getWeatherDescription(selected.weatherCode)}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.muted}>Tap an hour for details.</ThemedText>
        )}
      </View>
    </BrutalCard>
  );
}

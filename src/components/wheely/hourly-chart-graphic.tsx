import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { useWheelyColors } from '@/hooks/use-theme';
import { type WheelyPalette } from '@/constants/theme';
import {
  DOT_RADIUS_MAX,
  chartCenterXFromClampedScroll,
  chartCenterXFromScroll,
  chartClampScrollOffset,
  chartNearestSnapOffset,
  chartScrollBlendAtCenter,
  chartSmoothYAtSegments,
  chartX,
  chartY,
  type ChartSplineSegment,
} from '@/utils/hourlyChart';
import { hourLabel } from '@/utils/timeFormat';

import { HourlyChartDot } from './hourly-chart-dot';
import { asCondition } from './primitives';
import type { ChartHour } from './use-hourly-forecast-chart';

export const CHART_HEIGHT = 176;
const SELECTION_RING_SIZE = 32;
export const SELECTION_RING_RADIUS = SELECTION_RING_SIZE / 2;
// The marker's filled dot plays the "enlarged dot at center" role the
// per-dot swell animation used to.
const SELECTION_DOT_SIZE = DOT_RADIUS_MAX * 2;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    hourChartSvg: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    selectionRing: {
      position: 'absolute',
      left: '50%',
      marginLeft: -SELECTION_RING_RADIUS,
      width: SELECTION_RING_SIZE,
      height: SELECTION_RING_SIZE,
      borderRadius: SELECTION_RING_RADIUS,
      borderWidth: 2,
      borderColor: c.ink,
      zIndex: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectionDot: {
      width: SELECTION_DOT_SIZE,
      height: SELECTION_DOT_SIZE,
      borderRadius: SELECTION_DOT_SIZE / 2,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

/**
 * The static SVG chart: gridlines, gradient spline, dots, and hour labels.
 * Deliberately free of scroll/selection props so its subtree never re-renders
 * while the user scrubs — all motion lives in the SelectionMarker overlay.
 */
export function HourlyChartGraphic({
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
      {(['good', 'fair', 'marginal', 'poor', 'bad'] as const).map((condition) => (
        <Line
          key={condition}
          x1={12}
          x2={width - 12}
          y1={chartY(condition)}
          y2={chartY(condition)}
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
      {data.map((d) => (
        <HourlyChartDot
          key={d.idx}
          idx={d.idx}
          condition={d.condition}
          isNow={d.idx === nowIdx}
          isPast={d.isPast}
          fill={c.condition[d.condition].bg}
          stroke={c.paper}
        />
      ))}
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

/** Marker fill blended between the hours adjacent to the viewport center. Worklet-safe. */
function markerFillAtCenter(
  centerX: number,
  bgColors: readonly string[],
  fallback: string,
): string {
  'worklet';
  if (bgColors.length === 0) return fallback;
  const { i, t } = chartScrollBlendAtCenter(centerX, bgColors.length);
  const fromBg = bgColors[i] ?? fallback;
  const toBg = bgColors[i + 1] ?? fromBg;
  return interpolateColor(t, [0, 1], [fromBg, toBg]);
}

function SelectionMarkerAnimated({
  segments,
  scrollX,
  viewportWidth,
  initialScrollX,
  selectedCondition,
  bgColors,
}: Readonly<{
  segments: ChartSplineSegment[];
  scrollX: SharedValue<number>;
  viewportWidth: number;
  initialScrollX: number;
  selectedCondition: string;
  bgColors: readonly string[];
}>) {
  const { c, styles } = useStyles();
  const reduceMotion = useReducedMotion();
  const discreteTop = chartY(selectedCondition) - SELECTION_RING_RADIUS;
  const discreteFill = c.condition[asCondition(selectedCondition)].bg;

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion || viewportWidth <= 0) {
      return { top: discreteTop };
    }
    const offsetX = scrollX.value < 0 ? initialScrollX : scrollX.value;
    const centerX = chartCenterXFromScroll(offsetX, viewportWidth);
    const y = chartSmoothYAtSegments(segments, centerX);
    return { top: y - SELECTION_RING_RADIUS };
  }, [segments, viewportWidth, initialScrollX, reduceMotion, discreteTop]);

  const dotStyle = useAnimatedStyle(() => {
    if (reduceMotion || viewportWidth <= 0) {
      return { backgroundColor: discreteFill };
    }
    const offsetX = scrollX.value < 0 ? initialScrollX : scrollX.value;
    const centerX = chartCenterXFromScroll(offsetX, viewportWidth);
    return { backgroundColor: markerFillAtCenter(centerX, bgColors, discreteFill) };
  }, [bgColors, viewportWidth, initialScrollX, reduceMotion, discreteFill]);

  return (
    <Animated.View style={[styles.selectionRing, animatedStyle, { pointerEvents: 'none' }]}>
      <Animated.View style={[styles.selectionDot, dotStyle]} />
    </Animated.View>
  );
}

export function SelectionMarker({
  segments,
  scrollX,
  liveScrollX,
  isScrollIdle,
  snapOffsets,
  viewportWidth,
  maxIndex,
  initialScrollX,
  selectedCondition,
  bgColors,
}: Readonly<{
  segments: ChartSplineSegment[];
  scrollX: SharedValue<number>;
  liveScrollX: number;
  isScrollIdle: boolean;
  snapOffsets: number[];
  viewportWidth: number;
  maxIndex: number;
  initialScrollX: number;
  selectedCondition: string;
  bgColors: readonly string[];
}>) {
  const { c, styles } = useStyles();
  const reduceMotion = useReducedMotion();

  if (Platform.OS === 'web' && !reduceMotion && viewportWidth > 0 && liveScrollX >= 0) {
    const clamped = chartClampScrollOffset(liveScrollX, viewportWidth, maxIndex);
    const scrollForRing =
      isScrollIdle && snapOffsets.length > 0
        ? chartNearestSnapOffset(clamped, snapOffsets)
        : clamped;
    const centerX = chartCenterXFromClampedScroll(scrollForRing, viewportWidth, maxIndex);
    const y = chartSmoothYAtSegments(segments, centerX);
    const fill = markerFillAtCenter(centerX, bgColors, c.condition[asCondition(selectedCondition)].bg);
    return (
      <View
        style={[styles.selectionRing, { top: y - SELECTION_RING_RADIUS, pointerEvents: 'none' }]}
      >
        <View style={[styles.selectionDot, { backgroundColor: fill }]} />
      </View>
    );
  }

  return (
    <SelectionMarkerAnimated
      segments={segments}
      scrollX={scrollX}
      viewportWidth={viewportWidth}
      initialScrollX={initialScrollX}
      selectedCondition={selectedCondition}
      bgColors={bgColors}
    />
  );
}

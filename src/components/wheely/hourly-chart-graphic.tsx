import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, type WheelyPalette } from '@/constants/theme';
import {
  chartCenterXFromClampedScroll,
  chartCenterXFromScroll,
  chartClampScrollOffset,
  chartDotRadius,
  chartDotRadiusAtCenter,
  chartNearestSnapOffset,
  chartSmoothYAtSegments,
  chartX,
  chartY,
  type ChartSplineSegment,
} from '@/utils/hourlyChart';
import { hourLabel } from '@/utils/timeFormat';

import { HourlyChartDot } from './hourly-chart-dot';
import type { ChartHour } from './use-hourly-forecast-chart';

export const CHART_HEIGHT = 140;
const SELECTION_RING_SIZE = 32;
export const SELECTION_RING_RADIUS = SELECTION_RING_SIZE / 2;

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
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function webDotCenterX({
  liveScrollX,
  isScrollIdle,
  snapOffsets,
  viewportWidth,
  maxIndex,
}: Readonly<{
  liveScrollX: number;
  isScrollIdle: boolean;
  snapOffsets: number[];
  viewportWidth: number;
  maxIndex: number;
}>): number | null {
  if (Platform.OS !== 'web' || viewportWidth <= 0 || liveScrollX < 0) return null;
  const clamped = chartClampScrollOffset(liveScrollX, viewportWidth, maxIndex);
  const snapTarget =
    isScrollIdle && snapOffsets.length > 0 ? chartNearestSnapOffset(clamped, snapOffsets) : clamped;
  return chartCenterXFromClampedScroll(snapTarget, viewportWidth, maxIndex);
}

function dotRadiusForRender(
  idx: number,
  isNow: boolean,
  centerX: number | null,
  count: number,
): number {
  if (centerX == null) return chartDotRadius(isNow);
  return chartDotRadiusAtCenter(idx, isNow, centerX, count);
}

function hourLabelNode(d: ChartHour, nowIdx: number, count: number, labelColor: string) {
  if (d.idx !== nowIdx && d.idx % 3 !== 0 && d.idx !== count - 1) return null;
  /* eslint-disable @typescript-eslint/no-deprecated */
  return (
    <SvgText
      key={`label-${d.idx}`}
      x={chartX(d.idx)}
      y={132}
      fontFamily={Fonts.body}
      fontSize={11}
      fontWeight="400"
      textAnchor="middle"
      fill={labelColor}
    >
      {d.idx === nowIdx ? 'Now' : hourLabel(d.hour)}
    </SvgText>
  );
  /* eslint-enable @typescript-eslint/no-deprecated */
}

/**
 * SVG chart with gridlines, gradient spline, dots, and hour labels.
 * Dot radius responds to the selected hour (web via JS scroll state, native
 * via shared-value animated props inside HourlyChartDot).
 */
export function HourlyChartGraphic({
  data,
  nowIdx,
  width,
  height,
  smoothPath,
  scrollX,
  liveScrollX,
  isScrollIdle,
  snapOffsets,
  viewportWidth,
  maxIndex,
  initialScrollX,
}: Readonly<{
  data: ChartHour[];
  nowIdx: number;
  width: number;
  height: number;
  smoothPath: string;
  scrollX: SharedValue<number>;
  liveScrollX: number;
  isScrollIdle: boolean;
  snapOffsets: number[];
  viewportWidth: number;
  maxIndex: number;
  initialScrollX: number;
}>) {
  const { c, styles } = useStyles();
  const firstIdx = data[0]?.idx ?? 0;
  const lastIdx = data.at(-1)?.idx ?? 0;
  const gradTotal = chartX(lastIdx) - chartX(firstIdx);
  const webCenterX = webDotCenterX({
    liveScrollX,
    isScrollIdle,
    snapOffsets,
    viewportWidth,
    maxIndex,
  });

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
          y1={14}
          y2={112}
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
          radius={dotRadiusForRender(d.idx, d.idx === nowIdx, webCenterX, data.length)}
          scrollX={scrollX}
          viewportWidth={viewportWidth}
          initialScrollX={initialScrollX}
          maxIndex={maxIndex}
          count={data.length}
        />
      ))}
      {data.map((d) => hourLabelNode(d, nowIdx, data.length, c.ink))}
    </Svg>
  );
}

function SelectionMarkerAnimated({
  segments,
  scrollX,
  viewportWidth,
  initialScrollX,
  selectedCondition,
}: Readonly<{
  segments: ChartSplineSegment[];
  scrollX: SharedValue<number>;
  viewportWidth: number;
  initialScrollX: number;
  selectedCondition: string;
}>) {
  const { styles } = useStyles();
  const reduceMotion = useReducedMotion();
  const discreteTop = chartY(selectedCondition) - SELECTION_RING_RADIUS;

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion || viewportWidth <= 0) {
      return { top: discreteTop };
    }
    const offsetX = scrollX.value < 0 ? initialScrollX : scrollX.value;
    const centerX = chartCenterXFromScroll(offsetX, viewportWidth);
    const y = chartSmoothYAtSegments(segments, centerX);
    return { top: y - SELECTION_RING_RADIUS };
  }, [segments, viewportWidth, initialScrollX, reduceMotion, discreteTop]);

  return <Animated.View style={[styles.selectionRing, animatedStyle, { pointerEvents: 'none' }]} />;
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
}>) {
  const { styles } = useStyles();
  const reduceMotion = useReducedMotion();

  if (Platform.OS === 'web' && !reduceMotion && viewportWidth > 0 && liveScrollX >= 0) {
    const clamped = chartClampScrollOffset(liveScrollX, viewportWidth, maxIndex);
    const scrollForRing =
      isScrollIdle && snapOffsets.length > 0
        ? chartNearestSnapOffset(clamped, snapOffsets)
        : clamped;
    const centerX = chartCenterXFromClampedScroll(scrollForRing, viewportWidth, maxIndex);
    const y = chartSmoothYAtSegments(segments, centerX);
    return (
      <View
        style={[styles.selectionRing, { top: y - SELECTION_RING_RADIUS, pointerEvents: 'none' }]}
      />
    );
  }

  return (
    <SelectionMarkerAnimated
      segments={segments}
      scrollX={scrollX}
      viewportWidth={viewportWidth}
      initialScrollX={initialScrollX}
      selectedCondition={selectedCondition}
    />
  );
}

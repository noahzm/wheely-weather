import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Sunrise, Umbrella } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
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
import { CONDITION_DISPLAY } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import {
  chartCenterXFromClampedScroll,
  chartCenterXFromScroll,
  chartClampScrollOffset,
  chartNearestSnapOffset,
  chartDiscreteDotOpacity,
  chartDiscreteDotRadius,
  chartDotOpacityAtDistance,
  chartDotRadiusForIndex,
  chartSmoothYAtSegments,
  chartX,
  chartY,
  type ChartSplineSegment,
} from '@/utils/hourlyChart';
import { hourLabel } from '@/utils/timeFormat';
import type { HourlyWeather } from '@/types/weather';
import {
  AnimatedConditionChip,
  ConditionChipWidthProbe,
  type ChipLayoutSize,
} from './animated-condition-chip';
import { AnimatedExpand } from './animated-expand';
import { BrutalCard, asCondition } from './primitives';
import { useHourlyForecastChart } from './use-hourly-forecast-chart';

const CHART_HEIGHT = 176;
const SELECTION_RING_SIZE = 32;
const SELECTION_RING_RADIUS = SELECTION_RING_SIZE / 2;
const NOTE_STICKER_ROTATE = '4deg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ChartHour = HourlyWeather & { isPast: boolean; idx: number };

function HourlyChartDotWeb({
  idx,
  condition,
  isNow,
  isPast,
  fill,
  stroke,
  liveScrollX,
  viewportWidth,
  maxIndex,
}: Readonly<{
  idx: number;
  condition: string;
  isNow: boolean;
  isPast: boolean;
  fill: string;
  stroke: string;
  liveScrollX: number;
  viewportWidth: number;
  maxIndex: number;
}>) {
  const centerX = chartCenterXFromClampedScroll(liveScrollX, viewportWidth, maxIndex);
  const distance = chartX(idx) - centerX;
  return (
    <Circle
      cx={chartX(idx)}
      cy={chartY(condition)}
      r={chartDotRadiusForIndex(idx, centerX, isNow)}
      opacity={chartDotOpacityAtDistance(distance, isPast, isNow)}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

function HourlyChartDotAnimated({
  idx,
  condition,
  isNow,
  isPast,
  fill,
  stroke,
  scrollX,
  viewportWidth,
  initialScrollX,
  selectedIdx,
}: Readonly<{
  idx: number;
  condition: string;
  isNow: boolean;
  isPast: boolean;
  fill: string;
  stroke: string;
  scrollX: SharedValue<number>;
  viewportWidth: number;
  initialScrollX: number;
  selectedIdx: number;
}>) {
  const reduceMotion = useReducedMotion();
  const isSelected = idx === selectedIdx;

  const animatedProps = useAnimatedProps(() => {
    if (reduceMotion || viewportWidth <= 0) {
      return {
        r: chartDiscreteDotRadius(isSelected, isNow),
        opacity: chartDiscreteDotOpacity(isPast, isNow, isSelected),
      };
    }
    const offsetX = scrollX.value < 0 ? initialScrollX : scrollX.value;
    const centerX = chartCenterXFromScroll(offsetX, viewportWidth);
    const distance = chartX(idx) - centerX;
    return {
      r: chartDotRadiusForIndex(idx, centerX, isNow),
      opacity: chartDotOpacityAtDistance(distance, isPast, isNow),
    };
  }, [idx, isNow, isPast, viewportWidth, initialScrollX, reduceMotion, isSelected]);

  return (
    <AnimatedCircle
      cx={chartX(idx)}
      cy={chartY(condition)}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
      animatedProps={animatedProps}
    />
  );
}

function HourlyChartDot({
  idx,
  condition,
  isNow,
  isPast,
  fill,
  stroke,
  scrollX,
  liveScrollX,
  viewportWidth,
  maxIndex,
  initialScrollX,
  selectedIdx,
}: Readonly<{
  idx: number;
  condition: string;
  isNow: boolean;
  isPast: boolean;
  fill: string;
  stroke: string;
  scrollX: SharedValue<number>;
  liveScrollX: number;
  viewportWidth: number;
  maxIndex: number;
  initialScrollX: number;
  selectedIdx: number;
}>) {
  const reduceMotion = useReducedMotion();

  if (Platform.OS === 'web' && !reduceMotion && viewportWidth > 0 && liveScrollX >= 0) {
    return (
      <HourlyChartDotWeb
        idx={idx}
        condition={condition}
        isNow={isNow}
        isPast={isPast}
        fill={fill}
        stroke={stroke}
        liveScrollX={liveScrollX}
        viewportWidth={viewportWidth}
        maxIndex={maxIndex}
      />
    );
  }

  return (
    <HourlyChartDotAnimated
      idx={idx}
      condition={condition}
      isNow={isNow}
      isPast={isPast}
      fill={fill}
      stroke={stroke}
      scrollX={scrollX}
      viewportWidth={viewportWidth}
      initialScrollX={initialScrollX}
      selectedIdx={selectedIdx}
    />
  );
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    hourlyCard: {
      position: 'relative',
      overflow: 'visible',
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.two,
    },
    hourlyBody: {
      position: 'relative',
      overflow: 'visible',
    },
    chartShell: {
      position: 'relative',
      overflow: 'visible',
    },
    conditionSticker: {
      position: 'absolute',
      left: -8,
      bottom: -18,
      zIndex: 2,
    },
    noteStickers: {
      position: 'absolute',
      right: -8,
      top: -14,
      zIndex: 4,
      alignItems: 'flex-end',
      gap: Spacing.one,
    },
    noteSticker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      borderWidth: 2,
      borderColor: c.shadow,
      backgroundColor: c.paper,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      transform: [{ rotate: NOTE_STICKER_ROTATE }],
    },
    noteStickerText: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 12,
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
    },
    hourReasonPanel: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.one,
    },
    hourChart: {
      position: 'relative',
    },
    webChartScroll: {
      overscrollBehaviorX: 'none',
    },
    scrollContent: {
      flexDirection: 'row',
    },
    hourChartSvg: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    hourReason: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'right',
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
  selectedIdx,
  width,
  height,
  smoothPath,
  scrollX,
  liveScrollX,
  viewportWidth,
  maxIndex,
  initialScrollX,
}: Readonly<{
  data: ChartHour[];
  nowIdx: number;
  selectedIdx: number;
  width: number;
  height: number;
  smoothPath: string;
  scrollX: SharedValue<number>;
  liveScrollX: number;
  viewportWidth: number;
  maxIndex: number;
  initialScrollX: number;
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
      {data.map((d) => {
        const isNow = d.idx === nowIdx;
        return (
          <HourlyChartDot
            key={d.idx}
            idx={d.idx}
            condition={d.condition}
            isNow={isNow}
            isPast={d.isPast}
            fill={c.condition[d.condition].bg}
            stroke={c.paper}
            scrollX={scrollX}
            liveScrollX={liveScrollX}
            viewportWidth={viewportWidth}
            maxIndex={maxIndex}
            initialScrollX={initialScrollX}
            selectedIdx={selectedIdx}
          />
        );
      })}
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

function SelectionRingAnimated({
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

function SelectionRing({
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
    <SelectionRingAnimated
      segments={segments}
      scrollX={scrollX}
      viewportWidth={viewportWidth}
      initialScrollX={initialScrollX}
      selectedCondition={selectedCondition}
    />
  );
}

function HourlyNoteSticker({ icon, text }: Readonly<{ icon: SFSymbol; text: string }>) {
  const { c, styles } = useStyles();
  const FallbackIcon = icon === 'umbrella.fill' ? Umbrella : Sunrise;

  return (
    <View style={styles.noteSticker} accessibilityRole="text" accessibilityLabel={text}>
      {Platform.OS === 'ios' ? (
        <SymbolView name={icon} size={13} tintColor={c.ink} />
      ) : (
        <FallbackIcon size={13} color={c.ink} strokeWidth={2.5} />
      )}
      <ThemedText style={styles.noteStickerText}>{text}</ThemedText>
    </View>
  );
}

function HourlyNoteStickers({
  rainTiming,
  daylightWarning,
}: Readonly<{
  rainTiming?: string | null;
  daylightWarning?: string | null;
}>) {
  const { styles } = useStyles();
  if (!rainTiming && !daylightWarning) return null;

  return (
    <View style={[styles.noteStickers, { pointerEvents: 'none' }]}>
      {!!rainTiming && <HourlyNoteSticker icon="umbrella.fill" text={rainTiming} />}
      {!!daylightWarning && <HourlyNoteSticker icon="sunrise.fill" text={daylightWarning} />}
    </View>
  );
}

function HourlyReasonFooter({
  reasonOpen,
  selectedReason,
  reasonOpenProgress,
  condition,
  conditionLabel,
  chartScroll,
}: Readonly<{
  reasonOpen: boolean;
  selectedReason: string | null;
  reasonOpenProgress: SharedValue<number>;
  condition: string;
  conditionLabel: string;
  chartScroll: {
    scrollX: SharedValue<number>;
    liveScrollX: number;
    viewportWidth: number;
    initialScrollX: number;
    maxIndex: number;
    conditions: readonly string[];
    bgColors: readonly string[];
    inkColors: readonly string[];
    chipLayoutWidths: readonly number[];
    chipLayoutHeights: readonly number[];
  };
}>) {
  const { styles } = useStyles();

  const footerText = reasonOpen && selectedReason ? selectedReason : null;

  return (
    <>
      <AnimatedExpand openProgress={reasonOpenProgress} style={styles.hourReasonPanel}>
        {footerText && <ThemedText style={styles.hourReason}>{footerText}</ThemedText>}
      </AnimatedExpand>
      <View style={[styles.conditionSticker, { pointerEvents: 'none' }]}>
        <AnimatedConditionChip condition={asCondition(condition)} chartScroll={chartScroll} large>
          {conditionLabel}
        </AnimatedConditionChip>
      </View>
    </>
  );
}

function useHourlyChipScroll({
  data,
  c,
  scrollX,
  liveScrollX,
  viewportWidth,
  initialScrollX,
  maxIndex,
}: Readonly<{
  data: ChartHour[];
  c: ReturnType<typeof useWheelyColors>;
  scrollX: SharedValue<number>;
  liveScrollX: number;
  viewportWidth: number;
  initialScrollX: number;
  maxIndex: number;
}>) {
  const [chipLayouts, setChipLayouts] = useState<ChipLayoutSize[] | null>(null);
  const conditionLabels = useMemo(
    () => data.map((hour) => CONDITION_DISPLAY[asCondition(hour.condition)]),
    [data],
  );
  const handleChipLayouts = useCallback((layouts: ChipLayoutSize[]) => {
    setChipLayouts(layouts);
  }, []);

  const chartScroll = useMemo(() => {
    const conditions = data.map((hour) => hour.condition);
    const bgColors = data.map((hour) => c.condition[asCondition(hour.condition)].bg);
    const inkColors = data.map((hour) => c.condition[asCondition(hour.condition)].ink);
    return {
      scrollX,
      liveScrollX,
      viewportWidth,
      initialScrollX,
      maxIndex,
      conditions,
      bgColors,
      inkColors,
      chipLayoutWidths: chipLayouts?.map((layout) => layout.width) ?? [],
      chipLayoutHeights: chipLayouts?.map((layout) => layout.height) ?? [],
    };
  }, [c, chipLayouts, data, initialScrollX, liveScrollX, maxIndex, scrollX, viewportWidth]);

  return { conditionLabels, handleChipLayouts, chartScroll };
}

function HourlyForecastBody({
  data,
  nowIdx,
  rainTiming,
  daylightWarning,
}: Readonly<{
  data: ChartHour[];
  nowIdx: number;
  rainTiming?: string | null;
  daylightWarning?: string | null;
}>) {
  const { styles } = useStyles();
  const c = useWheelyColors();
  const chart = useHourlyForecastChart(data, nowIdx);
  const maxIndex = Math.max(0, data.length - 1);

  const { conditionLabels, handleChipLayouts, chartScroll } = useHourlyChipScroll({
    data,
    c,
    scrollX: chart.scrollX,
    liveScrollX: chart.liveScrollX,
    viewportWidth: chart.viewportWidth,
    initialScrollX: chart.initialScrollX,
    maxIndex,
  });

  return (
    <View style={styles.hourlyBody}>
      <HourlyNoteStickers rainTiming={rainTiming} daylightWarning={daylightWarning} />
      <ConditionChipWidthProbe labels={conditionLabels} onLayouts={handleChipLayouts} />
      <HourlyChartShell chart={chart} data={data} nowIdx={nowIdx} maxIndex={maxIndex} />
      <HourlyReasonFooter
        reasonOpen={chart.reasonOpen}
        selectedReason={chart.selectedReason}
        reasonOpenProgress={chart.reasonOpenProgress}
        condition={chart.selected.condition}
        conditionLabel={chart.conditionLabel}
        chartScroll={chartScroll}
      />
    </View>
  );
}

function HourlyChartShell({
  chart,
  data,
  nowIdx,
  maxIndex,
}: Readonly<{
  chart: ReturnType<typeof useHourlyForecastChart>;
  data: ChartHour[];
  nowIdx: number;
  maxIndex: number;
}>) {
  const { styles } = useStyles();
  const {
    scrollRef,
    scrollX,
    liveScrollX,
    isScrollIdle,
    selectedIdx,
    viewportWidth,
    contentPadding,
    snapOffsets,
    scrollHandler,
    onWebScroll,
    onViewportLayout,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    chartWidth,
    splineSegments,
    smoothPath,
    selected,
    hourLabelText,
    conditionLabel,
    initialScrollX,
  } = chart;
  const isWeb = Platform.OS === 'web';
  const snapToOffsets = isWeb || snapOffsets.length === 0 ? undefined : snapOffsets;

  return (
    <View
      style={styles.chartShell}
      onLayout={(event) => {
        onViewportLayout(event.nativeEvent.layout.width);
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        style={isWeb ? styles.webChartScroll : undefined}
        snapToOffsets={snapToOffsets}
        scrollEventThrottle={16}
        onScroll={onWebScroll ?? scrollHandler}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        accessibilityRole="adjustable"
        accessibilityLabel="Hourly ride-condition chart"
        accessibilityValue={{ text: `${hourLabelText}, ${conditionLabel}` }}
      >
        <View
          style={[
            styles.scrollContent,
            {
              width: chartWidth + 2 * contentPadding,
              height: CHART_HEIGHT,
            },
          ]}
        >
          <View style={{ width: contentPadding }} />
          <View style={[styles.hourChart, { width: chartWidth, height: CHART_HEIGHT }]}>
            <HourlyChartGraphic
              data={data}
              nowIdx={nowIdx}
              selectedIdx={selectedIdx}
              width={chartWidth}
              height={CHART_HEIGHT}
              smoothPath={smoothPath}
              scrollX={scrollX}
              liveScrollX={liveScrollX}
              viewportWidth={viewportWidth}
              maxIndex={maxIndex}
              initialScrollX={initialScrollX}
            />
          </View>
          <View style={{ width: contentPadding }} />
        </View>
      </Animated.ScrollView>
      <SelectionRing
        segments={splineSegments}
        scrollX={scrollX}
        liveScrollX={liveScrollX}
        isScrollIdle={isScrollIdle}
        snapOffsets={snapOffsets}
        viewportWidth={viewportWidth}
        maxIndex={maxIndex}
        initialScrollX={initialScrollX}
        selectedCondition={selected.condition}
      />
    </View>
  );
}

export function HourlyForecast({
  hourly,
  pastHourly,
  rainTiming,
  daylightWarning,
}: Readonly<{
  hourly: HourlyWeather[];
  pastHourly: HourlyWeather[];
  rainTiming?: string | null;
  daylightWarning?: string | null;
}>) {
  const { styles } = useStyles();
  const data = useMemo(() => {
    const past = pastHourly.map((h) => ({ ...h, isPast: true }));
    const future = hourly.slice(0, 24).map((h) => ({ ...h, isPast: false }));
    return [...past, ...future].map((d, i) => ({ ...d, idx: i }));
  }, [hourly, pastHourly]);

  const nowIdx = pastHourly.length;

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
      <HourlyForecastBody
        key={`${nowIdx}-${data.length}`}
        data={data}
        nowIdx={nowIdx}
        rainTiming={rainTiming}
        daylightWarning={daylightWarning}
      />
    </BrutalCard>
  );
}

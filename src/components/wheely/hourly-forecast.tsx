import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { CONDITION_DISPLAY } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import type { HourlyWeather } from '@/types/weather';
import {
  AnimatedConditionChip,
  ConditionChipWidthProbe,
  type ChipLayoutSize,
} from './animated-condition-chip';
import { AnimatedExpand } from './animated-expand';
import { BrutalCard, asCondition } from './primitives';
import { CHART_HEIGHT, HourlyChartGraphic, SelectionRing } from './hourly-chart-graphic';
import { HourlyNoteStickers } from './hourly-note-stickers';
import { useHourlyForecastChart, type ChartHour } from './use-hourly-forecast-chart';

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

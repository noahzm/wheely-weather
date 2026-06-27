import { useCallback, useRef } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useWheelyColors } from '@/hooks/use-theme';
import type { Condition } from '@/types/weather';
import {
  chartCenterXFromClampedScroll,
  chartCenterXFromScroll,
  chartInterpolateAtCenter,
  chartScrollBlendAtCenter,
} from '@/utils/hourlyChart';

import { BURST_CHIP_SIZES, BURST_PATH, BURST_VIEWBOX, burstChipStyles } from './primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(Text);

const STICKER_ROTATE = '-4deg';
const STICKER_SCALE = 1.28;

export type ChipLayoutSize = Readonly<{ width: number; height: number }>;

type ChartScrollProps = Readonly<{
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
}>;

function linkedChipAppearance(
  chartScroll: ChartScrollProps,
  fallbackBg: string,
  fallbackInk: string,
) {
  if (chartScroll.viewportWidth <= 0) {
    return { fill: fallbackBg, color: fallbackInk, width: undefined, height: undefined };
  }

  const centerX = chartCenterXFromClampedScroll(
    chartScroll.liveScrollX >= 0 ? chartScroll.liveScrollX : chartScroll.initialScrollX,
    chartScroll.viewportWidth,
    chartScroll.maxIndex,
  );
  const { i, t } = chartScrollBlendAtCenter(centerX, chartScroll.bgColors.length);
  const fromBg = chartScroll.bgColors[i] ?? fallbackBg;
  const toBg = chartScroll.bgColors[i + 1] ?? fromBg;
  const fromInk = chartScroll.inkColors[i] ?? fallbackInk;
  const toInk = chartScroll.inkColors[i + 1] ?? fromInk;
  const hasWidths = chartScroll.chipLayoutWidths.length > 0;

  return {
    fill: interpolateColor(t, [0, 1], [fromBg, toBg]),
    color: interpolateColor(t, [0, 1], [fromInk, toInk]),
    width: hasWidths ? chartInterpolateAtCenter(centerX, chartScroll.chipLayoutWidths) : undefined,
    height: hasWidths
      ? chartInterpolateAtCenter(centerX, chartScroll.chipLayoutHeights)
      : undefined,
  };
}

function scrollCenterX(chartScroll: ChartScrollProps): number {
  'worklet';
  const offsetX =
    chartScroll.scrollX.value < 0 ? chartScroll.initialScrollX : chartScroll.scrollX.value;
  return chartCenterXFromScroll(offsetX, chartScroll.viewportWidth);
}

function useChartLinkedBadgeStyle(
  chartScroll: ChartScrollProps | undefined,
  fallbackBg: string,
  fallbackInk: string,
) {
  const reduceMotion = useReducedMotion();

  const stickerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: STICKER_ROTATE }, { scale: STICKER_SCALE }],
  }));

  const containerSizeStyle = useAnimatedStyle(() => {
    if (
      chartScroll == null ||
      reduceMotion ||
      chartScroll.viewportWidth <= 0 ||
      chartScroll.chipLayoutWidths.length === 0
    ) {
      return {};
    }

    const centerX = scrollCenterX(chartScroll);
    return {
      width: chartInterpolateAtCenter(centerX, chartScroll.chipLayoutWidths),
      height: chartInterpolateAtCenter(centerX, chartScroll.chipLayoutHeights),
    };
  }, [chartScroll, reduceMotion]);

  const burstProps = useAnimatedProps(() => {
    if (chartScroll == null || reduceMotion || chartScroll.viewportWidth <= 0) {
      return { fill: fallbackBg };
    }

    const centerX = scrollCenterX(chartScroll);
    const { i, t } = chartScrollBlendAtCenter(centerX, chartScroll.bgColors.length);
    const fromBg = chartScroll.bgColors[i] ?? fallbackBg;
    const toBg = chartScroll.bgColors[i + 1] ?? fromBg;
    return { fill: interpolateColor(t, [0, 1], [fromBg, toBg]) };
  }, [chartScroll, fallbackBg, reduceMotion]);

  const labelStyle = useAnimatedStyle(() => {
    if (chartScroll == null || reduceMotion || chartScroll.viewportWidth <= 0) {
      return { color: fallbackInk };
    }

    const centerX = scrollCenterX(chartScroll);
    const { i, t } = chartScrollBlendAtCenter(centerX, chartScroll.inkColors.length);
    const fromInk = chartScroll.inkColors[i] ?? fallbackInk;
    const toInk = chartScroll.inkColors[i + 1] ?? fromInk;
    return { color: interpolateColor(t, [0, 1], [fromInk, toInk]) };
  }, [chartScroll, fallbackInk, reduceMotion]);

  return { stickerStyle, containerSizeStyle, burstProps, labelStyle };
}

/** Off-screen probe that measures chip container size for each label. */
export function ConditionChipWidthProbe({
  labels,
  large = true,
  onLayouts,
}: Readonly<{
  labels: readonly string[];
  large?: boolean;
  onLayouts: (layouts: ChipLayoutSize[]) => void;
}>) {
  const size = BURST_CHIP_SIZES[large ? 'large' : 'default'];
  const pendingRef = useRef<Map<number, ChipLayoutSize>>(new Map());

  const handleLayout = useCallback(
    (index: number, width: number, height: number) => {
      pendingRef.current.set(index, { width, height });
      if (pendingRef.current.size === labels.length) {
        onLayouts(labels.map((_, i) => pendingRef.current.get(i) ?? { width: 0, height: 0 }));
      }
    },
    [labels, onLayouts],
  );

  if (labels.length === 0) return null;

  return (
    <View style={styles.widthProbe} pointerEvents="none" accessibilityElementsHidden>
      {labels.map((probeLabel, index) => (
        <View
          key={`${index}-${probeLabel}`}
          style={[burstChipStyles.container, size.container]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            handleLayout(index, width, height);
          }}
        >
          <Text style={[burstChipStyles.text, size.text]}>{probeLabel}</Text>
        </View>
      ))}
    </View>
  );
}

export function AnimatedConditionChip({
  condition,
  children,
  chartScroll,
  large = true,
  style,
}: Readonly<{
  condition: Condition;
  children: string;
  chartScroll?: ChartScrollProps;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduceMotion = useReducedMotion();
  const useWebLinked =
    Platform.OS === 'web' &&
    !reduceMotion &&
    chartScroll != null &&
    chartScroll.liveScrollX >= 0 &&
    chartScroll.viewportWidth > 0;

  if (useWebLinked) {
    return (
      <AnimatedConditionChipWeb
        condition={condition}
        chartScroll={chartScroll}
        large={large}
        style={style}
      >
        {children}
      </AnimatedConditionChipWeb>
    );
  }

  return (
    <AnimatedConditionChipNative
      condition={condition}
      chartScroll={chartScroll}
      large={large}
      style={style}
    >
      {children}
    </AnimatedConditionChipNative>
  );
}

function AnimatedConditionChipWeb({
  condition,
  children,
  chartScroll,
  large = true,
  style,
}: Readonly<{
  condition: Condition;
  children: string;
  chartScroll: ChartScrollProps;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const c = useWheelyColors();
  const label = children;
  const backgroundColor = c.condition[condition].bg;
  const color = c.condition[condition].ink;
  const appearance = linkedChipAppearance(chartScroll, backgroundColor, color);
  const size = BURST_CHIP_SIZES[large ? 'large' : 'default'];
  const stickerStyle = {
    transform: [{ rotate: STICKER_ROTATE }, { scale: STICKER_SCALE }],
  };
  const hasScrollSize = appearance.width != null && appearance.height != null;

  return (
    <Animated.View style={[stickerStyle, style]}>
      <View
        style={[
          burstChipStyles.container,
          size.container,
          hasScrollSize ? { width: appearance.width, height: appearance.height } : null,
        ]}
      >
        {hasScrollSize ? (
          <Svg
            viewBox={BURST_VIEWBOX}
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
            width={appearance.width}
            height={appearance.height}
          >
            <Path d={BURST_PATH} fill={appearance.fill} />
          </Svg>
        ) : null}
        <Text
          style={[burstChipStyles.text, size.text, { color: appearance.color }]}
          accessibilityLabel={label}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

function AnimatedConditionChipNative({
  condition,
  children,
  chartScroll,
  large = true,
  style,
}: Readonly<{
  condition: Condition;
  children: string;
  chartScroll?: ChartScrollProps;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const c = useWheelyColors();
  const label = children;
  const backgroundColor = c.condition[condition].bg;
  const color = c.condition[condition].ink;

  const { stickerStyle, containerSizeStyle, burstProps, labelStyle } = useChartLinkedBadgeStyle(
    chartScroll,
    backgroundColor,
    color,
  );

  const size = BURST_CHIP_SIZES[large ? 'large' : 'default'];
  const hasScrollWidths = (chartScroll?.chipLayoutWidths.length ?? 0) > 0;

  return (
    <Animated.View style={[stickerStyle, style]}>
      <Animated.View
        style={[burstChipStyles.container, size.container, hasScrollWidths && containerSizeStyle]}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg viewBox={BURST_VIEWBOX} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
            <AnimatedPath d={BURST_PATH} animatedProps={burstProps} />
          </Svg>
        </View>
        <AnimatedText
          style={[burstChipStyles.text, size.text, labelStyle]}
          accessibilityLabel={label}
        >
          {label}
        </AnimatedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  widthProbe: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: 0,
  },
});

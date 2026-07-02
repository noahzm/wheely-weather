import { Platform } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import {
  chartCenterXFromClampedScroll,
  chartCenterXFromScroll,
  chartDiscreteDotOpacity,
  chartDiscreteDotRadius,
  chartDotOpacityAtDistance,
  chartDotRadiusForIndex,
  chartX,
  chartY,
} from '@/utils/hourlyChart';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

export function HourlyChartDot({
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

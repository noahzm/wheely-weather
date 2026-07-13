import { Platform } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import {
  chartCenterXFromClampedScroll,
  chartDotOpacity,
  chartDotRadius,
  chartDotRadiusAtCenter,
  chartX,
  chartY,
} from '@/utils/hourlyChart';

/**
 * One condition-line dot. Web receives radius from JS scroll state; native
 * computes radius on the UI thread from shared scroll position.
 */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function HourlyChartDot({
  idx,
  condition,
  isNow,
  isPast,
  fill,
  stroke,
  radius,
  scrollX,
  viewportWidth,
  initialScrollX,
  maxIndex,
  count,
}: Readonly<{
  idx: number;
  condition: string;
  isNow: boolean;
  isPast: boolean;
  fill: string;
  stroke: string;
  radius?: number;
  scrollX?: SharedValue<number>;
  viewportWidth?: number;
  initialScrollX?: number;
  maxIndex?: number;
  count?: number;
}>) {
  const animatedProps = useAnimatedProps(() => {
    if (scrollX == null || viewportWidth == null || maxIndex == null || count == null) {
      return { r: chartDotRadius(isNow) };
    }
    const offsetX = scrollX.value < 0 ? (initialScrollX ?? 0) : scrollX.value;
    const centerX = chartCenterXFromClampedScroll(offsetX, viewportWidth, maxIndex);
    return {
      r: chartDotRadiusAtCenter(idx, isNow, centerX, count),
    };
  }, [count, idx, initialScrollX, isNow, maxIndex, scrollX, viewportWidth]);

  if (Platform.OS === 'web') {
    return (
      <Circle
        cx={chartX(idx)}
        cy={chartY(condition)}
        r={radius ?? chartDotRadius(isNow)}
        opacity={chartDotOpacity(isPast, isNow)}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }

  return (
    <AnimatedCircle
      cx={chartX(idx)}
      cy={chartY(condition)}
      animatedProps={animatedProps}
      opacity={chartDotOpacity(isPast, isNow)}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

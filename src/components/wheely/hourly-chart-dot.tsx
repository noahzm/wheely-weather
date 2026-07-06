import { Circle } from 'react-native-svg';

import { chartDotOpacity, chartDotRadius, chartX, chartY } from '@/utils/hourlyChart';

/**
 * One static dot on the condition line. The scroll-linked swell/brighten
 * effect lives entirely in the SelectionMarker gliding along the spline, so
 * the dots never animate — identical on native and web, and never re-render
 * during scrolling.
 */
export function HourlyChartDot({
  idx,
  condition,
  isNow,
  isPast,
  fill,
  stroke,
}: Readonly<{
  idx: number;
  condition: string;
  isNow: boolean;
  isPast: boolean;
  fill: string;
  stroke: string;
}>) {
  return (
    <Circle
      cx={chartX(idx)}
      cy={chartY(condition)}
      r={chartDotRadius(isNow)}
      opacity={chartDotOpacity(isPast, isNow)}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

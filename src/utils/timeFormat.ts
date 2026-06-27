/**
 * Short hour label for chart axis ticks (no space): "12AM", "3PM".
 */
export function hourLabel(h: number): string {
  const hour = h % 24;
  if (hour === 0) return '12AM';
  if (hour === 12) return '12PM';
  if (hour < 12) return `${hour}AM`;
  return `${hour - 12}PM`;
}

/**
 * Full hour label for accessible descriptions and tooltips (with space): "12 AM", "3 PM".
 */
export function fullHourLabel(h: number): string {
  const hour = h % 24;
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

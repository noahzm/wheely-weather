/**
 * Hour label for chart axis ticks, accessible descriptions, and tooltips:
 * "12 AM", "3 PM".
 */
export function fullHourLabel(h: number): string {
  const hour = h % 24;
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

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

/**
 * Age label for the forecast snapshot's fetch time: "Updated just now",
 * "Updated 5 min ago", then an absolute "Updated 3:42 PM" past the hour so a
 * very stale snapshot never reads fresher than it is. Computed at render time
 * (no ticking timer), so the absolute fallback keeps a long-open screen honest.
 */
export function formatUpdatedAgo(lastUpdated: Date, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - lastUpdated.getTime()) / 60_000));
  if (mins < 1) return 'Updated just now';
  if (mins === 1) return 'Updated 1 min ago';
  if (mins < 60) return `Updated ${mins} min ago`;
  const h = lastUpdated.getHours() % 12 || 12;
  const suffix = lastUpdated.getHours() < 12 ? 'AM' : 'PM';
  const m = String(lastUpdated.getMinutes()).padStart(2, '0');
  return `Updated ${h}:${m} ${suffix}`;
}

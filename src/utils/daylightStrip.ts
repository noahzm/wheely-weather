import type { DaylightHour } from '@/types/weather';

/**
 * A day's daylight strip split around its recommended ride window, so the
 * window's hours can be drawn as one outlined run. Without a window (or when
 * none of its hours are daylight hours), every hour is in `before`.
 */
export function splitDaylightStrip(
  hours: readonly DaylightHour[],
  window: { startHour: number; endHour: number } | null,
): { before: DaylightHour[]; inWindow: DaylightHour[]; after: DaylightHour[] } {
  const inRange = (h: DaylightHour) =>
    window != null && h.hour >= window.startHour && h.hour < window.endHour;
  const first = hours.findIndex((h) => inRange(h));
  if (first === -1) return { before: [...hours], inWindow: [], after: [] };
  // A loop rather than findLastIndex, which Hermes (iOS) doesn't ship.
  let end = first + 1;
  for (; end < hours.length; end++) {
    const hour = hours[end];
    if (hour == null || !inRange(hour)) break;
  }
  return {
    before: hours.slice(0, first),
    inWindow: hours.slice(first, end),
    after: hours.slice(end),
  };
}

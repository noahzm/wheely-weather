import { describe, expect, it } from 'vitest';

import { splitDaylightStrip } from './daylightStrip';
import type { DaylightHour } from '@/types/weather';

const hours: DaylightHour[] = [7, 8, 9, 10, 11, 12].map((hour) => ({ hour, condition: 'good' }));
const hoursOf = (list: DaylightHour[]) => list.map((h) => h.hour);

describe('splitDaylightStrip', () => {
  it('splits the strip around the window’s hours', () => {
    const { before, inWindow, after } = splitDaylightStrip(hours, { startHour: 9, endHour: 11 });
    expect(hoursOf(before)).toEqual([7, 8]);
    expect(hoursOf(inWindow)).toEqual([9, 10]);
    expect(hoursOf(after)).toEqual([11, 12]);
  });

  it('handles a window at either end of the day', () => {
    expect(hoursOf(splitDaylightStrip(hours, { startHour: 7, endHour: 9 }).before)).toEqual([]);
    expect(hoursOf(splitDaylightStrip(hours, { startHour: 11, endHour: 14 }).inWindow)).toEqual([
      11, 12,
    ]);
    expect(hoursOf(splitDaylightStrip(hours, { startHour: 11, endHour: 14 }).after)).toEqual([]);
  });

  it('puts every hour before when there is no window, or it misses daylight', () => {
    expect(hoursOf(splitDaylightStrip(hours, null).before)).toEqual([7, 8, 9, 10, 11, 12]);
    const evening = splitDaylightStrip(hours, { startHour: 18, endHour: 20 });
    expect(hoursOf(evening.before)).toHaveLength(6);
    expect(evening.inWindow).toEqual([]);
  });
});

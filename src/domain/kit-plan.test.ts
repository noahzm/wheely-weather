import { describe, expect, it } from 'vitest';

import { ALL_DAY_RIDE_HOURS } from './ride-window';
import { describeTiming, getKitPlan, labelTimelineHours, smoothNeeded } from './kit-plan';
import type { KitPlan, KitPlanItem } from './kit-plan';
import { makeHour, makeWeather } from '@/test-utils/weather';
import type { HourlyWeather } from '@/types/weather';

/** Consecutive hours from `start`, one per entry in `temps`, with shared overrides per hour. */
function hoursFrom(
  start: number,
  temps: number[],
  perHour: (i: number) => Partial<HourlyWeather> = () => ({}),
): HourlyWeather[] {
  return temps.map((temperature, i) => makeHour({ hour: start + i, temperature, ...perHour(i) }));
}

function item(plan: KitPlan, label: RegExp): KitPlanItem | undefined {
  const all = [...plan.zones.flatMap((zone) => zone.items), ...plan.pack, ...plan.prep];
  return all.find((candidate) => label.test(candidate.label));
}

function zoneLabels(plan: KitPlan): Record<string, string[]> {
  return Object.fromEntries(
    plan.zones.map((zone) => [zone.zone, zone.items.map((entry) => entry.label)]),
  );
}

// A cool, breezy morning that warms up: 46° at 9 AM, 61° by 11, the wind
// easing and a chance of early rain.
const coolMorning = makeWeather({
  hourly: hoursFrom(9, [46, 54, 61, 64], (i) => ({
    windSpeed: [17, 14, 10, 8][i],
    rainChance: [40, 20, 10, 0][i],
    uv: [2, 3, 4, 5][i],
    dewpoint: 40,
  })),
});
const morningRide = { startHour: 9, endHour: 12 };

describe('getKitPlan', () => {
  it('lists a roadie’s kit head to toe and says when layers come off', () => {
    const plan = getKitPlan(coolMorning, 'pro', morningRide);

    expect(zoneLabels(plan)).toEqual({
      torso: ['Short-sleeve jersey', 'Gilet'],
      arms: ['Arm warmers'],
      hands: ['Light full-finger gloves'],
      legs: ['Bib shorts', 'Knee warmers'],
    });
    expect(plan.pack.map((entry) => entry.label)).toEqual(['Packable rain shell']);
    expect(plan.prep.map((entry) => entry.label)).toEqual(['Sunscreen']);

    // The everyday jersey and bibs need no reason; the cold-weather pieces do.
    expect(item(plan, /^Short-sleeve jersey/)?.reason).toBeNull();
    expect(item(plan, /^Bib shorts/)?.reason).toBeNull();
    expect(item(plan, /^Knee warmers/)?.reason).toEqual({
      kind: 'cold',
      temperature: 46,
      when: 'start',
    });
    expect(item(plan, /^Packable rain shell/)?.reason).toEqual({ kind: 'rain', chance: 40 });
    expect(item(plan, /^Sunscreen/)?.reason).toEqual({ kind: 'uv', index: 4 });

    // 61° at 11 AM is past the cool band: warmers, gilet and gloves come off.
    const offBy11 = { kind: 'offBy', hour: 11 };
    expect(item(plan, /^Knee warmers/)?.timing).toEqual(offBy11);
    expect(item(plan, /^Gilet/)?.timing).toEqual(offBy11);
    expect(item(plan, /^Light full-finger gloves/)?.timing).toEqual(offBy11);
    // Arm warmers still suit 61°, so they stay on.
    expect(item(plan, /^Arm warmers/)?.timing).toBeNull();

    expect(plan.hours).toEqual([
      { hour: 9, temperature: 46, change: false, labeled: true },
      { hour: 10, temperature: 54, change: false, labeled: true },
      { hour: 11, temperature: 61, change: true, labeled: true },
    ]);
  });

  it('wears a casual rider’s windbreaker for the windy start, then stows it', () => {
    const plan = getKitPlan(coolMorning, 'casual', morningRide);

    expect(zoneLabels(plan)).toEqual({
      torso: ['Long sleeves or hoodie', 'Windbreaker'],
      hands: ['Light gloves'],
      legs: ['Pants or heavier shorts'],
    });
    expect(item(plan, /^Windbreaker/)).toEqual({
      icon: 'Jacket',
      label: 'Windbreaker',
      reason: { kind: 'wind', speed: 17 },
      timing: { kind: 'offBy', hour: 10 },
    });
    // The top is the outfit, not an extra: no reason and no timing.
    expect(item(plan, /^Long sleeves/)).toMatchObject({ reason: null, timing: null });
    expect(item(plan, /^Light gloves/)?.timing).toEqual({ kind: 'offBy', hour: 11 });
    expect(plan.pack.map((entry) => entry.label)).toEqual(['Quick-dry layer']);
    expect(plan.hours.map((hour) => hour.change)).toEqual([false, true, true]);
  });

  it('takes layers off midday and back on at dusk on an all-day ride', () => {
    const temps = [41, 45, 50, 55, 58, 61, 63, 64, 63, 59, 54];
    const weather = makeWeather({ hourly: hoursFrom(7, temps, () => ({ dewpoint: 35 })) });
    const plan = getKitPlan(weather, 'pro', { startHour: 7, endHour: 18 });

    const offMidday = { kind: 'offBetween', from: 10, to: 17 };
    expect(item(plan, /^Skull cap/)?.timing).toEqual({ kind: 'offBy', hour: 8 });
    expect(item(plan, /^Full-finger gloves/)?.timing).toEqual(offMidday);
    expect(item(plan, /^Vest or jacket/)?.timing).toEqual(offMidday);
    // Base layers and tights can't come off on the road.
    expect(item(plan, /^Long-sleeve base layer/)?.timing).toBeNull();
    expect(item(plan, /^Thermal bib tights/)?.timing).toBeNull();
    expect(zoneLabels(plan).head).toEqual(['Skull cap or headband']);

    expect(plan.hours.filter((hour) => hour.change).map((hour) => hour.hour)).toEqual([8, 10, 17]);
    // Eleven hours label only the ends, the changes and the warmest, spaced apart.
    expect(plan.hours.filter((hour) => hour.labeled).map((hour) => hour.hour)).toEqual([
      7, 10, 14, 17,
    ]);
  });

  it('places the coldest hour at the start, the finish, or in between', () => {
    const coldReason = (temps: number[]) =>
      item(
        getKitPlan(makeWeather({ hourly: hoursFrom(16, temps) }), 'casual', {
          startHour: 16,
          endHour: 16 + temps.length,
        }),
        /^Light gloves/,
      )?.reason;

    expect(coldReason([60, 55, 50])).toEqual({ kind: 'cold', temperature: 50, when: 'finish' });
    expect(coldReason([55, 50, 56])).toEqual({ kind: 'cold', temperature: 50, when: 'low' });
    expect(coldReason([50])).toEqual({ kind: 'cold', temperature: 50, when: 'low' });
  });

  it('explains mugginess, wet roads and strong sun, but not the clothes heat picks', () => {
    const hot = makeWeather({
      weatherCode: 61,
      hourly: hoursFrom(12, [88, 93, 92], () => ({ dewpoint: 70, uv: 9 })),
    });
    const casual = getKitPlan(hot, 'casual', { startHour: 12, endHour: 15 });
    // The muggy wicking top takes the scorching top's slot.
    expect(item(casual, /^Wicking top/)?.reason).toEqual({ kind: 'muggy', dewpoint: 70 });
    expect(item(casual, /^Shorts$/)?.reason).toBeNull();
    expect(item(casual, /^Fenders or splash jacket/)?.reason).toEqual({ kind: 'wetRoads' });
    expect(casual.pack.map((entry) => entry.label)).toEqual(['Fenders or splash jacket']);
    expect(zoneLabels(casual).head).toEqual(['Sunglasses']);

    const pro = getKitPlan(hot, 'pro', { startHour: 12, endHour: 15 });
    expect(item(pro, /^Lightweight jersey/)?.reason).toBeNull();
    expect(item(pro, /^Sunglasses/)?.reason).toEqual({ kind: 'uv', index: 9 });
  });

  it('packs rain gear when rain is likely', () => {
    const wet = makeWeather({ hourly: hoursFrom(9, [62, 63, 64], () => ({ rainChance: 70 })) });
    const plan = getKitPlan(wet, 'pro', { startHour: 9, endHour: 12 });
    expect(plan.pack).toEqual([
      {
        icon: 'CyclingJacket',
        label: 'Rain jacket',
        reason: { kind: 'rain', chance: 70 },
        timing: null,
      },
      {
        icon: 'ShoeCovers',
        label: 'Shoe covers',
        reason: { kind: 'rain', chance: 70 },
        timing: null,
      },
    ]);
  });

  it('gives the swing layer its reason', () => {
    // Calm and dry, warming 20°: the swing layer is the only outer layer.
    const weather = makeWeather({ hourly: hoursFrom(8, [66, 76, 86]) });
    const plan = getKitPlan(weather, 'casual', { startHour: 8, endHour: 11 });
    expect(item(plan, /^Removable layer/)).toMatchObject({
      reason: { kind: 'swing', degrees: 20 },
      // No single hour calls for it on its own, so there's no time to name.
      timing: null,
    });
  });

  it('dresses for the current conditions without hourly data', () => {
    const plan = getKitPlan(makeWeather({ temperature: 72 }), 'casual');
    expect(plan.hours).toEqual([]);
    expect(zoneLabels(plan)).toEqual({ torso: ['Short-sleeve top'], legs: ['Shorts'] });
  });

  it('limits an unwindowed all-day plan to daylight hours instead of overnight', () => {
    // Starts at 8 AM and spans 24 hours: warm daylight (65°F) and freezing overnight (28°F).
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const hour = (8 + i) % 24;
      const inDaylight = hour >= 6 && hour < 19;
      return makeHour({ hour, temperature: inDaylight ? 65 : 28 });
    });
    const withDaylight = makeWeather({
      temperature: 65,
      hourly,
      daylight: { sunriseHour: 6, sunsetHour: 19 },
    });
    const plan = getKitPlan(withDaylight, 'pro', null, undefined, ALL_DAY_RIDE_HOURS);
    // Today's remaining daylight: 8 AM through 6 PM (11 hours), skipping the 28°F night.
    expect(plan.hours.map((h) => h.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(item(plan, /insulated|balaclava/i)).toBeUndefined();

    // Without daylight bounds, falls back to the standard 3-hour slice rather than 24 hours.
    const withoutDaylight = makeWeather({ temperature: 65, hourly });
    const fallbackPlan = getKitPlan(withoutDaylight, 'pro', null, undefined, ALL_DAY_RIDE_HOURS);
    expect(fallbackPlan.hours).toHaveLength(3);
  });
});

describe('describeTiming', () => {
  const hours = [9, 10, 11, 12];

  it('names when a piece goes on, or the only stretch it’s worn', () => {
    expect(describeTiming([false, false, true, true], hours)).toEqual({ kind: 'onBy', hour: 11 });
    expect(describeTiming([false, true, true, false], hours)).toEqual({
      kind: 'only',
      from: 10,
      to: 12,
    });
  });

  it('says nothing when it’s worn throughout, never, or on and off too often', () => {
    expect(describeTiming([true, true, true, true], hours)).toBeNull();
    expect(describeTiming([false, false, false, false], hours)).toBeNull();
    expect(describeTiming([true, false, true, false], hours)).toBeNull();
    expect(describeTiming([true], [9])).toBeNull();
  });
});

describe('smoothNeeded', () => {
  it('fills a one-hour gap but keeps longer ones and the ends', () => {
    expect(smoothNeeded([true, false, true])).toEqual([true, true, true]);
    expect(smoothNeeded([true, false, false, true])).toEqual([true, false, false, true]);
    expect(smoothNeeded([false, true, false])).toEqual([false, true, false]);
  });
});

describe('labelTimelineHours', () => {
  it('labels every hour of a short ride', () => {
    const short = [50, 55, 60].map((temperature) => ({ temperature, change: false }));
    expect(labelTimelineHours(short)).toEqual([true, true, true]);
  });

  it('keeps long-ride labels at least two hours apart', () => {
    const long = [40, 50, 60, 70, 72, 70, 60, 50].map((temperature, i) => ({
      temperature,
      change: i === 1,
    }));
    // The change at 1 sits next to the start, so the warmest hour (4) is labeled instead.
    expect(labelTimelineHours(long)).toEqual([true, false, false, false, true, false, false, true]);
  });
});

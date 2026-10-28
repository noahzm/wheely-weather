// The home kit card's plan: the kit sorted head to toe, why each add-on is in
// it, and when a removable piece comes off during the ride. It's built from
// the same tips as getGearSuggestion, so the two never disagree about what to
// wear; the timing comes from dressing each ride hour on its own.
import { THRESHOLDS, type Thresholds } from './constants';
import { GEAR_TIPS } from './copy';
import {
  buildKitEntries,
  getRideWindow,
  selectHoursBeforeRide,
  selectRideHours,
  type GearTipKey,
  type GearTipSet,
  type KitEntry,
  type RideHours,
  type RideWindow,
} from './gear';

import type { GearTipItem, HourlyWeather, Weather } from '@/types/weather';

export type KitZone = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet';

/** Body zones, head to toe: the order the card lists what to wear. */
export const KIT_ZONES: readonly KitZone[] = ['head', 'torso', 'arms', 'hands', 'legs', 'feet'];

/** Why an item is in the kit, in Fahrenheit and mph (formatted at display). */
export type KitReason =
  | { kind: 'cold'; temperature: number; when: 'start' | 'finish' | 'low' }
  | { kind: 'swing'; degrees: number }
  | { kind: 'rain'; chance: number }
  | { kind: 'wetRoads' }
  | { kind: 'wind'; speed: number }
  | { kind: 'uv'; index: number }
  | { kind: 'muggy'; dewpoint: number };

/** When a removable piece is worn, as local hours; `to` hours are exclusive. */
export type KitTiming =
  | { kind: 'offBy'; hour: number }
  | { kind: 'offBetween'; from: number; to: number }
  | { kind: 'onBy'; hour: number }
  | { kind: 'only'; from: number; to: number };

export interface KitPlanItem {
  icon: string;
  label: string;
  reason: KitReason | null;
  /** Null when it's worn the whole ride (or the hours are too choppy to say). */
  timing: KitTiming | null;
}

export interface KitPlanHour {
  hour: number;
  temperature: number;
  /** Something comes off or goes back on at this hour. */
  change: boolean;
  /** Shown with its time and temperature; long rides label only a few hours. */
  labeled: boolean;
}

export interface KitPlan {
  /** The hours the kit dresses for, for the card's timeline; empty without hourly data. */
  hours: KitPlanHour[];
  /** Worn items, head to toe. Zones with nothing to wear are left out. */
  zones: { zone: KitZone; items: KitPlanItem[] }[];
  /** Carried in case: rain and wet-road gear. */
  pack: KitPlanItem[];
  /** Done before setting out: sunscreen. */
  prep: KitPlanItem[];
}

// Everything not listed (tops, jerseys, base layers, jackets, gilets) dresses the torso.
const ZONE_BY_ICON: ReadonlyMap<string, KitZone> = new Map([
  ['WoolCap', 'head'],
  ['Balaclava', 'head'],
  ['Glasses', 'head'],
  ['CyclingGlasses', 'head'],
  ['ArmWarmers', 'arms'],
  ['Hand', 'hands'],
  ['CyclingGloves', 'hands'],
  ['Pants', 'legs'],
  ['CasualShorts', 'legs'],
  ['Shorts', 'legs'],
  ['BibShorts', 'legs'],
  ['BibTights', 'legs'],
  ['KneeWarmers', 'legs'],
  ['ShoeCovers', 'feet'],
  ['Footprints', 'feet'],
]);

// Tops a rider keeps on all ride: the jersey or base layer they set out in.
const BASE_ICONS: ReadonlySet<string> = new Set([
  'Shirt',
  'LongSleeveShirt',
  'Jersey',
  'LongSleeveJersey',
  'BaseLayer',
]);

const TEMPERATURE_TIPS: ReadonlySet<GearTipKey> = new Set([
  'FREEZING',
  'COLD',
  'COOL',
  'MILD_COOL',
  'NEUTRAL',
  'HOT',
  'SCORCHING',
]);
// Rain gear rides along in case; nobody sets out in a rain jacket on a dry start.
const PACK_TIPS: ReadonlySet<GearTipKey> = new Set(['RAIN_HIGH', 'RAIN_POSSIBLE', 'WET_ROADS']);

// Up to this many hours, every hour on the timeline gets its time and temperature.
const ALL_LABELED_HOURS = 6;

type Placement = 'worn' | 'pack' | 'prep';

function placementOf(entry: KitEntry): Placement {
  if (entry.item.icon === 'Sunscreen') return 'prep';
  if (PACK_TIPS.has(entry.key) && !entry.item.slot) return 'pack';
  return 'worn';
}

function zoneOf(item: GearTipItem): KitZone {
  return ZONE_BY_ICON.get(item.icon) ?? 'torso';
}

/** Warmers, gloves, caps and outer layers come off; tops and bottoms stay on. */
function isRemovable(item: GearTipItem): boolean {
  return !item.slot && !BASE_ICONS.has(item.icon);
}

/** What an item does on the road. A kit's one outer layer is one job, gilet or jacket. */
function roleOf(item: GearTipItem): string {
  return item.outer ? 'outer' : item.icon;
}

function hourWindow(hour: HourlyWeather): RideWindow {
  return {
    minTemp: hour.temperature,
    maxTemp: hour.temperature,
    maxWind: hour.windSpeed,
    maxRain: hour.rainChance,
    maxPrecip: hour.precipitation ?? null,
    maxDewpoint: hour.dewpoint ?? 0,
    maxUv: hour.uv ?? 0,
  };
}

function coldestWhen(hours: HourlyWeather[]): 'start' | 'finish' | 'low' {
  if (hours.length < 2) return 'low';
  const temperatures = hours.map((hour) => hour.temperature);
  const coldest = temperatures.indexOf(Math.min(...temperatures));
  if (coldest === 0) return 'start';
  return coldest === hours.length - 1 ? 'finish' : 'low';
}

// The add-on tips, each with the reading that triggered it.
const ADD_ON_REASONS: Partial<Record<GearTipKey, (w: RideWindow) => KitReason>> = {
  TEMP_SWING: (w) => ({ kind: 'swing', degrees: w.maxTemp - w.minTemp }),
  RAIN_HIGH: (w) => ({ kind: 'rain', chance: w.maxRain }),
  RAIN_POSSIBLE: (w) => ({ kind: 'rain', chance: w.maxRain }),
  WET_ROADS: () => ({ kind: 'wetRoads' }),
  WINDY: (w) => ({ kind: 'wind', speed: w.maxWind }),
  UV_EXTREME: (w) => ({ kind: 'uv', index: w.maxUv }),
  UV_HIGH: (w) => ({ kind: 'uv', index: w.maxUv }),
  MUGGY: (w) => ({ kind: 'muggy', dewpoint: w.maxDewpoint }),
};

function reasonFor(
  entry: KitEntry,
  w: RideWindow,
  when: 'start' | 'finish' | 'low',
): KitReason | null {
  const { key, item } = entry;
  // Clothing the temperature picks needs no reason: the card's timeline shows
  // the temperatures. Only the cold-weather extras say why they're along.
  if (TEMPERATURE_TIPS.has(key)) {
    return isRemovable(item) ? { kind: 'cold', temperature: w.minTemp, when } : null;
  }
  return ADD_ON_REASONS[key]?.(w) ?? null;
}

/**
 * Fills one-hour gaps between hours a piece is needed: nobody pulls arm
 * warmers off for a single warmer hour and puts them back on.
 */
export function smoothNeeded(needed: readonly boolean[]): boolean[] {
  return needed.map(
    (on, i) => on || (i > 0 && i < needed.length - 1 && !!needed[i - 1] && !!needed[i + 1]),
  );
}

/** Runs of needed hours, as [start, end) indices. */
function neededRuns(needed: readonly boolean[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const [i, on] of needed.entries()) {
    if (!on) continue;
    const last = runs.at(-1);
    if (last?.[1] === i) last[1] = i + 1;
    else runs.push([i, i + 1]);
  }
  return runs;
}

/**
 * Says when a removable piece is worn, from whether each ride hour needs it:
 * off partway through, off midday and back on, on later, or a stretch only.
 * Null when it's needed all ride, never on its own, or on and off too often to say.
 */
export function describeTiming(
  needed: readonly boolean[],
  hours: readonly number[],
): KitTiming | null {
  const n = needed.length;
  const lastHour = hours[n - 1];
  if (n < 2 || lastHour === undefined) return null;
  const hourAt = (i: number): number => hours[i] ?? lastHour + 1;
  const runs = neededRuns(needed);
  const [first, second] = runs;
  if (!first) return null;
  const [start, end] = first;
  if (runs.length === 1) {
    if (start === 0 && end === n) return null;
    if (start === 0) return { kind: 'offBy', hour: hourAt(end) };
    if (end === n) return { kind: 'onBy', hour: hourAt(start) };
    return { kind: 'only', from: hourAt(start), to: hourAt(end) };
  }
  if (runs.length === 2 && second && start === 0 && second[1] === n) {
    return { kind: 'offBetween', from: hourAt(end), to: hourAt(second[0]) };
  }
  return null;
}

/**
 * Which hours the timeline labels. Short rides label every hour; long ones
 * keep the ends, the changes, the warmest and the coldest, spaced so the
 * labels don't run into each other.
 */
export function labelTimelineHours(
  hours: readonly { temperature: number; change: boolean }[],
): boolean[] {
  const n = hours.length;
  if (n <= ALL_LABELED_HOURS) return hours.map(() => true);
  const minGap = Math.ceil(n / ALL_LABELED_HOURS);
  const temperatures = hours.map((hour) => hour.temperature);
  const changes = hours.flatMap((hour, i) => (hour.change ? [i] : []));
  const candidates = [
    0,
    n - 1,
    ...changes,
    temperatures.indexOf(Math.max(...temperatures)),
    temperatures.indexOf(Math.min(...temperatures)),
  ];
  const picked: number[] = [];
  for (const i of candidates) {
    if (picked.every((p) => Math.abs(p - i) >= minGap)) picked.push(i);
  }
  return hours.map((_, i) => picked.includes(i));
}

/**
 * The kit card's plan for the verdict's window (or, without one, the next
 * `defaultWindowHours` hours).
 */
export function getKitPlan(
  weather: Weather,
  mode: 'casual' | 'pro' = 'casual',
  rideHours: RideHours | null = null,
  thresholds: Thresholds = THRESHOLDS,
  defaultWindowHours?: number,
): KitPlan {
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  const rideHourly = selectRideHours(weather, rideHours, defaultWindowHours);
  const w = getRideWindow(weather, rideHours, defaultWindowHours);
  const before = selectHoursBeforeRide(weather, rideHours);
  const entries = buildKitEntries(w, tipsSet, weather, before, thresholds);
  const hourKits = rideHourly.map((hour) =>
    buildKitEntries(hourWindow(hour), tipsSet, weather, before, thresholds),
  );
  const hourNumbers = rideHourly.map((hour) => hour.hour);
  const when = coldestWhen(rideHourly);

  const planned = entries.map((entry) => {
    const placement = placementOf(entry);
    const role = roleOf(entry.item);
    const needed =
      placement === 'worn' && isRemovable(entry.item)
        ? smoothNeeded(
            hourKits.map((kit) =>
              kit.some((other) => placementOf(other) === 'worn' && roleOf(other.item) === role),
            ),
          )
        : null;
    const timing = needed ? describeTiming(needed, hourNumbers) : null;
    const item: KitPlanItem = {
      icon: entry.item.icon,
      label: entry.item.label,
      reason: reasonFor(entry, w, when),
      timing,
    };
    // Only a piece that gets a timing marks the hours it changes at.
    return { entry, placement, item, changes: timing ? needed : null };
  });

  const changeAt = (i: number): boolean =>
    i > 0 && planned.some(({ changes }) => !!changes && changes[i] !== changes[i - 1]);
  const timeline = rideHourly.map((hour, i) => ({
    hour: hour.hour,
    temperature: hour.temperature,
    change: changeAt(i),
  }));
  const labeled = labelTimelineHours(timeline);

  const placed = (placement: Placement) =>
    planned.filter((p) => p.placement === placement).map((p) => p.item);
  return {
    hours: timeline.map((hour, i) => ({ ...hour, labeled: labeled[i] ?? false })),
    zones: KIT_ZONES.flatMap((zone) => {
      const items = planned
        .filter((p) => p.placement === 'worn' && zoneOf(p.entry.item) === zone)
        .map((p) => p.item);
      return items.length > 0 ? [{ zone, items }] : [];
    }),
    pack: placed('pack'),
    prep: placed('prep'),
  };
}

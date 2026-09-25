/**
 * Centralized copywriting for the Wheely Weather app.
 * Separates human-readable strings from core weather logic.
 */

import type { Condition, RideStatus, VerdictMessage } from '@/types/weather';

/** djb2-style hash for deterministic, seed-varied picks. */
function seededHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // `| 0` is an intentional 32-bit wrap (not Math.trunc) and charCodeAt hashes
    // per UTF-16 code unit — both are required for stable djb2 hash values.
    // eslint-disable-next-line unicorn/prefer-math-trunc, unicorn/prefer-code-point
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const VERDICT_LABELS: Record<RideStatus, readonly string[]> = {
  yes: [
    'Let’s ride',
    'Good to go',
    'Ride day',
    'Wheels up',
    'Cleared to ride',
    'Send it',
    'Party pace',
    'Go get lost',
    'Free miles',
  ],
  maybe: [
    'Not terrible',
    'Borderline',
    'Could go either way',
    'Rideable, barely',
    'Your call',
    'Rider’s choice',
    'Sketchy but doable',
    'Character building',
    'Flip a coin',
    'For the devoted',
  ],
  // Only committed labels here: hedged phrasing ("Probably shouldn't") reads
  // wrong next to the definitive "Sit this one out" message body.
  no: [
    'Not today',
    'Rest day',
    'Skip it',
    'Hard pass',
    'Trainer weather',
    'Wrench day',
    'Couch miles',
  ],
};

/**
 * Headlines for the wait state: bad right now, but a rideable window later
 * today. The start time is in the headline so it can't read as "go now".
 */
const WAIT_LABELS: Record<Exclude<RideStatus, 'no'>, readonly ((time: string) => string)[]> = {
  yes: [
    (t) => `Ride at ${t}`,
    (t) => `Wait till ${t}`,
    (t) => `Hold till ${t}`,
    (t) => `Roll out at ${t}`,
  ],
  maybe: [(t) => `Better at ${t}`, (t) => `Wait till ${t}`, (t) => `Hold till ${t}`],
};

/**
 * Picks a verdict badge label from a per-status pool, seeded by location and
 * day so different locations show different labels. Held for the whole day: an
 * hourly rotation changed the headline with no change in conditions, and left
 * the home screen widget (which keeps the label it was written with) out of
 * step with the app after the hour rolled over.
 */
export function getVerdictLabel(
  status: RideStatus,
  location = '',
  waitFrom: string | null = null,
): string {
  const now = new Date();
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 864e5);
  const seed = `${status}|${location}|${now.getFullYear()}|${day}`;
  if (waitFrom && status !== 'no') {
    const waitPool = WAIT_LABELS[status];
    return waitPool[seededHash(seed) % waitPool.length]?.(waitFrom) ?? '';
  }
  const pool = VERDICT_LABELS[status];
  return pool[seededHash(seed) % pool.length] ?? '';
}

export const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear skies',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Light snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

/**
 * Phrase tiers are the condition ratings minus `good` — a good metric is not an
 * issue and has nothing to phrase. Deriving this from `Condition` rather than
 * restating it means a new rating cannot be added without the phrase tables
 * failing to compile.
 */
export type IssueTier = Exclude<Condition, 'good'>;

/**
 * The single rating -> phrase-tier mapping. Both issue-phrase call sites (the
 * verdict hero's chips in `ride-factors.ts` and the hourly drawer's reasons in
 * `forecastHelpers.ts`) must route through this, or the same rating ends up
 * described with different words in the two places — `fair` humidity reading
 * "Muggy" in the hero and "Humid" in the drawer. Returns null for `good`, which
 * callers use as the "no issue to report" signal.
 */
export const issuePhraseTier = (rating: Condition): IssueTier | null =>
  rating === 'good' ? null : rating;

/**
 * Shared per-metric severity phrasing. Both the verdict hero's issue chips and
 * the hourly chart's reason drawer build from this table so the same metric is
 * always described with the same words.
 */
export const ISSUE_PHRASES = {
  // Each tier's wording is calibrated to the numeric band that produces it (see
  // THRESHOLDS): the marginal band is the "caution" zone, so it must not share a
  // word with fair, or 24 mph sustained wind reads as "Breezy".
  WIND: (mph: number, tier: IssueTier): string =>
    ({
      bad: `Dangerous wind (${mph} mph)`,
      poor: `Very windy (${mph} mph)`,
      marginal: `Windy (${mph} mph)`,
      fair: `Breezy (${mph} mph)`,
    })[tier],
  GUSTS: (mph: number, tier: IssueTier): string =>
    ({
      bad: `Dangerous gusts (${mph} mph)`,
      poor: `Strong gusts (${mph} mph)`,
      marginal: `Gusty (${mph} mph)`,
      fair: `Gusty (${mph} mph)`,
    })[tier],
  RAIN: (pct: string, tier: IssueTier): string =>
    ({
      bad: `Rain expected (${pct})`,
      poor: `Rain very likely (${pct})`,
      marginal: `Rain likely (${pct})`,
      fair: `Rain possible (${pct})`,
    })[tier],
  // Used when the expected amount, not the chance, set the rating: a 70%
  // chance of a trace amount reads as sprinkles, not "Rain likely".
  LIGHT_RAIN: (pct: string, tier: IssueTier): string =>
    tier === 'fair' ? `Sprinkles possible (${pct})` : `Light rain likely (${pct})`,
  HEAT: (tempLabel: string, tier: IssueTier): string =>
    ({
      bad: `Dangerous heat (${tempLabel})`,
      poor: `Very hot (${tempLabel})`,
      marginal: `Hot (${tempLabel})`,
      fair: `Warm (${tempLabel})`,
    })[tier],
  COLD: (tempLabel: string, tier: IssueTier): string =>
    ({
      bad: `Freezing (${tempLabel})`,
      poor: `Cold (${tempLabel})`,
      marginal: `Chilly (${tempLabel})`,
      fair: `Cool (${tempLabel})`,
    })[tier],
  COLD_RAIN: (tempLabel: string, pct: string, tier: IssueTier): string =>
    tier === 'bad'
      ? `Freezing rain risk (${tempLabel}, ${pct})`
      : `Cold rain risk (${tempLabel}, ${pct})`,
  HUMIDITY: (dewLabel: string, tier: IssueTier): string =>
    ({
      bad: `Oppressive humidity (dew ${dewLabel})`,
      poor: `Very humid (dew ${dewLabel})`,
      marginal: `Muggy (dew ${dewLabel})`,
      fair: `Humid (dew ${dewLabel})`,
    })[tier],
  AQI: (aqi: number, tier: IssueTier): string =>
    ({
      bad: `Hazardous air (AQI ${aqi})`,
      poor: `Poor air (AQI ${aqi})`,
      marginal: `Hazy (AQI ${aqi})`,
      fair: `Hazy (AQI ${aqi})`,
    })[tier],
};

const GOOD_WIND_CLAUSE: Record<Condition, string> = {
  good: 'with light winds',
  fair: 'and breezy',
  marginal: 'and windy',
  poor: 'and windy',
  bad: 'and windy',
};

export const STATUS_MESSAGES = {
  // Not "today": the verdict can be rating tomorrow's window after dark.
  THUNDERSTORM: 'Thunderstorms expected. Stay off the road.',
  // The wind clause follows the wind's own rating, so a ride day with a fair
  // breeze doesn't claim "light winds" above a chart that says "Breezy".
  GOOD: (tempLabel: string, cond: string, wind: Condition) =>
    `${tempLabel}, ${cond.toLowerCase()}, ${GOOD_WIND_CLAUSE[wind]}.`,
  MAYBE_IDEAL: 'On the edge of comfortable.',
  MAYBE_LEAD: 'Rideable, but:',
  LATER_GOOD: (time: string) => `Improves around ${time}`,
  NO_IDEAL: 'No good ride window right now.',
  NO_LEAD: 'Sit this one out:',
  CLEAR_UP: (time: string) => `Clears by ${time}`,
  BEST_WINDOW: (range: string) => `Best ${range}`,
  LEAST_BAD_WINDOW: (range: string) => `Least bad ${range}`,
  UNTIL: (time: string) => `Until ${time}`,
  RIGHT_NOW: (issue: string) => `Right now: ${issue}.`,
  KIT_TODAY: 'Today’s kit',
  KIT_TOMORROW: 'Tomorrow’s kit',
  KIT_ANYWAY: 'If you go anyway',
  TOMORROW_WINDOW: (range: string) => `Tomorrow ${range}`,
};

/**
 * Gear tips return a structured shape so the UI can render glanceable rows.
 * Each tip yields { items: [{ icon, label }] }.
 * Ride Kit is clothing-only: no hydration, food, or route guidance. Sleeve
 * and leg lengths are made explicit in labels so the rider sees the decision
 * at a glance.
 */
export const GEAR_TIPS = {
  CASUAL: {
    FREEZING: {
      items: [
        { slot: 'top', icon: 'LongSleeveShirt', label: 'Thermal base layer' },
        { icon: 'Jacket', label: 'Insulated jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Long pants' },
        { icon: 'Hand', label: 'Insulated gloves' },
        { icon: 'WoolCap', label: 'Wool cap and ear coverage' },
      ],
    },
    COLD: {
      items: [
        { slot: 'top', icon: 'LongSleeveShirt', label: 'Long-sleeve top' },
        { icon: 'Jacket', label: 'Jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Long pants' },
        { icon: 'Hand', label: 'Gloves' },
        { icon: 'WoolCap', label: 'Wool cap' },
      ],
    },
    COOL: {
      items: [
        { slot: 'top', icon: 'LongSleeveShirt', label: 'Long sleeves or hoodie' },
        { slot: 'bottom', icon: 'Pants', label: 'Pants or heavier shorts' },
      ],
    },
    MILD_COOL: {
      items: [
        {
          slot: 'top',
          icon: 'Shirt',
          label: 'Short or light long sleeve',
        },
        { slot: 'bottom', icon: 'CasualShorts', label: 'Shorts or light pants' },
      ],
    },
    HOT: {
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Short-sleeve top' },
        { slot: 'bottom', icon: 'CasualShorts', label: 'Shorts' },
      ],
    },
    SCORCHING: {
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Light short-sleeve top' },
        { slot: 'bottom', icon: 'CasualShorts', label: 'Shorts' },
      ],
    },
    NEUTRAL: {
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Short-sleeve top' },
        { slot: 'bottom', icon: 'CasualShorts', label: 'Shorts' },
      ],
    },
    TEMP_SWING: {
      items: [{ icon: 'Thermometer', label: 'Removable layer' }],
    },
    RAIN_HIGH: {
      items: [{ icon: 'Jacket', label: 'Rain jacket' }],
    },
    RAIN_POSSIBLE: {
      items: [{ icon: 'Jacket', label: 'Quick-dry layer' }],
    },
    WET_ROADS: {
      items: [{ icon: 'Jacket', label: 'Fenders or splash jacket' }],
    },
    WINDY: {
      items: [{ icon: 'Jacket', label: 'Windbreaker' }],
    },
    UV_EXTREME: {
      items: [
        { icon: 'Sunscreen', label: 'Sunscreen' },
        { icon: 'Glasses', label: 'Sunglasses' },
      ],
    },
    UV_HIGH: {
      items: [{ icon: 'Sunscreen', label: 'Sunscreen' }],
    },
    MUGGY: {
      items: [{ slot: 'top', icon: 'Shirt', label: 'Wicking top' }],
    },
  },
  PRO: {
    FREEZING: {
      items: [
        { icon: 'LongSleeveShirt', label: 'Thermal base layer' },
        { icon: 'Jacket', label: 'Insulated jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Winter bib tights' },
        { icon: 'ShoeCovers', label: 'Shoe covers' },
        { icon: 'Hand', label: 'Heavy full-finger gloves' },
        { icon: 'Snowflake', label: 'Ear and face coverage' },
      ],
    },
    COLD: {
      items: [
        { icon: 'LongSleeveShirt', label: 'Long-sleeve base layer' },
        { icon: 'LongSleeveShirt', label: 'Long-sleeve jersey' },
        { slot: 'bottom', icon: 'Pants', label: 'Thermal bib tights' },
        { icon: 'Hand', label: 'Full-finger gloves' },
        { icon: 'Jacket', label: 'Vest or jacket' },
      ],
    },
    COOL: {
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
        { icon: 'ArmWarmers', label: 'Arm warmers' },
        { icon: 'ArmWarmers', label: 'Knee warmers' },
        { icon: 'Gilet', label: 'Gilet' },
      ],
    },
    MILD_COOL: {
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
        { icon: 'ArmWarmers', label: 'Arm warmers' },
      ],
    },
    HOT: {
      items: [
        { icon: 'Shirt', label: 'Lightweight jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
      ],
    },
    SCORCHING: {
      items: [
        { icon: 'Shirt', label: 'Lightweight jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
      ],
    },
    NEUTRAL: {
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
      ],
    },
    TEMP_SWING: {
      items: [{ icon: 'Gilet', label: 'Gilet or arm warmers' }],
    },
    RAIN_HIGH: {
      items: [
        { icon: 'Jacket', label: 'Rain jacket' },
        { icon: 'ShoeCovers', label: 'Shoe covers' },
      ],
    },
    RAIN_POSSIBLE: {
      items: [{ icon: 'Gilet', label: 'Packable vest or shell' }],
    },
    WET_ROADS: {
      items: [
        { icon: 'ShoeCovers', label: 'Shoe covers or fenders' },
        { icon: 'Jacket', label: 'Wet road shell' },
      ],
    },
    WINDY: {
      items: [{ icon: 'Gilet', label: 'Wind vest' }],
    },
    UV_EXTREME: {
      items: [
        { icon: 'Sunscreen', label: 'Sunscreen' },
        { icon: 'Glasses', label: 'Sunglasses' },
      ],
    },
    UV_HIGH: {
      items: [{ icon: 'Sunscreen', label: 'Sunscreen' }],
    },
    MUGGY: {
      items: [{ icon: 'Shirt', label: 'Mesh base layer' }],
    },
  },
};

// Rain and daylight notes render as stickers beside the "Hour by hour" title, so
// keep each to ~20 characters: longer ones wrap and push the chart down.
export const RAIN_MESSAGES = {
  CLEARING: (time: string) => `Clears by ${time}`,
  THROUGHOUT: 'Rain throughout',
  WINDOW: (start: string, end: string) => `Rain ${start}–${end}`,
  LATER: (time: string) => `Rain after ${time}`,
};

export const DAYLIGHT_MESSAGES = {
  DARK_WARNING: 'After dark: lights on',
};

export const ALERT_MESSAGES = {
  HEAT_EXTREME: (tempLabel: string) =>
    `Feels like ${tempLabel}. Serious heat-stroke risk. Not a ride day.`,
  HEAT_WARNING: (tempLabel: string) =>
    `Feels like ${tempLabel}. High risk of heat exhaustion. Ride early, or ride indoors.`,
};

/** Capitalizes the first character of a string, preserving the remainder. */
function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * Formats a list of verdict issue phrases into a natural-language sentence,
 * capitalizing the first letter, lowercasing non-initial phrases, and joining
 * with commas and an Oxford comma before the final "and".
 *
 * Examples:
 * - `['fog']` -> `"Fog."`
 * - `['fog', 'rain likely']` -> `"Fog and rain likely."`
 * - `['fog', 'windy', 'rain likely']` -> `"Fog, windy, and rain likely."`
 */
export function formatIssuesAsSentence(issues: readonly string[]): string {
  const first = issues[0];
  if (!first) return '';
  if (issues.length === 1) {
    return `${capitalizeFirst(first)}.`;
  }
  // Capitalize the first item for sentence start, and lowercase leading letters
  // of subsequent items (e.g. "Dangerous heat" -> "dangerous heat").
  const formatted = issues.map((item, idx) => {
    if (idx === 0) return capitalizeFirst(item);
    return item.charAt(0).toLowerCase() + item.slice(1);
  });
  if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}.`;
  }
  const last = formatted.at(-1);
  const rest = formatted.slice(0, -1).join(', ');
  return `${rest}, and ${last}.`;
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The verdict's detail line, shared by the home card and the widget: the
 * conditions on a ride day, else what's wrong. In the wait state it leads with
 * what's wrong right now, so a good later window doesn't read as "go now".
 */
export function formatVerdictDetail(status: RideStatus, message: VerdictMessage): string {
  // With no single issue to name (a thunderstorm, say), the lead is a full
  // sentence ("Thunderstorms expected. Stay off the road.") and says why.
  const detail =
    status === 'yes' ? message.lead : formatIssuesAsSentence(message.issues) || message.lead;
  if (!message.now) return detail;
  const now = STATUS_MESSAGES.RIGHT_NOW(lowerFirst(message.now));
  return detail ? `${now} Then ${lowerFirst(detail)}` : now;
}

/**
 * Home climate settings copy, shared by the iOS and web forms so they can't
 * drift apart. Ranges are the temperatures that still rate a ride day.
 */
export const CLIMATE_MESSAGES = {
  // The section is titled "Home climate", so rows don't repeat "home".
  TOGGLE: 'Adapt ratings',
  LOCATION: 'Location',
  QUESTION: 'How often do you ride outside?',
  // Names the place turning it on would use: "current location" read as GPS,
  // but it's whatever place the forecast is showing.
  HINT_OFF: (place: string | null) =>
    place
      ? `Tunes ratings to ${place}’s climate, hot or cold. How much depends on how often you ride outside.`
      : 'Tunes ratings to your climate, hot or cold. Pick a place first, then turn this on.',
  BASIS: (place: string) => `Based on the last 30 days in ${place}.`,
  AUTO_FROM_SEARCH: 'Set from the first place you searched. Tap Location to change it.',
  STANDARD: (range: string) => `The standard range applies: ride days run ${range}.`,
  NO_SHIFT: (range: string) =>
    `Your home’s weather is close to the standard, so ride days run ${range}.`,
  SHIFTED: (range: string, normal: string) =>
    `Ride days run ${range} for you (normally ${normal}).`,
  HUMIDITY: (dew: string, normal: string) =>
    `Humid days stay rideable up to a ${dew} dew point (normally ${normal}).`,
};

/**
 * Centralized copywriting for the Wheely Weather app.
 * Separates human-readable strings from core weather logic.
 */

import type { RideStatus } from '@/types/weather';

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
    'Clear for riding',
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
    'Proceed with caution',
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
 * Picks a verdict badge label from a per-status pool, seeded by location and
 * the current day+hour so different locations show different labels and the
 * label rotates when the forecast hour rolls over.
 */
export function getVerdictLabel(status: RideStatus, location = ''): string {
  const pool = VERDICT_LABELS[status];
  const now = new Date();
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 864e5);
  const hour = now.getHours();
  const seed = `${status}|${location}|${day}|${hour}`;
  return pool[seededHash(seed) % pool.length] ?? '';
}

export const LOCATION_SOURCE_BADGES = {
  manual: {
    label: 'Custom location',
    title: 'Showing a place you set by search',
  },
  device: {
    label: 'Device location',
    title: "Showing your device's current location",
  },
};

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

type IssueTier = 'bad' | 'poor' | 'marginal';

/**
 * Shared per-metric severity phrasing. Both the verdict hero's issue chips and
 * the hourly chart's reason drawer build from this table so the same metric is
 * always described with the same words.
 */
export const ISSUE_PHRASES = {
  WIND: (mph: number, tier: IssueTier): string =>
    ({
      bad: `Very windy (${mph} mph)`,
      poor: `Windy (${mph} mph)`,
      marginal: `Breezy (${mph} mph)`,
    })[tier],
  GUSTS: (mph: number, tier: IssueTier): string =>
    tier === 'bad' ? `Strong gusts (${mph} mph gusts)` : `Gusty (${mph} mph gusts)`,
  RAIN: (pct: string, tier: IssueTier): string =>
    ({
      bad: `Rain likely (${pct})`,
      poor: `Rain risk (${pct})`,
      marginal: `Rain possible (${pct})`,
    })[tier],
  HEAT: (tempLabel: string, tier: IssueTier): string =>
    ({
      bad: `Dangerous heat (${tempLabel})`,
      poor: `Very hot (${tempLabel})`,
      marginal: `Hot (${tempLabel})`,
    })[tier],
  COLD: (tempLabel: string, tier: IssueTier): string =>
    ({
      bad: `Freezing (${tempLabel})`,
      poor: `Cold (${tempLabel})`,
      marginal: `Chilly (${tempLabel})`,
    })[tier],
  HUMIDITY: (dewLabel: string, tier: IssueTier): string =>
    ({
      bad: `Oppressive humidity (dew ${dewLabel})`,
      poor: `Very humid (dew ${dewLabel})`,
      marginal: `Muggy (dew ${dewLabel})`,
    })[tier],
  AQI: (aqi: number, tier: IssueTier): string =>
    tier === 'marginal' ? `Hazy (AQI ${aqi})` : `Poor air (AQI ${aqi})`,
};

export const STATUS_MESSAGES = {
  THUNDERSTORM: 'Thunderstorms today. Stay off the road.',
  GOOD: (tempLabel: string, cond: string) =>
    `${tempLabel}, ${cond.toLowerCase()}, with light winds.`,
  MAYBE_IDEAL: 'On the edge of comfortable.',
  MAYBE_LEAD: 'Rideable, but:',
  LATER_GOOD: (time: string) => `Improves around ${time}`,
  NO_IDEAL: 'No clear ride window right now.',
  NO_LEAD: 'Sit this one out:',
  CLEAR_UP: (time: string) => `Clears by ${time}`,
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
      items: [{ icon: 'CloudRain', label: 'Rain jacket' }],
    },
    RAIN_POSSIBLE: {
      items: [{ icon: 'Umbrella', label: 'Quick-dry layer' }],
    },
    WINDY: {
      items: [{ icon: 'Wind', label: 'Windbreaker' }],
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
        { icon: 'Footprints', label: 'Shoe covers' },
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
        { icon: 'Thermometer', label: 'Arm warmers' },
        { icon: 'Thermometer', label: 'Knee warmers' },
        { icon: 'Layers', label: 'Gilet' },
      ],
    },
    MILD_COOL: {
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'BibShorts', label: 'Bib shorts' },
        { icon: 'Thermometer', label: 'Arm warmers' },
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
      items: [{ icon: 'Thermometer', label: 'Gilet or arm warmers' }],
    },
    RAIN_HIGH: {
      items: [
        { icon: 'CloudRain', label: 'Rain jacket' },
        { icon: 'Footprints', label: 'Shoe covers' },
      ],
    },
    RAIN_POSSIBLE: {
      items: [{ icon: 'Umbrella', label: 'Packable vest or shell' }],
    },
    WINDY: {
      items: [{ icon: 'Wind', label: 'Wind vest' }],
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

export const RAIN_MESSAGES = {
  CLEARING: (time: string) => `Clears by ${time}`,
  THROUGHOUT: 'Rain throughout',
  WINDOW: (start: string, end: string) => `Rain ${start}–${end}`,
  LATER: (time: string) => `Rain likely after ${time}`,
};

export const DAYLIGHT_MESSAGES = {
  DARK_WARNING: 'Best ride window falls in dark hours. Front and rear lights essential.',
};

export const ALERT_MESSAGES = {
  HEAT_EXTREME: (tempLabel: string) =>
    `Dangerously hot, ${tempLabel} felt. Serious heat stroke risk. Not a ride day.`,
  HEAT_WARNING: (tempLabel: string) =>
    `Very hot, ${tempLabel} felt. High risk of heat exhaustion. Ride early, or ride indoors.`,
};

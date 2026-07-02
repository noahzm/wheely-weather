/**
 * Centralized copywriting for the Wheely Weather app.
 * Separates human-readable strings from core weather logic.
 */

/** @typedef {import('@/types/weather').GearTip} GearTip */

// Stable pick helper to prevent flickering on re-renders.
/** @template T @param {T[]} arr */
const pick = (arr) => arr[new Date().getHours() % arr.length];

/** djb2-style hash for deterministic, seed-varied picks.
 * @param {string} str */
function seededHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // `| 0` is an intentional 32-bit wrap (not Math.trunc) and charCodeAt hashes
    // per UTF-16 code unit — both are required for stable djb2 hash values.
    // eslint-disable-next-line unicorn/prefer-math-trunc, unicorn/prefer-code-point
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const VERDICT_LABELS = {
  yes: ['Let’s ride', 'Good to go', 'Ride day', 'Wheels up', 'Clear for riding', 'Send it'],
  maybe: [
    'Not terrible',
    'Borderline',
    'Could go either way',
    'Rideable, barely',
    'Proceed with caution',
    'Sketchy but doable',
  ],
  no: [
    'Probably shouldn’t',
    'Sit this one out',
    'Rest day',
    'Skip it',
    'Off the bike today',
    'Trainer weather',
  ],
};

/**
 * Picks a verdict badge label from a per-status pool, seeded by location and
 * the current day+hour so different locations show different labels and the
 * label rotates when the forecast hour rolls over.
 * @param {'yes' | 'maybe' | 'no'} status
 * @param {string} [location]
 * @returns {string}
 */
export function getVerdictLabel(status, location = '') {
  const pool = VERDICT_LABELS[status] ?? VERDICT_LABELS.maybe;
  const now = new Date();
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 864e5);
  const hour = now.getHours();
  const seed = `${status}|${location}|${day}|${hour}`;
  return pool[seededHash(seed) % pool.length] ?? '';
}

/** @param {string[]} items */
function formatList(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

/** Tail appended to a verdict sentence when issues were trimmed for brevity.
 * @param {number} extra */
function moreTail(extra) {
  return extra > 0 ? `, plus ${extra} more` : '';
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

/** @type {Record<number, string>} */
export const WEATHER_DESCRIPTIONS = {
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

export const STATUS_MESSAGES = {
  THUNDERSTORM: 'Thunderstorms today. Stay off the road.',
  /** @param {string} tempLabel @param {string} cond */
  GOOD: (tempLabel, cond) =>
    `Ideal ride conditions. ${tempLabel}, ${cond.toLowerCase()}, and light winds.`,
  MAYBE_IDEAL: 'On the edge of comfortable.',
  /** @param {string[]} issues @param {number} [extra] */
  MAYBE_ISSUES: (issues, extra = 0) =>
    `Rideable. But it’s ${formatList(issues)}${moreTail(extra)}.`,
  /** @param {string} time */
  LATER_GOOD: (time) => ` Conditions improve around ${time}.`,
  NO_IDEAL: 'No clear ride window right now.',
  /** @param {string[]} issues @param {number} [extra] */
  NO_ISSUES: (issues, extra = 0) => `Sit this one out: ${formatList(issues)}${moreTail(extra)}.`,
  /** @param {string} time */
  CLEAR_UP: (time) => ` Clears by ${time}.`,
  REST_DAY: () =>
    pick([
      ' A good day for drivetrain maintenance.',
      ' A good day to wax the chain.',
      ' Time well spent on the indoor trainer.',
      ' Time to plan next weekend’s route.',
      ' Save the legs for a better window.',
      ' Tomorrow’s the better window.',
    ]),
};

export const BEST_DAYS_MESSAGES = {
  NONE: () =>
    pick([
      'No standout ride days this week. A good week for maintenance.',
      'A week of mixed conditions. Short windows, if any.',
      'Few standout days ahead. Keep plans loose.',
      'Tough week on the forecast. Watch for short openings.',
    ]),
};

/**
 * Gear tips return a structured shape so the UI can render glanceable rows.
 * Each tip yields { headline?, items: [{ icon, label, qualifier? }] }.
 * Temperature tips own the headline (the dominant kit decision); other tips
 * contribute supporting items.
 */
/**
 * Gear tips return a structured shape so the UI can render glanceable rows.
 * Each tip yields { headline?, items: [{ icon, label, qualifier? }] }.
 * Ride Kit is clothing-only: no hydration, food, or route guidance. Sleeve
 * and leg lengths are made explicit in labels so the rider sees the decision
 * at a glance.
 */
export const GEAR_TIPS = {
  CASUAL: {
    FREEZING: {
      headline: 'Heavy winter layers',
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Long-sleeve thermal base layer' },
        { icon: 'Jacket', label: 'Insulated jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Long pants' },
        { icon: 'Hand', label: 'Insulated gloves' },
        { icon: 'Snowflake', label: 'Wool cap and ear coverage' },
      ],
    },
    COLD: {
      headline: 'Bundle up.',
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Long-sleeve top' },
        { icon: 'Jacket', label: 'Jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Long pants' },
        { icon: 'Hand', label: 'Gloves' },
        { icon: 'Snowflake', label: 'Wool cap' },
      ],
    },
    COOL: {
      headline: 'Light layers',
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Long-sleeve shirt or hoodie' },
        { slot: 'bottom', icon: 'Pants', label: 'Pants or heavier shorts' },
      ],
    },
    MILD_COOL: {
      headline: 'Mild and cool',
      items: [
        {
          slot: 'top',
          icon: 'Shirt',
          label: 'Short sleeve or light long sleeve',
        },
        { slot: 'bottom', icon: 'Shorts', label: 'Shorts or light pants' },
      ],
    },
    HOT: {
      headline: 'Light and airy',
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Short-sleeve top' },
        { slot: 'bottom', icon: 'Shorts', label: 'Shorts' },
      ],
    },
    SCORCHING: {
      headline: 'Beat the heat.',
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Light short-sleeve top' },
        { slot: 'bottom', icon: 'Shorts', label: 'Shorts' },
      ],
    },
    PERFECT: () => ({
      headline: pick([
        'Ideal conditions for taking the long way home.',
        'Beautiful riding weather. A day for an extra loop or coffee stop.',
        'Conditions favor extra miles.',
      ]),
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Short-sleeve top' },
        { slot: 'bottom', icon: 'Shorts', label: 'Shorts' },
      ],
    }),
    NEUTRAL: {
      items: [
        { slot: 'top', icon: 'Shirt', label: 'Short-sleeve top' },
        { slot: 'bottom', icon: 'Shorts', label: 'Shorts' },
      ],
    },
    /** @param {string} min @param {string} max */
    TEMP_SWING: (min, max) => ({
      items: [
        {
          icon: 'Thermometer',
          label: 'Removable layer',
          qualifier: `${min} to ${max} across the ride`,
        },
      ],
    }),
    RAIN_HIGH: {
      items: [
        {
          icon: 'CloudRain',
          label: 'Rain jacket',
          qualifier: 'High chance of rain',
        },
      ],
    },
    RAIN_COMING: {
      items: [
        {
          icon: 'CloudRain',
          label: 'Rain jacket',
          qualifier: 'Rain moves in soon',
        },
      ],
    },
    RAIN_POSSIBLE: {
      items: [
        {
          icon: 'Umbrella',
          label: 'A layer you can get damp',
          qualifier: 'Rain possible',
        },
      ],
    },
    RAIN_LATER: {
      items: [
        {
          icon: 'Umbrella',
          label: 'Light shell in the bag',
          qualifier: 'Rain possible later',
        },
      ],
    },
    WINDY: {
      items: [{ icon: 'Wind', label: 'Windbreaker', qualifier: 'Windy conditions' }],
    },
    /** @param {number} speed */
    WIND_PICKUP: (speed) => ({
      items: [
        {
          icon: 'Wind',
          label: 'Windbreaker',
          qualifier: `Wind builds to ${speed} mph`,
        },
      ],
    }),
    UV_EXTREME: () => ({
      items: [
        {
          icon: 'Sun',
          label: 'Sunscreen',
          qualifier: pick(['Very high UV', 'Extreme UV']),
        },
        { icon: 'Glasses', label: 'Sunglasses' },
      ],
    }),
    UV_HIGH: {
      items: [{ icon: 'Sun', label: 'Sunscreen', qualifier: 'High UV' }],
    },
    MUGGY: {
      items: [
        {
          slot: 'top',
          icon: 'Shirt',
          label: 'Moisture-wicking short-sleeve top',
          qualifier: 'Muggy conditions',
        },
      ],
    },
  },
  PRO: {
    FREEZING: {
      headline: 'Full winter kit',
      items: [
        { icon: 'Shirt', label: 'Long-sleeve thermal base layer' },
        { icon: 'Jacket', label: 'Insulated jacket' },
        { slot: 'bottom', icon: 'Pants', label: 'Winter bib tights' },
        { icon: 'Footprints', label: 'Shoe covers' },
        { icon: 'Hand', label: 'Heavy full-finger gloves' },
        { icon: 'Snowflake', label: 'Ear and face coverage' },
      ],
    },
    COLD: {
      headline: 'Cold-weather kit',
      items: [
        { icon: 'Shirt', label: 'Long-sleeve base layer' },
        { icon: 'Shirt', label: 'Long-sleeve jersey' },
        { slot: 'bottom', icon: 'Pants', label: 'Thermal bib tights' },
        { icon: 'Hand', label: 'Full-finger gloves' },
        { icon: 'Jacket', label: 'Vest or jacket' },
      ],
    },
    COOL: {
      headline: 'Short sleeve with warmers',
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
        { icon: 'Thermometer', label: 'Arm warmers' },
        { icon: 'Thermometer', label: 'Knee warmers' },
        { icon: 'Layers', label: 'Gilet', qualifier: 'for descents' },
      ],
    },
    MILD_COOL: {
      headline: 'Jersey and bibs',
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
        {
          icon: 'Thermometer',
          label: 'Arm warmers',
          qualifier: 'for a cool start or long descent',
        },
      ],
    },
    HOT: {
      headline: 'Lightweight jersey and bibs',
      items: [
        { icon: 'Shirt', label: 'Lightweight short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
      ],
    },
    SCORCHING: {
      headline: 'Beat the heat.',
      items: [
        { icon: 'Shirt', label: 'Lightweight short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
      ],
    },
    PERFECT: () => ({
      headline: pick([
        'Ideal weather for a fast ride.',
        'Conditions are ideal. A day for a longer route or a hard effort.',
        'Prime jersey-and-bibs weather.',
        'Clean roads, good weather, fresh legs. A day worth making count.',
      ]),
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
      ],
    }),
    NEUTRAL: {
      items: [
        { icon: 'Shirt', label: 'Short-sleeve jersey' },
        { slot: 'bottom', icon: 'Shorts', label: 'Bib shorts' },
      ],
    },
    /** @param {string} min @param {string} max */
    TEMP_SWING: (min, max) => ({
      items: [
        {
          icon: 'Thermometer',
          label: 'Pocketed gilet or arm warmers',
          qualifier: `${min} to ${max} across the window`,
        },
      ],
    }),
    RAIN_HIGH: {
      items: [
        { icon: 'CloudRain', label: 'Rain jacket' },
        {
          icon: 'Footprints',
          label: 'Shoe covers',
          qualifier: 'High chance of rain',
        },
      ],
    },
    RAIN_COMING: {
      items: [
        {
          icon: 'CloudRain',
          label: 'Rain jacket',
          qualifier: 'Rain moves in soon',
        },
      ],
    },
    RAIN_POSSIBLE: {
      items: [
        {
          icon: 'Umbrella',
          label: 'Packable vest or shell',
          qualifier: 'Rain possible',
        },
      ],
    },
    RAIN_LATER: {
      items: [
        {
          icon: 'Umbrella',
          label: 'Light shell for the pocket',
          qualifier: 'Rain possible later',
        },
      ],
    },
    WINDY: {
      items: [{ icon: 'Wind', label: 'Wind vest', qualifier: 'Windy conditions' }],
    },
    /** @param {number} speed */
    WIND_PICKUP: (speed) => ({
      items: [
        {
          icon: 'Wind',
          label: 'Wind vest',
          qualifier: `Wind builds to ${speed} mph`,
        },
      ],
    }),
    UV_EXTREME: () => ({
      items: [
        {
          icon: 'Sun',
          label: 'Sunscreen on arms and legs',
          qualifier: pick(['Very high UV', 'Extreme UV']),
        },
        { icon: 'Glasses', label: 'Sunglasses' },
      ],
    }),
    UV_HIGH: {
      items: [{ icon: 'Sun', label: 'Sunscreen', qualifier: 'High UV' }],
    },
    MUGGY: {
      items: [
        {
          icon: 'Shirt',
          label: 'Mesh base layer',
          qualifier: 'Muggy conditions',
        },
      ],
    },
  },
};

export const RAIN_MESSAGES = {
  /** @param {string} time */
  CLEARING: (time) => `Clears by ${time}`,
  THROUGHOUT: 'Rain throughout',
  /** @param {string} start @param {string} end */
  WINDOW: (start, end) => `Rain ${start}–${end}`,
  /** @param {string} time */
  LATER: (time) => `Rain likely after ${time}`,
};

export const DAYLIGHT_MESSAGES = {
  DARK_WARNING: 'Best ride window falls in dark hours. Front and rear lights essential.',
};

export const ALERT_MESSAGES = {
  /** @param {string} tempLabel */
  HEAT_EXTREME: (tempLabel) =>
    `Dangerously hot, ${tempLabel} felt. Serious heat stroke risk. Not a ride day.`,
  /** @param {string} tempLabel */
  HEAT_WARNING: (tempLabel) =>
    `Very hot, ${tempLabel} felt. High risk of heat exhaustion. Ride early, or ride indoors.`,
};

import { BEST_DAYS_MESSAGES } from '../domain/copy';
import { THRESHOLDS } from '../domain/constants';

/** @typedef {import('@/types/weather').Condition} Condition */
/** @typedef {import('@/types/weather').DailyWeather} DailyWeather */
/** @typedef {import('@/types/weather').HourlyWeather} HourlyWeather */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORM_CODES = new Set([95, 96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** Returns "Today" for index 0, otherwise a short label like "Mon 24". */
/** @param {Date | string} date @param {number} index */
export function dayLabel(date, index) {
  if (index === 0) return 'Today';
  const d = new Date(date);
  const weekday = DAY_NAMES_SHORT[d.getDay()];
  const num = d.getDate();
  return `${weekday} ${num}`;
}

/** @type {Record<Condition, number>} */
const CONDITION_SCORE = {
  good: 300,
  fair: 200,
  marginal: 100,
  poor: 0,
  bad: -100,
};

// Prefer overall ride quality first, then reward calmer, drier, more comfortable days.
/** @param {DailyWeather} day */
function scoreDay(day) {
  const conditionScore = CONDITION_SCORE[day.condition] ?? 0;

  const rainBonus = Math.max(0, 30 - (day.rainChance ?? 30)) * 1.5;
  const windBonus = Math.max(0, 18 - (day.windSpeed ?? 18)) * 1.5;
  const avgTemp = ((day.high ?? 68) + (day.low ?? day.high ?? 68)) / 2;
  const comfortBonus = Math.max(0, 18 - Math.abs(avgTemp - 68));

  return conditionScore + rainBonus + windBonus + comfortBonus;
}

/** @param {DailyWeather} day */
function bestDayRationale(day) {
  const rain = day.rainChance ?? 100;
  const wind = day.windSpeed ?? 99;
  const high = day.high ?? 0;
  if (rain <= 10 && wind <= 8) return 'Low wind and dry roads';
  if (high < 50 && rain <= 20) return 'Cool and clear';
  if (high > 80 && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Solid riding weather';
}

/** Finds the index and rationale of the single best day for cycling in the 8-day forecast. */
/** @param {DailyWeather[]} daily */
export function getBestDayInfo(daily) {
  if (!daily || daily.length === 0) return { index: -1, rationale: '' };

  let bestIdx = -1;
  let bestScore = -Infinity;

  for (const [i, day] of daily.entries()) {
    const s = scoreDay(day);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return { index: -1, rationale: '' };

  const bestDay = daily[bestIdx];
  if (!bestDay || !['good', 'fair'].includes(bestDay.condition)) {
    return { index: -1, rationale: '' };
  }

  return { index: bestIdx, rationale: bestDayRationale(bestDay) };
}

/**
 * @typedef {Object} DayMetrics
 * @property {number} wind
 * @property {number} rain
 * @property {number | null} high
 * @property {number | null} low
 * @property {number | null} feelsLike
 * @property {number | null} dewpoint
 */

/** @param {DailyWeather} day @returns {DayMetrics} */
function dayMetrics(day) {
  const high = day.high ?? null;
  return {
    wind: Math.round(day.windSpeed ?? 0),
    rain: day.rainChance ?? 0,
    high,
    low: day.low ?? high,
    feelsLike: day.feelsLike ?? high,
    dewpoint: day.dewpoint ?? null,
  };
}

/** @param {{ weatherCode: number | null }} entry @returns {string | null} */
function weatherCodeReason(entry) {
  if (entry.weatherCode == null) return null;
  if (STORM_CODES.has(entry.weatherCode)) return 'Storm risk';
  if (SNOW_CODES.has(entry.weatherCode)) return 'Wintry roads';
  if (HEAVY_RAIN_CODES.has(entry.weatherCode)) return 'Heavy rain risk';
  return null;
}

/** @param {DayMetrics} m */
function badDayReason({ wind, rain, high, low, feelsLike, dewpoint }) {
  if (wind >= 20) return `Very windy (${wind} mph)`;
  if (rain >= 60) return `Rain likely (${rain}%)`;
  if (feelsLike != null && feelsLike > THRESHOLDS.FEELS_LIKE.BAD_MAX) {
    return `Dangerous heat (feels like ${Math.round(feelsLike)}°)`;
  }
  if (high != null && high > 95) return `Dangerous heat (${high}°)`;
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.BAD) {
    return `Oppressive humidity (dew ${Math.round(dewpoint)}°)`;
  }
  if (low != null && low < 32) return 'Freezing temps';
  return 'Rough day to ride';
}

/** @param {DayMetrics} m */
function poorDayReason({ wind, rain, high, low, feelsLike, dewpoint }) {
  if (wind >= 18) return `Windy (${wind} mph)`;
  if (rain >= 45) return `Wet roads likely`;
  if (feelsLike != null && feelsLike > THRESHOLDS.FEELS_LIKE.POOR_MAX) {
    return `Very hot (feels like ${Math.round(feelsLike)}°)`;
  }
  if (high != null && high > 90) return `Hot afternoon`;
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.POOR) {
    return `Very humid (dew ${Math.round(dewpoint)}°)`;
  }
  if (low != null && low < 36) return 'Cold start';
  return 'Tough riding';
}

/** @param {DayMetrics} m */
function marginalDayReason({ wind, rain, high, low, feelsLike, dewpoint }) {
  if (wind >= 15) return `Breezy (${wind} mph)`;
  if (rain >= 30) return `Some rain risk`;
  if (feelsLike != null && feelsLike > THRESHOLDS.FEELS_LIKE.MARGINAL_MAX) {
    return `Hot feel (${Math.round(feelsLike)}°)`;
  }
  if (high != null && high > 85) return 'Warm afternoon';
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.MARGINAL) {
    return `Muggy (dew ${Math.round(dewpoint)}°)`;
  }
  if (low != null && low < 45) return 'Cool start';
  return 'Mixed conditions';
}

/** @param {DayMetrics} m */
function fairDayReason({ wind, rain, high }) {
  if (wind >= 12) return 'Breezy';
  if (rain > 15) return 'Chance of rain';
  if (high != null && high < 50) return 'Cool but clear';
  if (high != null && high > 87) return 'Warm but workable';
  return 'Fair window';
}

/** @param {DayMetrics} m */
function idealDayReason({ wind, rain, high }) {
  if (rain <= 10 && wind <= 8) return 'Low wind and dry';
  if (high != null && high < 50 && rain <= 20) return 'Cool and clear';
  if (high != null && high > 80 && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Prime riding weather';
}

/** @param {HourlyWeather} hour @returns {DayMetrics} */
function hourMetrics(hour) {
  const feelsLike = hour.feelsLike ?? null;
  return {
    wind: Math.round(hour.windSpeed ?? 0),
    rain: hour.rainChance ?? 0,
    high: null,
    low: feelsLike,
    feelsLike,
    dewpoint: hour.dewpoint ?? null,
  };
}

/** Builds a short explanation for why an hourly point is limiting to ride. */
/** @param {HourlyWeather} hour @returns {string | null} */
export function getHourConditionReason(hour) {
  const codeReason = weatherCodeReason(hour);
  if (codeReason) return codeReason;

  if (hour.condition === 'good' || hour.condition === 'fair') return null;

  const m = hourMetrics(hour);
  switch (hour.condition) {
    case 'bad': {
      return badDayReason(m);
    }
    case 'poor': {
      return poorDayReason(m);
    }
    case 'marginal': {
      return marginalDayReason(m);
    }
    default: {
      return null;
    }
  }
}

/** Builds a short explanation for why a daily card rates the way it does. */
/** @param {DailyWeather} day */
export function getDayConditionReason(day) {
  const codeReason = weatherCodeReason(day);
  if (codeReason) return codeReason;

  const m = dayMetrics(day);
  switch (day.condition) {
    case 'bad': {
      return badDayReason(m);
    }
    case 'poor': {
      return poorDayReason(m);
    }
    case 'marginal': {
      return marginalDayReason(m);
    }
    case 'fair': {
      return fairDayReason(m);
    }
    default: {
      return idealDayReason(m);
    }
  }
}

/** @param {string} value */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** @param {DailyWeather} day @param {number} index */
function blurbDayLabel(day, index) {
  return index === 0 ? 'today' : (DAY_NAMES[new Date(day.date).getDay()] ?? '');
}

/** @param {string[]} labels */
function joinDayLabels(labels) {
  if (labels.length === 0) return '';
  if (labels.length === 1) return capitalize(labels[0] ?? '');
  if (labels.length === 2)
    return `${capitalize(labels[0] ?? '')} and ${capitalize(labels[1] ?? '')}`;
  const last = labels.at(-1) ?? '';
  const leading = labels
    .slice(0, -1)
    .map((label) => capitalize(label))
    .join(', ');
  return `${leading}, and ${capitalize(last)}`;
}

/** Builds a sentence listing the best cycling days this week. */
/** @param {DailyWeather[]} daily @param {number} bestDayIdx @param {string} rationale */
export function getBestDaysBlurb(daily, bestDayIdx, rationale) {
  const preferredDays = daily
    .map((day, i) => ({ day, i, label: blurbDayLabel(day, i) }))
    .filter(({ day }) => day.condition === 'good')
    .map(({ i, label }) => ({ i, label }));

  const workableDays = daily
    .map((day, i) => ({ day, i, label: blurbDayLabel(day, i) }))
    .filter(({ day }) => day.condition === 'fair')
    .map(({ i, label }) => ({ i, label }));

  const chosenDays = preferredDays.length > 0 ? preferredDays : workableDays;

  if (chosenDays.length === 0) {
    return BEST_DAYS_MESSAGES.NONE();
  }

  const bestDay = chosenDays.find(({ i }) => i === bestDayIdx) ?? chosenDays[0];
  if (!bestDay) return BEST_DAYS_MESSAGES.NONE();
  const otherDays = chosenDays.filter(({ i }) => i !== bestDay.i).map(({ label }) => label);
  const descriptor = preferredDays.length > 0 ? 'solid ride windows' : 'workable windows';

  const bestSentence =
    otherDays.length === 0
      ? `${capitalize(bestDay.label)} is your best ride window.`
      : `${capitalize(bestDay.label)} is the best bet.`;

  const rationaleSentence = rationale ? ` ${rationale} expected.` : '';
  if (otherDays.length === 0) {
    return `${bestSentence}${rationaleSentence}`;
  }

  // Past a few qualifying days, naming each one stops being scannable.
  if (otherDays.length >= 4) {
    const summarySentence =
      preferredDays.length > 0
        ? ' Most of the week is rideable too.'
        : ' Most of the week is at least workable.';
    return `${bestSentence}${rationaleSentence}${summarySentence}`;
  }

  const otherDaysSentence =
    otherDays.length === 1
      ? ` ${joinDayLabels(otherDays)} is a ${descriptor.replace(/s$/, '')} too.`
      : ` ${joinDayLabels(otherDays)} are ${descriptor} too.`;

  return `${bestSentence}${rationaleSentence}${otherDaysSentence}`;
}

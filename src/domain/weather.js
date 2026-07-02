import { THRESHOLDS } from './constants';
import { formatTemperature } from '../utils/temperature';
import {
  WEATHER_DESCRIPTIONS,
  STATUS_MESSAGES as MSG,
  GEAR_TIPS,
  RAIN_MESSAGES,
  DAYLIGHT_MESSAGES,
  ALERT_MESSAGES,
} from './copy';

/** @typedef {import('@/types/weather').Condition} Condition */
/** @typedef {import('@/types/weather').DaylightWindow} DaylightWindow */
/** @typedef {import('@/types/weather').GearSuggestion} GearSuggestion */
/** @typedef {import('@/types/weather').GearTip} GearTip */
/** @typedef {import('@/types/weather').GearTipItem} GearTipItem */
/** @typedef {import('@/types/weather').HourlyWeather} HourlyWeather */
/** @typedef {import('@/types/weather').MetricType} MetricType */
/** @typedef {import('@/types/weather').RideFactor} RideFactor */
/** @typedef {import('@/types/weather').RideStatus} RideStatus */
/** @typedef {import('@/types/weather').Weather} Weather */
/** @typedef {import('@/types/weather').WeatherAlert} WeatherAlert */
/**
 * @typedef {{
 *   minTemp: number;
 *   maxTemp: number;
 *   maxWind: number;
 *   maxRain: number;
 *   maxDewpoint: number;
 *   maxUv: number;
 * }} RideWindow
 */
/**
 * @typedef {{
 *   FREEZING: GearTip;
 *   COLD: GearTip;
 *   COOL: GearTip;
 *   MILD_COOL: GearTip;
 *   HOT: GearTip;
 *   SCORCHING: GearTip;
 *   PERFECT: () => GearTip;
 *   NEUTRAL: GearTip;
 *   TEMP_SWING: (min: string, max: string) => GearTip;
 *   RAIN_HIGH: GearTip;
 *   RAIN_COMING: GearTip;
 *   RAIN_POSSIBLE: GearTip;
 *   RAIN_LATER: GearTip;
 *   WINDY: GearTip;
 *   WIND_PICKUP: (speed: number) => GearTip;
 *   UV_EXTREME: () => GearTip;
 *   UV_HIGH: GearTip;
 *   MUGGY: GearTip;
 * }} GearTipSet
 */

export {
  getAqiLabel,
  getDewpointLabel,
  getWindArrowRotation,
  getWindDirectionLabel,
  getUvLabel,
} from '../utils/weatherLabels';

/**
 * Rates a "higher is worse" metric against ascending bad→fair thresholds.
 * @param {number} value
 * @param {{ BAD: number, POOR: number, MARGINAL: number, FAIR: number }} t
 * @returns {Condition}
 */
const rateUpperBound = (value, t) => {
  if (value > t.BAD) return 'bad';
  if (value > t.POOR) return 'poor';
  if (value > t.MARGINAL) return 'marginal';
  if (value > t.FAIR) return 'fair';
  return 'good';
};

/**
 * Rates a two-sided "comfortable band" metric (e.g. feels-like temperature)
 * where both too-low and too-high degrade the rating.
 * @param {number} value
 * @param {{ BAD_MIN: number, BAD_MAX: number, POOR_MIN: number, POOR_MAX: number, MARGINAL_MIN: number, MARGINAL_MAX: number, FAIR_MIN: number, FAIR_MAX: number }} t
 * @returns {Condition}
 */
const rateComfortBand = (value, t) => {
  if (value < t.BAD_MIN || value > t.BAD_MAX) return 'bad';
  if (value < t.POOR_MIN || value > t.POOR_MAX) return 'poor';
  if (value < t.MARGINAL_MIN || value > t.MARGINAL_MAX) return 'marginal';
  if (value < t.FAIR_MIN || value > t.FAIR_MAX) return 'fair';
  return 'good';
};

/**
 * Evaluates a single weather metric against cycling-friendly thresholds.
 * Returns "good", "fair", "marginal", "poor", or "bad" to indicate ride-ability.
 * `thresholds` defaults to the base set; pass an acclimatization-adjusted set to
 * shift the comfort dials for a rider's home climate.
 * @param {number | null | undefined} value
 * @param {MetricType} type
 * @param {typeof THRESHOLDS} [thresholds]
 * @returns {Condition}
 */
export const evaluateCondition = (value, type, thresholds = THRESHOLDS) => {
  if (value == null) return 'good';
  const T = thresholds;
  switch (type) {
    case 'temperature': {
      return rateComfortBand(value, T.TEMPERATURE);
    }
    case 'windSpeed': {
      return rateUpperBound(value, T.WIND_SPEED);
    }
    case 'windGust': {
      return rateUpperBound(value, T.WIND_GUST);
    }
    case 'rainChance': {
      return rateUpperBound(value, T.RAIN_CHANCE);
    }
    case 'aqi': {
      return rateUpperBound(value, T.AQI);
    }
    case 'dewpoint': {
      return rateUpperBound(value, T.DEWPOINT);
    }
    case 'uv': {
      return rateUpperBound(value, T.UV_INDEX);
    }
    case 'humidity': {
      return rateUpperBound(value, T.HUMIDITY);
    }
    default: {
      return 'good';
    }
  }
};

/** Returns the worse of two ratings (lower RANK = worse). */
/** @param {Condition} a @param {Condition} b */
const worseCondition = (a, b) => (RANK[a] <= RANK[b] ? a : b);

/**
 * Rates wind on the worse of sustained speed and gusts. Gusts are what actually
 * destabilize a rider, so a calm-but-gusty hour is still flagged. Falls back to
 * sustained-only when gust data is unavailable (e.g. non-US/secondary sources).
 * @param {number} windSpeed
 * @param {number | null | undefined} windGust
 * @returns {Condition}
 */
export const evaluateWind = (windSpeed, windGust, thresholds = THRESHOLDS) => {
  const sustained = evaluateCondition(windSpeed, 'windSpeed', thresholds);
  if (windGust == null) return sustained;
  return worseCondition(sustained, evaluateCondition(windGust, 'windGust', thresholds));
};

/** True when gusts are a strictly worse limiter than sustained wind. */
/** @param {number} windSpeed @param {number | null | undefined} windGust */
const isGustDriven = (windSpeed, windGust) =>
  windGust != null &&
  RANK[evaluateCondition(windGust, 'windGust')] < RANK[evaluateCondition(windSpeed, 'windSpeed')];

/** Determines the overall cycling verdict. */
/** @param {Weather} weather @param {typeof THRESHOLDS} [thresholds] @returns {RideStatus} */
export const getOverallStatus = (weather, thresholds = THRESHOLDS) => {
  if (weather.hasThunderstorms) return 'no';
  const conditions = [
    evaluateCondition(weather.temperature, 'temperature', thresholds),
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
    evaluateCondition(weather.rainChance, 'rainChance', thresholds),
    evaluateCondition(weather.dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(weather.weatherCode),
    ...(weather.aqi == null ? [] : [evaluateCondition(weather.aqi, 'aqi', thresholds)]),
  ];
  if (conditions.some((c) => c === 'bad' || c === 'poor')) return 'no';
  if (conditions.some((c) => c === 'marginal' || c === 'fair')) return 'maybe';
  return 'yes';
};

/** @param {number | null | undefined} code */
export const getWeatherDescription = (code) =>
  code == null ? 'Unknown' : WEATHER_DESCRIPTIONS[code] || 'Unknown';
/** @param {number | null | undefined} code */
export const isThunderstorm = (code) => code != null && [95, 96, 99].includes(code);

// Weather codes add context that raw rain percentages can miss, especially for storms and snow.
/** @param {number | null | undefined} code @returns {Condition} */
export const getWeatherCodeCondition = (code) => {
  if (code == null) return 'good';
  if (isThunderstorm(code)) return 'bad';
  // Freezing precipitation/fog implies ice on the road. The reference rates
  // ice/freezing as "avoid", and black ice on a fast descent is the real hazard,
  // so 48 (freezing fog) and 56/57/66/67 (freezing drizzle/rain) rate "bad".
  if ([48, 56, 57, 66, 67].includes(code)) return 'bad';
  if ([65, 75, 77, 82, 86].includes(code)) return 'poor';
  if ([55, 63, 71, 73, 81, 85].includes(code)) return 'marginal';
  if ([45, 51, 53, 61, 80].includes(code)) return 'fair';
  return 'good';
};

/** @type {Record<Condition, number>} */
const RANK = {
  bad: 0,
  poor: 1,
  marginal: 2,
  fair: 3,
  good: 4,
};

/** @type {Record<number, string>} */
const WEATHER_CODE_ISSUES = {
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'light snow showers',
  86: 'snow showers',
};

/** @param {number | null | undefined} code @param {RideStatus} status */
const getWeatherCodeIssue = (code, status) => {
  const rating = getWeatherCodeCondition(code);
  const shouldMention =
    status === 'maybe'
      ? rating === 'marginal' || rating === 'fair'
      : rating === 'bad' || rating === 'poor';
  if (!shouldMention) return null;
  return code == null ? null : (WEATHER_CODE_ISSUES[code] ?? null);
};

/** @param {Condition[]} conditions @returns {Condition} */
const getCyclingCondition = (conditions) => {
  if (conditions.includes('bad')) return 'bad';
  if (conditions.includes('poor')) return 'poor';
  if (conditions.includes('marginal')) return 'marginal';
  if (conditions.includes('fair')) return 'fair';
  return 'good';
};

/**
 * UV is intentionally excluded — it drives sunscreen/kit advice, not ride-ability.
 * @param {{ temperature: number; wind: number; gust?: number | null; rain: number; code?: number | null; dewpoint: number | null }} values
 * @param {typeof THRESHOLDS} [thresholds]
 * @returns {Condition}
 */
export const getHourlyCondition = (
  { temperature, wind, gust, rain, code, dewpoint },
  thresholds = THRESHOLDS,
) => {
  return getCyclingCondition([
    evaluateCondition(temperature, 'temperature', thresholds),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    evaluateCondition(dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(code),
  ]);
};

// `tempLow`/`tempHigh` are the coldest and warmest air temperature during the
// day's daylight (ridable) hours; temperature is rated on whichever is worse.
// This keeps the daily verdict consistent with wind/rain/dew (worst-case during
// ridable hours) instead of rating temp on the warmest moment alone. Either bound
// may be omitted.
/**
 * UV is intentionally excluded — it drives sunscreen/kit advice, not ride-ability.
 * @param {{ tempLow?: number | null; tempHigh?: number | null; wind: number; gust?: number | null; rain: number; code?: number | null; dewpoint?: number | null }} values
 * @param {typeof THRESHOLDS} [thresholds]
 * @returns {Condition}
 */
export const getDailyCondition = (
  { tempLow = null, tempHigh, wind, gust = null, rain, code, dewpoint = null },
  thresholds = THRESHOLDS,
) => {
  return getCyclingCondition([
    ...(tempLow == null ? [] : [evaluateCondition(tempLow, 'temperature', thresholds)]),
    ...(tempHigh == null ? [] : [evaluateCondition(tempHigh, 'temperature', thresholds)]),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    getWeatherCodeCondition(code),
    ...(dewpoint == null ? [] : [evaluateCondition(dewpoint, 'dewpoint', thresholds)]),
  ]);
};

/** @param {number} h */
function formatHour(h) {
  const hour = h % 24;
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// Find the next clearly better ride window, even if it improves to fair rather than perfect.
/** @param {HourlyWeather[] | undefined} hourly */
function getLaterGoodHour(hourly) {
  if (!hourly || hourly.length < 2) return null;

  const first = hourly[0];
  if (!first) return null;
  const currentRank = RANK[first.condition] ?? 0;

  for (let i = 1; i < hourly.length; i++) {
    const next = hourly[i];
    if (!next) continue;
    const nextRank = RANK[next.condition] ?? 0;
    if (nextRank >= RANK.fair && nextRank > currentRank) {
      return formatHour(next.hour);
    }
  }

  return null;
}

/** @param {Weather} weather @param {RideStatus} status @param {boolean} gustDriven */
const buildWindLabel = (weather, status, gustDriven) => {
  if (gustDriven) {
    const gusts = Math.round(weather.windGust ?? weather.windSpeed);
    return `${status === 'no' ? 'strong gusts' : 'gusty'} (${gusts} mph gusts)`;
  }
  return `${status === 'no' ? 'heavy wind' : 'gusty'} (${Math.round(weather.windSpeed)} mph)`;
};

// Keep the verdict hero punchy: list issues inline up to MAX_INLINE, but once a
// day stacks up more than that, lead with the two most ride-relevant factors
// (insertion order is temp → wind → rain → weather → dewpoint → AQI) and roll the
// rest into a "plus N more" tail. "The numbers" section carries the full detail.
const MAX_INLINE_ISSUES = 3;

/** @param {RideStatus} status @param {string[]} issues */
const selectBaseMessage = (status, issues) => {
  const extra = issues.length > MAX_INLINE_ISSUES ? issues.length - 2 : 0;
  const shown = extra > 0 ? issues.slice(0, 2) : issues;
  if (status === 'maybe') {
    return issues.length > 0 ? MSG.MAYBE_ISSUES(shown, extra) : MSG.MAYBE_IDEAL;
  }
  return issues.length > 0 ? MSG.NO_ISSUES(shown, extra) : MSG.NO_IDEAL;
};

/**
 * Collects the limiting-factor labels to mention in the verdict, in insertion
 * order (temp → wind → rain → weather → dewpoint → AQI → UV).
 * @param {Weather} weather @param {RideStatus} status @param {typeof THRESHOLDS} thresholds
 * @param {import('../utils/temperature').TempUnit} [tempUnit]
 * @returns {string[]}
 */
const collectMessageIssues = (weather, status, thresholds, tempUnit = 'fahrenheit') => {
  /** @type {string[]} */
  const issues = [];
  /**
   * @param {number | null | undefined} val
   * @param {MetricType} type
   * @param {string} label
   * @param {Condition} [ratingOverride]
   */
  const addIssue = (val, type, label, ratingOverride) => {
    const rating = ratingOverride ?? evaluateCondition(val, type, thresholds);
    if (status === 'maybe' && (rating === 'marginal' || rating === 'fair')) issues.push(label);
    if (status === 'no' && (rating === 'bad' || rating === 'poor')) issues.push(label);
  };

  const temp = formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true });
  addIssue(
    weather.temperature,
    'temperature',
    weather.temperature < 50 ? `cold (${temp})` : `hot (${temp})`,
  );
  if (status === 'no' && issues.length > 0) {
    issues[0] = weather.temperature < 36 ? `too cold (${temp})` : `too hot (${temp})`;
  }
  const gustDriven = isGustDriven(weather.windSpeed, weather.windGust);
  const windLabel = buildWindLabel(weather, status, gustDriven);
  addIssue(
    weather.windSpeed,
    'windSpeed',
    windLabel,
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
  );
  addIssue(
    weather.rainChance,
    'rainChance',
    `${status === 'no' ? 'rain' : 'rainy'} (${weather.rainChance}% chance)`,
  );
  const weatherCodeIssue = getWeatherCodeIssue(weather.weatherCode, status);
  const precipitationAlreadyExplainsWeather =
    weatherCodeIssue &&
    /(rain|drizzle|shower)/i.test(weatherCodeIssue) &&
    issues.some((issue) => /\brain\b/i.test(issue));
  if (weatherCodeIssue && !precipitationAlreadyExplainsWeather) {
    issues.push(weatherCodeIssue);
  }
  addIssue(
    weather.dewpoint,
    'dewpoint',
    `${status === 'no' ? 'heavy humidity' : 'sticky'} (dew ${formatTemperature(weather.dewpoint, tempUnit, { withUnitLabel: true })})`,
  );
  if (weather.aqi != null) {
    addIssue(
      weather.aqi,
      'aqi',
      `${status === 'no' ? 'poor air quality' : 'hazy'} (AQI ${weather.aqi})`,
    );
  }
  return issues;
};

/** @param {Weather} weather @param {RideStatus} status @param {typeof THRESHOLDS} [thresholds] @param {import('../utils/temperature').TempUnit} [tempUnit] */
export const getMessage = (weather, status, thresholds = THRESHOLDS, tempUnit = 'fahrenheit') => {
  if (weather.hasThunderstorms) return MSG.THUNDERSTORM;
  if (status === 'yes') {
    return MSG.GOOD(
      formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
      weather.condition,
    );
  }

  const laterGood = getLaterGoodHour(weather.hourly);
  const issues = collectMessageIssues(weather, status, thresholds, tempUnit);

  let msg = selectBaseMessage(status, issues);

  if (laterGood) msg += status === 'maybe' ? MSG.LATER_GOOD(laterGood) : MSG.CLEAR_UP(laterGood);
  else if (status === 'no') msg += MSG.REST_DAY();

  return msg;
};

/** Returns up to 3 limiting ride factors with label, value, and condition rating. */
/** @param {Weather | null | undefined} weather @param {RideStatus | null | undefined} status @param {typeof THRESHOLDS} [thresholds] @param {import('../utils/temperature').TempUnit} [tempUnit] @returns {RideFactor[]} */
export const getRideFactors = (
  weather,
  status,
  thresholds = THRESHOLDS,
  tempUnit = 'fahrenheit',
) => {
  if (!weather || !status || status === 'yes') return [];

  /** @param {Condition} rating */
  const isLimiting = (rating) => {
    if (status === 'no') return rating === 'bad' || rating === 'poor';
    if (status === 'maybe') return rating === 'marginal' || rating === 'fair';
    return false;
  };

  /** @type {RideFactor[]} */
  const factors = [];

  const tempRating = evaluateCondition(weather.temperature, 'temperature', thresholds);
  if (isLimiting(tempRating)) {
    factors.push({
      type: 'temperature',
      label: 'Temperature',
      value: formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true }),
      condition: tempRating,
    });
  }

  const windRating = evaluateWind(weather.windSpeed, weather.windGust, thresholds);
  if (isLimiting(windRating)) {
    factors.push({
      type: 'windSpeed',
      label: 'Wind',
      value: isGustDriven(weather.windSpeed, weather.windGust)
        ? `${Math.round(weather.windGust ?? weather.windSpeed)} mph gusts`
        : `${Math.round(weather.windSpeed)} mph`,
      condition: windRating,
    });
  }

  const rainRating = evaluateCondition(weather.rainChance, 'rainChance', thresholds);
  if (isLimiting(rainRating)) {
    factors.push({
      type: 'rainChance',
      label: 'Rain',
      value: `${weather.rainChance}% chance`,
      condition: rainRating,
    });
  }

  const dewRating = evaluateCondition(weather.dewpoint, 'dewpoint', thresholds);
  if (isLimiting(dewRating)) {
    factors.push({
      type: 'dewpoint',
      label: 'Humidity',
      value: `Dew ${formatTemperature(weather.dewpoint, tempUnit, { withUnitLabel: true })}`,
      condition: dewRating,
    });
  }

  if (weather.aqi != null) {
    const aqiRating = evaluateCondition(weather.aqi, 'aqi', thresholds);
    if (isLimiting(aqiRating)) {
      factors.push({
        type: 'aqi',
        label: 'Air quality',
        value: `AQI ${weather.aqi}`,
        condition: aqiRating,
      });
    }
  }

  const codeRating = getWeatherCodeCondition(weather.weatherCode);
  if (isLimiting(codeRating)) {
    factors.push({
      type: 'weatherCode',
      label: 'Conditions',
      value: getWeatherDescription(weather.weatherCode),
      condition: codeRating,
    });
  }

  factors.sort((a, b) => RANK[a.condition] - RANK[b.condition]);
  return factors.slice(0, 3);
};

/** Returns a concise best-window message for the hourly forecast. */
/** @param {HourlyWeather[] | undefined} hourly */
export const getBestRideWindow = (hourly) => {
  if (!hourly || hourly.length === 0) return null;
  if (hourly[0]?.condition === 'good') return 'Best now';
  const later = getLaterGoodHour(hourly);
  if (later) return `Improves around ${later}`;
  return 'No clear window in the next 24 hours';
};

/** @param {HourlyWeather[] | undefined} hourly */
export const getRainTiming = (hourly) => {
  if (!hourly || hourly.length === 0) return null;
  const rainThreshold = THRESHOLDS.RAIN_CHANCE.MARGINAL;
  const firstRainIdx = hourly.findIndex((h) => h.rainChance > rainThreshold);
  if (firstRainIdx === -1) return null;

  let lastRainIdx = firstRainIdx;
  while (
    lastRainIdx + 1 < hourly.length &&
    (hourly[lastRainIdx + 1]?.rainChance ?? 0) > rainThreshold
  ) {
    lastRainIdx += 1;
  }

  const firstRain = hourly[firstRainIdx];
  const lastRain = hourly[lastRainIdx];
  if (!firstRain || !lastRain) return null;
  const isRainingNow = firstRainIdx === 0;
  const clearsUp = lastRainIdx < hourly.length - 1;

  if (isRainingNow && clearsUp) return RAIN_MESSAGES.CLEARING(formatHour(lastRain.hour + 1));
  // THROUGHOUT means rain persists through the entire visible window, not necessarily the whole day.
  if (isRainingNow) return RAIN_MESSAGES.THROUGHOUT;
  if (clearsUp)
    return RAIN_MESSAGES.WINDOW(formatHour(firstRain.hour), formatHour(lastRain.hour + 1));
  return RAIN_MESSAGES.LATER(formatHour(firstRain.hour));
};

/** @param {HourlyWeather[] | undefined} hourly @param {DaylightWindow | null | undefined} daylight */
export const getDaylightWarning = (hourly, daylight) => {
  if (!hourly || !daylight) return null;
  const { sunriseHour, sunsetHour } = daylight;
  const goodHours = hourly.filter((h) => h.condition === 'good' || h.condition === 'fair');
  if (goodHours.length === 0) return null;
  if (goodHours.every((h) => h.hour < sunriseHour || h.hour >= sunsetHour))
    return DAYLIGHT_MESSAGES.DARK_WARNING;
  return null;
};

/** @param {Weather} weather @returns {RideWindow} */
function getRideWindow(weather) {
  const upcoming = (weather.hourly || []).slice(0, 4);
  const startConditions = upcoming[0] || weather;
  return {
    minTemp:
      upcoming.length > 0
        ? Math.min(...upcoming.map((h) => h.feelsLike))
        : startConditions.feelsLike,
    maxTemp:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.feelsLike))
        : startConditions.feelsLike,
    maxWind:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.windSpeed))
        : startConditions.windSpeed,
    maxRain:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.rainChance))
        : startConditions.rainChance,
    maxDewpoint:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.dewpoint ?? 0))
        : (startConditions.dewpoint ?? 0),
    maxUv:
      upcoming.length > 0 ? Math.max(...upcoming.map((h) => h.uv ?? 0)) : (weather.uvIndex ?? 0),
  };
}

/** @param {GearTip | (() => GearTip)} tip @returns {GearTip} */
const resolveTip = (tip) => (typeof tip === 'function' ? tip() : tip);

/** @param {RideWindow} w @param {GearTipSet} tipsSet @returns {GearTip[]} */
function getTemperatureTips(w, tipsSet) {
  /** @type {GearTip[]} */
  const tips = [];

  if (w.minTemp < 32) tips.push(resolveTip(tipsSet.FREEZING));
  else if (w.minTemp < 45) tips.push(resolveTip(tipsSet.COLD));
  else if (w.minTemp < 55) tips.push(resolveTip(tipsSet.COOL));
  else if (w.minTemp < 65) tips.push(resolveTip(tipsSet.MILD_COOL));

  if (w.maxTemp > 90) tips.push(resolveTip(tipsSet.SCORCHING));
  else if (w.maxTemp > 80) tips.push(resolveTip(tipsSet.HOT));

  return tips;
}

/** @param {Weather} weather @param {RideWindow} w @param {GearTipSet} tipsSet @returns {GearSuggestion} */
/**
 * Builds the weather-driven add-on tips (rain, wind, UV, temp swing, mugginess).
 * `hasAdverse` flags conditions that contradict the ideal-day PERFECT copy.
 * @param {Weather} weather @param {RideWindow} w @param {GearTipSet} tipsSet
 * @param {import('../utils/temperature').TempUnit} [tempUnit]
 * @returns {{ tips: GearTip[], hasAdverse: boolean }}
 */
function buildSupportingTips(weather, w, tipsSet, tempUnit = 'fahrenheit') {
  /** @type {GearTip[]} */
  const tips = [];
  let hasAdverse = false;

  if (w.maxTemp - w.minTemp >= 15) {
    tips.push(
      tipsSet.TEMP_SWING(
        formatTemperature(w.minTemp, tempUnit),
        formatTemperature(w.maxTemp, tempUnit),
      ),
    );
  }

  if (w.maxRain > 50) {
    tips.push(resolveTip(weather.rainChance > 50 ? tipsSet.RAIN_HIGH : tipsSet.RAIN_COMING));
    hasAdverse = true;
  } else if (w.maxRain > 30) {
    tips.push(resolveTip(weather.rainChance > 30 ? tipsSet.RAIN_POSSIBLE : tipsSet.RAIN_LATER));
    hasAdverse = true;
  }

  if (w.maxWind > 15) {
    tips.push(
      resolveTip(
        weather.windSpeed > 15 ? tipsSet.WINDY : tipsSet.WIND_PICKUP(Math.round(w.maxWind)),
      ),
    );
    hasAdverse = true;
  }
  if (w.maxUv >= 8) tips.push(tipsSet.UV_EXTREME());
  else if (w.maxUv >= 6) tips.push(resolveTip(tipsSet.UV_HIGH));
  if ((w.maxDewpoint ?? 0) > 65) {
    tips.push(resolveTip(tipsSet.MUGGY));
    hasAdverse = true;
  }

  return { tips, hasAdverse };
}

/**
 * Flattens tips into a deduplicated item list — later items win their slot.
 * @param {GearTip[]} tips
 * @returns {GearTipItem[]}
 */
function mergeTipItems(tips) {
  /** @type {GearTipItem[]} */
  const items = [];
  for (const tip of tips) {
    for (const item of tip?.items ?? []) {
      if (!item.slot) {
        items.push(item);
        continue;
      }
      const idx = items.findIndex((existing) => existing.slot === item.slot);
      if (idx === -1) items.push(item);
      else items[idx] = item;
    }
  }
  return items;
}

/** @param {Weather} weather @param {RideWindow} w @param {GearTipSet} tipsSet @param {RideStatus} [status] @param {import('../utils/temperature').TempUnit} [tempUnit] */
function getGearTips(weather, w, tipsSet, status, tempUnit = 'fahrenheit') {
  const temperatureTips = getTemperatureTips(w, tipsSet);
  const { tips: supportingTips, hasAdverse } = buildSupportingTips(weather, w, tipsSet, tempUnit);

  // An empty temperature tip means the ride window sits in the ideal band, so
  // lead with PERFECT unless an adverse add-on contradicts it. NEUTRAL is the
  // quiet fallback for ideal temps paired with a genuine weather caveat. The
  // celebratory PERFECT copy only fits a clear "yes" day — on a maybe/no verdict
  // it contradicts the hero, so fall back to NEUTRAL.
  /** @type {GearTip[]} */
  let baseTips;
  if (temperatureTips.length > 0) {
    baseTips = temperatureTips;
  } else if (hasAdverse || (status != null && status !== 'yes')) {
    baseTips = [resolveTip(tipsSet.NEUTRAL)];
  } else {
    baseTips = [tipsSet.PERFECT()];
  }

  const tips = [...baseTips, ...supportingTips];
  const headline = tips.find((t) => t?.headline)?.headline ?? '';
  return { headline, items: mergeTipItems(tips) };
}

/** @param {Weather} weather @param {'casual' | 'pro'} [mode] @param {RideStatus} [status] @param {import('../utils/temperature').TempUnit} [tempUnit] */
export const getGearSuggestion = (weather, mode = 'casual', status, tempUnit = 'fahrenheit') => {
  const w = getRideWindow(weather);
  const tipsSet = /** @type {GearTipSet} */ (mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL);
  return getGearTips(weather, w, tipsSet, status, tempUnit);
};

/** @param {Weather} weather @param {import('../utils/temperature').TempUnit} [tempUnit] */
export const getWeatherAlerts = (weather, tempUnit = 'fahrenheit') => {
  /** @type {WeatherAlert[]} */
  const alerts = [];
  if (weather.nwsAlerts) {
    for (const nws of weather.nwsAlerts) {
      alerts.push({
        ...nws,
        message: nws.headline || nws.event,
        icon: 'default',
      });
    }
  }
  const hasNwsHeat = alerts.some((a) => a.type === 'nws' && /\bheat\b/i.test(a.event || ''));
  if (!hasNwsHeat) {
    if (weather.feelsLike > 104)
      alerts.push({
        type: 'heat',
        severity: 'extreme',
        message: ALERT_MESSAGES.HEAT_EXTREME(
          formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
        ),
        icon: 'thermometer',
      });
    else if (weather.feelsLike > 95)
      alerts.push({
        type: 'heat',
        severity: 'warning',
        message: ALERT_MESSAGES.HEAT_WARNING(
          formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
        ),
        icon: 'thermometer',
      });
  }
  return alerts;
};

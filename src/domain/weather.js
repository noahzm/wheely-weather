import { THRESHOLDS } from "./constants";
import {
  WEATHER_DESCRIPTIONS,
  STATUS_MESSAGES as MSG,
  GEAR_TIPS,
  RAIN_MESSAGES,
  DAYLIGHT_MESSAGES,
  ALERT_MESSAGES,
} from "./copy";

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
 *   TEMP_SWING: (min: number, max: number) => GearTip;
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
} from "../utils/weatherLabels";

/**
 * Evaluates a single weather metric against cycling-friendly thresholds.
 * Returns "good", "fair", "marginal", "poor", or "bad" to indicate ride-ability.
 * @param {number | null | undefined} value
 * @param {MetricType} type
 * @returns {Condition}
 */
export const evaluateCondition = (value, type) => {
  if (value == null) return "good";
  const T = THRESHOLDS;
  switch (type) {
    case "feelsLike":
      if (value < T.FEELS_LIKE.BAD_MIN || value > T.FEELS_LIKE.BAD_MAX)
        return "bad";
      if (value < T.FEELS_LIKE.POOR_MIN || value > T.FEELS_LIKE.POOR_MAX)
        return "poor";
      if (
        value < T.FEELS_LIKE.MARGINAL_MIN ||
        value > T.FEELS_LIKE.MARGINAL_MAX
      )
        return "marginal";
      if (value < T.FEELS_LIKE.FAIR_MIN || value > T.FEELS_LIKE.FAIR_MAX)
        return "fair";
      return "good";
    case "windSpeed":
      if (value > T.WIND_SPEED.BAD) return "bad";
      if (value > T.WIND_SPEED.POOR) return "poor";
      if (value > T.WIND_SPEED.MARGINAL) return "marginal";
      if (value > T.WIND_SPEED.FAIR) return "fair";
      return "good";
    case "windGust":
      if (value > T.WIND_GUST.BAD) return "bad";
      if (value > T.WIND_GUST.POOR) return "poor";
      if (value > T.WIND_GUST.MARGINAL) return "marginal";
      if (value > T.WIND_GUST.FAIR) return "fair";
      return "good";
    case "rainChance":
      if (value > T.RAIN_CHANCE.BAD) return "bad";
      if (value > T.RAIN_CHANCE.POOR) return "poor";
      if (value > T.RAIN_CHANCE.MARGINAL) return "marginal";
      if (value > T.RAIN_CHANCE.FAIR) return "fair";
      return "good";
    case "aqi":
      if (value > T.AQI.BAD) return "bad";
      if (value > T.AQI.POOR) return "poor";
      if (value > T.AQI.MARGINAL) return "marginal";
      if (value > T.AQI.FAIR) return "fair";
      return "good";
    case "dewpoint":
      if (value > T.DEWPOINT.BAD) return "bad";
      if (value > T.DEWPOINT.POOR) return "poor";
      if (value > T.DEWPOINT.MARGINAL) return "marginal";
      if (value > T.DEWPOINT.FAIR) return "fair";
      return "good";
    default:
      return "good";
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
export const evaluateWind = (windSpeed, windGust) => {
  const sustained = evaluateCondition(windSpeed, "windSpeed");
  if (windGust == null) return sustained;
  return worseCondition(sustained, evaluateCondition(windGust, "windGust"));
};

/** True when gusts are a strictly worse limiter than sustained wind. */
/** @param {number} windSpeed @param {number | null | undefined} windGust */
const isGustDriven = (windSpeed, windGust) =>
  windGust != null &&
  RANK[evaluateCondition(windGust, "windGust")] <
    RANK[evaluateCondition(windSpeed, "windSpeed")];

/** Determines the overall cycling verdict. */
/** @param {Weather} weather @returns {RideStatus} */
export const getOverallStatus = (weather) => {
  if (weather.hasThunderstorms) return "no";
  const conditions = [
    evaluateCondition(weather.feelsLike, "feelsLike"),
    evaluateWind(weather.windSpeed, weather.windGust),
    evaluateCondition(weather.rainChance, "rainChance"),
    evaluateCondition(weather.dewpoint, "dewpoint"),
    getWeatherCodeCondition(weather.weatherCode),
    ...(weather.aqi != null ? [evaluateCondition(weather.aqi, "aqi")] : []),
  ];
  if (conditions.some((c) => c === "bad" || c === "poor")) return "no";
  if (conditions.some((c) => c === "marginal" || c === "fair")) return "maybe";
  return "yes";
};

/** @param {number | null | undefined} code */
export const getWeatherDescription = (code) =>
  code == null ? "Unknown" : WEATHER_DESCRIPTIONS[code] || "Unknown";
/** @param {number | null | undefined} code */
export const isThunderstorm = (code) => code != null && [95, 96, 99].includes(code);

// Weather codes add context that raw rain percentages can miss, especially for storms and snow.
/** @param {number | null | undefined} code @returns {Condition} */
export const getWeatherCodeCondition = (code) => {
  if (code == null) return "good";
  if (isThunderstorm(code)) return "bad";
  // 48 = freezing fog: implies ice on the road, so it rates worse than plain fog.
  if ([48, 65, 75, 77, 82, 86].includes(code)) return "poor";
  if ([55, 63, 71, 73, 81, 85].includes(code)) return "marginal";
  if ([45, 51, 53, 61, 80].includes(code)) return "fair";
  return "good";
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
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  85: "light snow showers",
  86: "snow showers",
};

/** @param {number | null | undefined} code @param {RideStatus} status */
const getWeatherCodeIssue = (code, status) => {
  const rating = getWeatherCodeCondition(code);
  const shouldMention =
    status === "maybe"
      ? rating === "marginal" || rating === "fair"
      : rating === "bad" || rating === "poor";
  if (!shouldMention) return null;
  return code == null ? null : WEATHER_CODE_ISSUES[code] ?? null;
};

/** @param {Condition[]} conditions @returns {Condition} */
const getCyclingCondition = (conditions) => {
  if (conditions.some((c) => c === "bad")) return "bad";
  if (conditions.some((c) => c === "poor")) return "poor";
  if (conditions.some((c) => c === "marginal")) return "marginal";
  if (conditions.some((c) => c === "fair")) return "fair";
  return "good";
};

/**
 * @param {{ feelsLike: number; wind: number; gust?: number | null; rain: number; code?: number | null; dewpoint: number | null }} values
 * @returns {Condition}
 */
export const getHourlyCondition = ({
  feelsLike,
  wind,
  gust,
  rain,
  code,
  dewpoint,
}) => {
  return getCyclingCondition([
    evaluateCondition(feelsLike, "feelsLike"),
    evaluateWind(wind, gust),
    evaluateCondition(rain, "rainChance"),
    evaluateCondition(dewpoint, "dewpoint"),
    getWeatherCodeCondition(code),
  ]);
};

// `feelsLow`/`feelsHigh` are the coldest and warmest feels-like during the day's
// daylight (ridable) hours; temperature is rated on whichever is worse. This keeps
// the daily verdict consistent with wind/rain/dew (worst-case during ridable hours)
// instead of rating temp on the warmest moment alone. Either bound may be omitted.
/**
 * @param {{ feelsLow?: number | null; feelsHigh?: number | null; wind: number; gust?: number | null; rain: number; code?: number | null; dewpoint?: number | null }} values
 * @returns {Condition}
 */
export const getDailyCondition = ({
  feelsLow = null,
  feelsHigh,
  wind,
  gust = null,
  rain,
  code,
  dewpoint = null,
}) => {
  return getCyclingCondition([
    ...(feelsLow != null ? [evaluateCondition(feelsLow, "feelsLike")] : []),
    ...(feelsHigh != null ? [evaluateCondition(feelsHigh, "feelsLike")] : []),
    evaluateWind(wind, gust),
    evaluateCondition(rain, "rainChance"),
    getWeatherCodeCondition(code),
    ...(dewpoint != null ? [evaluateCondition(dewpoint, "dewpoint")] : []),
  ]);
};

/** @param {number} h */
function formatHour(h) {
  const hour = h % 24;
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// Find the next clearly better ride window, even if it improves to fair rather than perfect.
/** @param {HourlyWeather[] | undefined} hourly */
function getLaterGoodHour(hourly) {
  if (!hourly || hourly.length < 2) return null;

  const currentRank = RANK[hourly[0]?.condition] ?? 0;

  for (let i = 1; i < hourly.length; i++) {
    const nextRank = RANK[hourly[i]?.condition] ?? 0;
    if (nextRank >= RANK.fair && nextRank > currentRank) {
      return formatHour(hourly[i].hour);
    }
  }

  return null;
}

/** @param {Weather} weather @param {RideStatus} status */
export const getMessage = (weather, status) => {
  if (weather.hasThunderstorms) return MSG.THUNDERSTORM;
  if (status === "yes") {
    return MSG.GOOD(Math.round(weather.feelsLike), weather.condition);
  }

  const laterGood = getLaterGoodHour(weather.hourly);
  /** @type {string[]} */
  const issues = [];
  /**
   * @param {number | null | undefined} val
   * @param {MetricType} type
   * @param {string} label
   * @param {Condition} [ratingOverride]
   */
  const addIssue = (val, type, label, ratingOverride) => {
    const rating = ratingOverride ?? evaluateCondition(val, type);
    if (status === "maybe" && (rating === "marginal" || rating === "fair"))
      issues.push(label);
    if (status === "no" && (rating === "bad" || rating === "poor"))
      issues.push(label);
  };

  const temp = Math.round(weather.feelsLike);
  addIssue(
    weather.feelsLike,
    "feelsLike",
    weather.feelsLike < 50 ? `cold (${temp}°F)` : `hot (${temp}°F)`,
  );
  if (status === "no" && issues.length > 0) {
    issues[0] =
      weather.feelsLike < 36
        ? `too cold (${Math.round(weather.feelsLike)}\u00B0F)`
        : `too hot (${Math.round(weather.feelsLike)}\u00B0F)`;
  }
  const gustDriven = isGustDriven(weather.windSpeed, weather.windGust);
  const windLabel = gustDriven
    ? `${status === "no" ? "strong gusts" : "gusty"} (${Math.round(weather.windGust ?? weather.windSpeed)} mph gusts)`
    : `${status === "no" ? "heavy wind" : "gusty"} (${Math.round(weather.windSpeed)} mph)`;
  addIssue(
    weather.windSpeed,
    "windSpeed",
    windLabel,
    evaluateWind(weather.windSpeed, weather.windGust),
  );
  addIssue(
    weather.rainChance,
    "rainChance",
    `${status === "no" ? "rain" : "rainy"} (${weather.rainChance}% chance)`,
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
    "dewpoint",
    `${status === "no" ? "heavy humidity" : "sticky"} (dew ${Math.round(weather.dewpoint)}°F)`,
  );
  if (weather.aqi != null) {
    addIssue(
      weather.aqi,
      "aqi",
      `${status === "no" ? "poor air quality" : "hazy"} (AQI ${weather.aqi})`,
    );
  }

  let msg =
    status === "maybe"
      ? issues.length > 0
        ? MSG.MAYBE_ISSUES(issues)
        : MSG.MAYBE_IDEAL
      : issues.length > 0
        ? MSG.NO_ISSUES(issues)
        : MSG.NO_IDEAL;

  if (laterGood)
    msg +=
      status === "maybe" ? MSG.LATER_GOOD(laterGood) : MSG.CLEAR_UP(laterGood);
  else if (status === "no") msg += MSG.REST_DAY();

  return msg;
};

/** Returns up to 3 limiting ride factors with label, value, and condition rating. */
/** @param {Weather | null | undefined} weather @param {RideStatus | null | undefined} status @returns {RideFactor[]} */
export const getRideFactors = (weather, status) => {
  if (!weather || !status || status === "yes") return [];

  /** @param {Condition} rating */
  const isLimiting = (rating) => {
    if (status === "no") return rating === "bad" || rating === "poor";
    if (status === "maybe") return rating === "marginal" || rating === "fair";
    return false;
  };

  /** @type {RideFactor[]} */
  const factors = [];

  const tempRating = evaluateCondition(weather.feelsLike, "feelsLike");
  if (isLimiting(tempRating)) {
    factors.push({
      type: "feelsLike",
      label: "Temperature",
      value: `${Math.round(weather.feelsLike)}°F`,
      condition: tempRating,
    });
  }

  const windRating = evaluateWind(weather.windSpeed, weather.windGust);
  if (isLimiting(windRating)) {
    factors.push({
      type: "windSpeed",
      label: "Wind",
      value: isGustDriven(weather.windSpeed, weather.windGust)
        ? `${Math.round(weather.windGust ?? weather.windSpeed)} mph gusts`
        : `${Math.round(weather.windSpeed)} mph`,
      condition: windRating,
    });
  }

  const rainRating = evaluateCondition(weather.rainChance, "rainChance");
  if (isLimiting(rainRating)) {
    factors.push({
      type: "rainChance",
      label: "Rain",
      value: `${weather.rainChance}% chance`,
      condition: rainRating,
    });
  }

  const dewRating = evaluateCondition(weather.dewpoint, "dewpoint");
  if (isLimiting(dewRating)) {
    factors.push({
      type: "dewpoint",
      label: "Humidity",
      value: `Dew ${Math.round(weather.dewpoint)}°F`,
      condition: dewRating,
    });
  }

  if (weather.aqi != null) {
    const aqiRating = evaluateCondition(weather.aqi, "aqi");
    if (isLimiting(aqiRating)) {
      factors.push({
        type: "aqi",
        label: "Air quality",
        value: `AQI ${weather.aqi}`,
        condition: aqiRating,
      });
    }
  }

  const codeRating = getWeatherCodeCondition(weather.weatherCode);
  if (isLimiting(codeRating)) {
    factors.push({
      type: "weatherCode",
      label: "Conditions",
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
  if (hourly[0]?.condition === "good") return "Best now";
  const later = getLaterGoodHour(hourly);
  if (later) return `Improves around ${later}`;
  return "No clear window in the next 24 hours";
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
    hourly[lastRainIdx + 1].rainChance > rainThreshold
  ) {
    lastRainIdx += 1;
  }

  const firstRain = hourly[firstRainIdx];
  const lastRain = hourly[lastRainIdx];
  const isRainingNow = firstRainIdx === 0;
  const clearsUp = lastRainIdx < hourly.length - 1;

  if (isRainingNow && clearsUp)
    return RAIN_MESSAGES.CLEARING(formatHour(lastRain.hour + 1));
  // THROUGHOUT means rain persists through the entire visible window, not necessarily the whole day.
  if (isRainingNow) return RAIN_MESSAGES.THROUGHOUT;
  if (clearsUp)
    return RAIN_MESSAGES.WINDOW(
      formatHour(firstRain.hour),
      formatHour(lastRain.hour + 1),
    );
  return RAIN_MESSAGES.LATER(formatHour(firstRain.hour));
};

/** @param {HourlyWeather[] | undefined} hourly @param {DaylightWindow | null | undefined} daylight */
export const getDaylightWarning = (hourly, daylight) => {
  if (!hourly || !daylight) return null;
  const { sunriseHour, sunsetHour } = daylight;
  const goodHours = hourly.filter(
    (h) => h.condition === "good" || h.condition === "fair",
  );
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
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.uv ?? 0))
        : (weather.uvIndex ?? 0),
  };
}

/** @param {GearTip | (() => GearTip)} tip @returns {GearTip} */
const resolveTip = (tip) => (typeof tip === "function" ? tip() : tip);

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
function getGearTips(weather, w, tipsSet) {
  const temperatureTips = getTemperatureTips(w, tipsSet);
  /** @type {GearTip[]} */
  const supportingTips = [];
  // Adverse conditions (rain, wind, muggy) make the ideal-day PERFECT copy a
  // lie; benign add-ons (UV, temp swing) can ride alongside it.
  let hasAdverse = false;

  if (w.maxTemp - w.minTemp >= 15) {
    supportingTips.push(
      tipsSet.TEMP_SWING(Math.round(w.minTemp), Math.round(w.maxTemp)),
    );
  }

  if (w.maxRain > 50) {
    supportingTips.push(
      resolveTip(
        weather.rainChance > 50 ? tipsSet.RAIN_HIGH : tipsSet.RAIN_COMING,
      ),
    );
    hasAdverse = true;
  } else if (w.maxRain > 30) {
    supportingTips.push(
      resolveTip(
        weather.rainChance > 30 ? tipsSet.RAIN_POSSIBLE : tipsSet.RAIN_LATER,
      ),
    );
    hasAdverse = true;
  }

  if (w.maxWind > 15) {
    supportingTips.push(
      resolveTip(
        weather.windSpeed > 15
          ? tipsSet.WINDY
          : tipsSet.WIND_PICKUP(Math.round(w.maxWind)),
      ),
    );
    hasAdverse = true;
  }
  if (w.maxUv >= 8) supportingTips.push(tipsSet.UV_EXTREME());
  else if (w.maxUv >= 6) supportingTips.push(resolveTip(tipsSet.UV_HIGH));
  if ((w.maxDewpoint ?? 0) > 65) {
    supportingTips.push(resolveTip(tipsSet.MUGGY));
    hasAdverse = true;
  }

  // An empty temperature tip means the ride window sits in the ideal band, so
  // lead with PERFECT unless an adverse add-on contradicts it. NEUTRAL is the
  // quiet fallback for ideal temps paired with a genuine weather caveat.
  /** @type {GearTip[]} */
  let baseTips;
  if (temperatureTips.length > 0) {
    baseTips = temperatureTips;
  } else if (hasAdverse) {
    baseTips = [resolveTip(tipsSet.NEUTRAL)];
  } else {
    baseTips = [tipsSet.PERFECT()];
  }

  const tips = [...baseTips, ...supportingTips];

  const headline = tips.find((t) => t?.headline)?.headline ?? "";
  /** @type {GearTipItem[]} */
  const items = [];
  for (const tip of tips) {
    for (const item of tip?.items ?? []) {
      if (item.slot) {
        const idx = items.findIndex((existing) => existing.slot === item.slot);
        if (idx >= 0) items[idx] = item;
        else items.push(item);
      } else {
        items.push(item);
      }
    }
  }
  return { headline, items };
}

/** @param {Weather} weather @param {'casual' | 'pro'} [mode] */
export const getGearSuggestion = (weather, mode = "casual") => {
  const w = getRideWindow(weather);
  const tipsSet = /** @type {GearTipSet} */ (mode === "pro" ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL);
  return getGearTips(weather, w, tipsSet);
};

/** @param {Weather} weather */
export const getWeatherAlerts = (weather) => {
  /** @type {WeatherAlert[]} */
  const alerts = [];
  if (weather.nwsAlerts) {
    for (const nws of weather.nwsAlerts) {
      alerts.push({
        ...nws,
        message: nws.headline || nws.event,
        icon: "default",
      });
    }
  }
  const hasNwsHeat = alerts.some(
    (a) => a.type === "nws" && /\bheat\b/i.test(a.event || ""),
  );
  if (!hasNwsHeat) {
    if (weather.feelsLike > 104)
      alerts.push({
        type: "heat",
        severity: "extreme",
        message: ALERT_MESSAGES.HEAT_EXTREME(Math.round(weather.feelsLike)),
        icon: "thermometer",
      });
    else if (weather.feelsLike > 95)
      alerts.push({
        type: "heat",
        severity: "warning",
        message: ALERT_MESSAGES.HEAT_WARNING(Math.round(weather.feelsLike)),
        icon: "thermometer",
      });
  }
  return alerts;
};

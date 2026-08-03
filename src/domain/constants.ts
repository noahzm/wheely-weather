import type { Condition } from '@/types/weather';

// Thresholds reproduce the cycling-weather reference's zone tables, mapped
// zone->condition: ideal->good, good->fair, caution->marginal, hard->poor,
// avoid->bad. The verdict rates raw air temperature (dew point carries humidity
// separately) rather than feels-like, which would double-count humidity.
export const THRESHOLDS = {
  // Air temperature, °F. Asymmetric by design. The hot side runs the full ladder
  // — 68->82 fair, 82->90 caution (marginal), 90->95 hard (poor), 95+ avoid —
  // because sustained effort in heat degrades a ride well before it becomes
  // dangerous. The cold side keeps the reference table's gap: it has no "hard"
  // (poor) zone, 32->40 caution jumping straight to <32 avoid, which is why
  // POOR_MIN==BAD_MIN==32 collapse and the comfort-band rater skips that zone.
  TEMPERATURE: {
    BAD_MIN: 32,
    BAD_MAX: 95,
    POOR_MIN: 32,
    POOR_MAX: 90,
    MARGINAL_MIN: 40,
    MARGINAL_MAX: 82,
    FAIR_MIN: 50,
    FAIR_MAX: 68,
  },
  // Sustained wind. Each hour is rated on the worse of WIND_SPEED and WIND_GUST.
  WIND_SPEED: {
    BAD: 30,
    POOR: 25,
    MARGINAL: 15,
    FAIR: 10,
  },
  // Gusts are what actually destabilize a rider, so they carry their own (higher)
  // thresholds and a calm-but-gusty hour is still flagged. The reference has no
  // gust table (it folds gusts into "30+ or gusting"); this scale is an app
  // safety enhancement consistent with the sustained-wind bands above.
  WIND_GUST: {
    BAD: 40,
    POOR: 35,
    MARGINAL: 28,
    FAIR: 22,
  },
  // Probability of precipitation (%). The reference rates precipitation
  // intensity/surface (handled via weather codes), not probability, so these
  // bands are app-specific rather than adopted from the reference.
  RAIN_CHANCE: {
    BAD: 75,
    POOR: 65,
    MARGINAL: 40,
    FAIR: 20,
  },
  // US EPA AQI, 0–500.
  AQI: {
    BAD: 200,
    POOR: 150,
    MARGINAL: 100,
    FAIR: 50,
  },
  // Dew point, °F. The honest read on stickiness; rated independently of temp.
  DEWPOINT: {
    BAD: 75,
    POOR: 72,
    MARGINAL: 66,
    FAIR: 58,
  },
  // UV index, 0–11+.
  UV_INDEX: {
    BAD: 10,
    POOR: 7,
    MARGINAL: 5,
    FAIR: 2,
  },
  // Relative humidity (%). Used only as a fallback when dew point is unavailable
  // — both the reference and the design notes call humidity redundant given dew
  // point. The reference humidity table tops out at "hard", so there is no BAD.
  HUMIDITY: {
    BAD: Infinity,
    POOR: 85,
    MARGINAL: 70,
    FAIR: 50,
  },
};

export type Thresholds = typeof THRESHOLDS;

// Thresholds for combined cold + rain hazard (hypothermia risk on a bike).
export const COLD_RAIN_HAZARD = {
  MAX_TEMP: 45,
  SEVERE_TEMP: 40,
  MIN_RAIN_CHANCE: 30,
};

// Thresholds for post-rain wet road spray detection.
export const WET_ROADS_THRESHOLD = {
  RECENT_RAIN_CHANCE: 30,
};

// Labels map 1:1 to the rating's real meaning. "Fair" remains distinct from
// "Good" in metric details even though both are comfortably rideable overall.
export const CONDITION_DISPLAY: Record<Condition, string> = {
  good: 'Good',
  fair: 'Fair',
  marginal: 'Iffy',
  poor: 'Poor',
  bad: 'Bad',
};

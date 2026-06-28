// Thresholds reproduce the cycling-weather reference's zone tables, mapped
// zone->condition: ideal->good, good->fair, caution->marginal, hard->poor,
// avoid->bad. The verdict rates raw air temperature (dew point carries humidity
// separately) rather than feels-like, which would double-count humidity.
export const THRESHOLDS = {
  // Air temperature, °F. The reference table is asymmetric and non-contiguous:
  // the hot side has no "caution" (marginal) zone (68->85 good jumps straight to
  // 85->95 hard) and the cold side has no "hard" (poor) zone (32->40 caution
  // jumps to <32 avoid). Those gaps are why MARGINAL_MAX==POOR_MAX==85 and
  // POOR_MIN==BAD_MIN==32 collapse — the comfort-band rater skips the empty zones.
  TEMPERATURE: {
    BAD_MIN: 32,
    BAD_MAX: 95,
    POOR_MIN: 32,
    POOR_MAX: 85,
    MARGINAL_MIN: 40,
    MARGINAL_MAX: 85,
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
    BAD: 38,
    POOR: 32,
    MARGINAL: 26,
    FAIR: 20,
  },
  // Probability of precipitation (%). The reference rates precipitation
  // intensity/surface (handled via weather codes), not probability, so these
  // bands are app-specific rather than adopted from the reference.
  RAIN_CHANCE: {
    BAD: 60,
    POOR: 45,
    MARGINAL: 30,
    FAIR: 15,
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
    POOR: 65,
    MARGINAL: 60,
    FAIR: 55,
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

// Labels map 1:1 to the rating's real meaning. "fair" must not read as "Good"
// (it demotes the overall verdict to "Maybe"), so the scale stays honest rather
// than inflating every rating by one notch.
export const CONDITION_DISPLAY = {
  good: 'Good',
  fair: 'Fair',
  marginal: 'Iffy',
  poor: 'Poor',
  bad: 'Bad',
};

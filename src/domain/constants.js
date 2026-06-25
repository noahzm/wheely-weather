export const THRESHOLDS = {
  // Feels-like is intentionally asymmetric: the cold side spans good->bad over
  // ~18F (50 -> 32) because you can layer up, while the hot side spans only ~11F
  // (84 -> 95) because heat stress ramps fast and can't be dressed away.
  FEELS_LIKE: {
    BAD_MIN: 32,
    BAD_MAX: 95,
    POOR_MIN: 36,
    POOR_MAX: 92,
    MARGINAL_MIN: 45,
    MARGINAL_MAX: 88,
    FAIR_MIN: 50,
    FAIR_MAX: 84,
  },
  // Sustained wind. Each hour is rated on the worse of WIND_SPEED and WIND_GUST.
  WIND_SPEED: {
    BAD: 20,
    POOR: 18,
    MARGINAL: 15,
    FAIR: 12,
  },
  // Gusts are what actually destabilize a rider, so they carry their own (higher)
  // thresholds and a calm-but-gusty hour is still flagged.
  WIND_GUST: {
    BAD: 38,
    POOR: 32,
    MARGINAL: 26,
    FAIR: 20,
  },
  RAIN_CHANCE: {
    BAD: 60,
    POOR: 45,
    MARGINAL: 30,
    FAIR: 15,
  },
  AQI: {
    BAD: 150,
    POOR: 125,
    MARGINAL: 100,
    FAIR: 75,
  },
  DEWPOINT: {
    BAD: 70,
    POOR: 68,
    MARGINAL: 65,
    FAIR: 60,
  },
};

// Labels map 1:1 to the rating's real meaning. "fair" must not read as "Good"
// (it demotes the overall verdict to "Maybe"), so the scale stays honest rather
// than inflating every rating by one notch.
export const CONDITION_DISPLAY = {
  good: "Good",
  fair: "Fair",
  marginal: "Iffy",
  poor: "Poor",
  bad: "Bad",
};

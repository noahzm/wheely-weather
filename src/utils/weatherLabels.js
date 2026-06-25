/** Human-friendly labels for weather metrics used in the UI. */
/** @param {number | null | undefined} aqi */
export const getAqiLabel = (aqi) => {
  if (aqi == null) return "–";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

/** @param {number | null | undefined} dp */
export const getDewpointLabel = (dp) => {
  if (dp == null) return "–";
  if (dp < 50) return "Dry";
  if (dp < 60) return "Comfortable";
  if (dp < 65) return "Noticeable";
  if (dp < 70) return "Muggy";
  return "Oppressive";
};

/** @param {number | null | undefined} degrees */
export const getWindDirectionLabel = (degrees) => {
  if (degrees == null) return "–";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(degrees / 45) % 8];
};

/**
 * Open-Meteo returns the direction the wind comes from.
 * Flip it 180deg so the arrow points where the wind is blowing to.
 */
/** @param {number | null | undefined} degrees */
export const getWindArrowRotation = (degrees) => {
  if (degrees == null) return null;
  return (degrees + 180) % 360;
};

/** @param {number} uv */
export const getUvLabel = (uv) => {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
};

/** Maps a UV index value to the same 5-level condition scale used elsewhere. */
/** @param {number | null | undefined} uv */
export const getUvCondition = (uv) => {
  if (uv == null) return undefined;
  if (uv <= 2) return "good";
  if (uv <= 5) return "fair";
  if (uv <= 7) return "marginal";
  if (uv <= 10) return "poor";
  return "bad";
};

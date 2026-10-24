// The NWS heat index: how hot humid air feels. Worked out here from air
// temperature and dew point rather than taken from a provider's feels-like,
// whose formulas differ by provider (and fold in wind), so every platform
// rates the same day alike.

const toCelsius = (f: number): number => ((f - 32) * 5) / 9;

/** Saturation vapor pressure, up to a constant factor (Magnus formula). */
const vaporPressure = (celsius: number): number => Math.exp((17.62 * celsius) / (243.12 + celsius));

/** Relative humidity (%) from air temperature and dew point (°F), capped at 100. */
export function relativeHumidity(tempF: number, dewpointF: number): number {
  return Math.min(
    100,
    (100 * vaporPressure(toCelsius(dewpointF))) / vaporPressure(toCelsius(tempF)),
  );
}

/** The Rothfusz regression, the NWS heat index for warm air. */
function rothfusz(t: number, rh: number): number {
  return (
    -42.379 +
    2.049_015_23 * t +
    10.143_331_27 * rh -
    0.224_755_41 * t * rh -
    0.006_837_83 * t * t -
    0.054_817_17 * rh * rh +
    0.001_228_74 * t * t * rh +
    0.000_852_82 * t * rh * rh -
    0.000_001_99 * t * t * rh * rh
  );
}

/**
 * The heat index (°F) for an air temperature and dew point (°F), by the NWS
 * method: Steadman's simple form, which stays near the air temperature, until
 * it averages 80°F or more with it; then the Rothfusz regression, with its
 * corrections for very dry and very muggy air. Null without a dew point.
 */
export function heatIndex(tempF: number, dewpointF: number | null | undefined): number | null {
  if (dewpointF == null) return null;
  const t = tempF;
  const rh = relativeHumidity(t, dewpointF);
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if ((simple + t) / 2 < 80) return simple;

  const index = rothfusz(t, rh);
  if (rh < 13 && t >= 80 && t <= 112) {
    return index - ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  }
  if (rh > 85 && t >= 80 && t <= 87) {
    return index + ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return index;
}

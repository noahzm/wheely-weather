export type WeatherKitCondition =
  | 'clear'
  | 'mostlyClear'
  | 'partlyCloudy'
  | 'mostlyCloudy'
  | 'cloudy'
  | 'foggy'
  | 'haze'
  | 'smoky'
  | 'blowingDust'
  | 'breezy'
  | 'windy'
  | 'drizzle'
  | 'freezingDrizzle'
  | 'rain'
  | 'heavyRain'
  | 'freezingRain'
  | 'sunShowers'
  | 'sleet'
  | 'wintryMix'
  | 'flurries'
  | 'sunFlurries'
  | 'snow'
  | 'heavySnow'
  | 'blizzard'
  | 'blowingSnow'
  | 'hail'
  | 'isolatedThunderstorms'
  | 'thunderstorms'
  | 'scatteredThunderstorms'
  | 'strongStorms'
  | 'hurricane'
  | 'tropicalStorm'
  | 'frigid'
  | 'hot';

const WEATHERKIT_TO_WMO: Record<WeatherKitCondition, number> = {
  clear: 0,
  mostlyClear: 1,
  partlyCloudy: 2,
  mostlyCloudy: 3,
  cloudy: 3,
  foggy: 45,
  haze: 45,
  smoky: 45,
  blowingDust: 45,
  breezy: 1,
  windy: 2,
  drizzle: 51,
  freezingDrizzle: 56,
  rain: 63,
  heavyRain: 65,
  freezingRain: 66,
  sunShowers: 80,
  sleet: 67,
  wintryMix: 67,
  flurries: 71,
  sunFlurries: 71,
  snow: 73,
  heavySnow: 75,
  blizzard: 75,
  blowingSnow: 75,
  hail: 96,
  isolatedThunderstorms: 95,
  thunderstorms: 95,
  scatteredThunderstorms: 96,
  strongStorms: 99,
  hurricane: 99,
  tropicalStorm: 99,
  frigid: 0,
  hot: 0,
};

/**
 * Maps Apple WeatherKit's `WeatherCondition` to the nearest Open-Meteo WMO
 * weather code, so the rest of the app's scoring/icon/copy logic (all keyed
 * on WMO ints) works unchanged for WeatherKit-sourced data. `frigid`/`hot`
 * are temperature descriptors with no sky-cover signal in WeatherKit's flat
 * enum, so they fall back to "clear" — actual temperature is unaffected
 * since it comes from the measured value, not this code. Unrecognized
 * values (a WeatherKit addition ahead of this table) fall back to "clear"
 * too, rather than throwing.
 */
export function weatherKitConditionToWmoCode(condition: string): number {
  if (condition in WEATHERKIT_TO_WMO) {
    return WEATHERKIT_TO_WMO[condition as WeatherKitCondition];
  }
  return 0;
}

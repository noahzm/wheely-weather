export type TempUnit = 'fahrenheit' | 'celsius';

/** Converts a temperature value from Fahrenheit to Celsius. */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Converts a wind speed value from miles per hour to kilometers per hour. */
export function mphToKmh(mph: number): number {
  return mph * 1.609_344;
}

/**
 * Formats a Fahrenheit source value for display in the given unit. All weather
 * data and scoring stay in Fahrenheit; conversion happens only here, at the
 * display boundary.
 */
export function formatTemperature(
  fahrenheit: number,
  unit: TempUnit,
  options?: { withUnitLabel?: boolean },
): string {
  const value = unit === 'celsius' ? fahrenheitToCelsius(fahrenheit) : fahrenheit;
  const unitLabel = unit === 'celsius' ? '°C' : '°F';
  const suffix = options?.withUnitLabel ? unitLabel : '°';
  return `${Math.round(value)}${suffix}`;
}

/**
 * Formats an mph source wind speed in the unit paired with the temperature
 * preference: mph for Fahrenheit, km/h for Celsius. All scoring stays in mph.
 */
export function formatWindSpeed(mph: number, unit: TempUnit = 'fahrenheit'): string {
  const value = unit === 'celsius' ? mphToKmh(mph) : mph;
  const suffix = unit === 'celsius' ? 'km/h' : 'mph';
  return `${Math.round(value)} ${suffix}`;
}

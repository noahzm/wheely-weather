export type TempUnit = 'fahrenheit' | 'celsius';

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
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

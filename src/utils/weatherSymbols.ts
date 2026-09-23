/**
 * Maps an Open-Meteo WMO weather code to an SF Symbol name (iOS). Lives outside
 * the UI primitives so framework-free code (the widget snapshot) can use it.
 */
export function weatherSfSymbol(code: number | null | undefined): string {
  if (code == null) return 'cloud.fill';
  if (code <= 1) return 'sun.max.fill';
  if (code <= 3) return 'cloud.sun.fill';
  if (code <= 48) return 'cloud.fog.fill';
  if (code <= 65) return 'cloud.rain.fill';
  if (code <= 77) return 'cloud.snow.fill';
  if (code <= 82) return 'cloud.rain.fill';
  if (code <= 86) return 'cloud.snow.fill';
  if (code <= 99) return 'cloud.bolt.fill';
  return 'cloud.fill';
}

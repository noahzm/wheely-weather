import { buildMockWeather } from '@/services/mockWeather';

function requireWeather(scenario: 'ride' | 'maybe' | 'rest' | 'alert') {
  const weather = buildMockWeather(scenario);
  if (!weather) throw new Error(`Missing mock weather scenario: ${scenario}`);
  return weather;
}

export const rideWeather = requireWeather('ride');
export const maybeWeather = requireWeather('maybe');
export const restWeather = requireWeather('rest');
export const alertWeather = requireWeather('alert');

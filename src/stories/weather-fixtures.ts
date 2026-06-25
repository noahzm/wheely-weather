import { buildMockWeather } from '@/services/mockWeather';
import type { RecentLocation } from '@/services/locationStorage';

function requireWeather(scenario: 'ride' | 'maybe' | 'rest' | 'alert') {
  const weather = buildMockWeather(scenario);
  if (!weather) throw new Error(`Missing mock weather scenario: ${scenario}`);
  return weather;
}

export const rideWeather = requireWeather('ride');
export const maybeWeather = requireWeather('maybe');
export const restWeather = requireWeather('rest');
export const alertWeather = requireWeather('alert');

export const recentLocations: RecentLocation[] = [
  {
    label: 'Raleigh, NC',
    displayName: 'Raleigh, Wake County, North Carolina, United States',
    lat: 35.7796,
    lon: -78.6382,
  },
  {
    label: 'Durham, NC',
    displayName: 'Durham, Durham County, North Carolina, United States',
    lat: 35.994,
    lon: -78.8986,
  },
  {
    label: 'Cary, NC',
    displayName: 'Cary, Wake County, North Carolina, United States',
    lat: 35.7915,
    lon: -78.7811,
  },
];

export async function mockSearchLocations(query: string) {
  const normalized = query.toLowerCase();
  return recentLocations.filter((place) => place.label.toLowerCase().includes(normalized));
}

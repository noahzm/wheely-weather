import type { SavedLocation } from '@/services/settingsCodec';

import { abbreviateTrailingUSState } from './us-states';

/**
 * The home location to store for `location`, labeled with the forecast's place
 * name ("Houston, TX") when there is one, so Settings names it the way the
 * home screen does.
 */
export function toHomeLocation(location: SavedLocation, placeName?: string | null): SavedLocation {
  // An empty place name counts as none, so `??` alone isn't enough here.
  let name = location.name;
  if (placeName) name = placeName;
  return {
    lat: location.lat,
    lon: location.lon,
    name: name ? abbreviateTrailingUSState(name) : name,
    source: location.source,
  };
}

/**
 * The home to assign automatically after a forecast loads, or null to leave
 * home alone. Home climate is what adapts the comfort limits to a rider's
 * climate, and riders in hot, humid or cold places rarely found the setting,
 * so the first real place a rider loads becomes home until they change it.
 * Never after the rider has chosen (or cleared) a home, and never from a mock
 * preview, which must not touch persisted location state.
 */
export function pickAutoHomeLocation({
  homeLocationChosen,
  mockScenario,
  savedLocation,
  placeName,
}: Readonly<{
  homeLocationChosen: boolean;
  mockScenario: string | null;
  savedLocation: SavedLocation | null;
  placeName?: string | null;
}>): SavedLocation | null {
  if (homeLocationChosen || mockScenario || !savedLocation) return null;
  return toHomeLocation(savedLocation, placeName);
}

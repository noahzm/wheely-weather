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
 * so the first real place a rider loads becomes a provisional home.
 *
 * A provisional home from a search (a trip, maybe) gives way to the first GPS
 * fix, which is a far better guess at where the rider lives; after that it
 * stays put, so riding around with GPS on never moves it. Anything the rider
 * chooses, or clears, is final. A mock preview never assigns: it must not
 * touch persisted location state.
 */
export function pickAutoHomeLocation({
  homeLocation,
  homeLocationChosen,
  homeLocationAuto,
  mockScenario,
  savedLocation,
  placeName,
}: Readonly<{
  homeLocation: SavedLocation | null;
  homeLocationChosen: boolean;
  homeLocationAuto: boolean;
  mockScenario: string | null;
  savedLocation: SavedLocation | null;
  placeName?: string | null;
}>): SavedLocation | null {
  if (mockScenario || !savedLocation) return null;
  if (!homeLocationChosen) return toHomeLocation(savedLocation, placeName);
  const upgradeToGps =
    homeLocationAuto && homeLocation?.source !== 'device' && savedLocation.source === 'device';
  return upgradeToGps ? toHomeLocation(savedLocation, placeName) : null;
}

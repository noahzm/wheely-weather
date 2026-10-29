/** Header title helpers for the weather screen. */

import { abbreviateUSState } from './us-states';

/**
 * A reverse-geocoded place as "City, ST" (US states abbreviated to match
 * MapKit search labels), the city alone without a region, or "Your Location"
 * without a city.
 */
export function formatPlaceLabel(place: {
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}): string {
  const { city, region } = place;
  if (!city) return 'Your Location';
  if (!region) return city;
  const isUS = place.countryCode?.toLowerCase() === 'us';
  return `${city}, ${isUS ? abbreviateUSState(region) : region}`;
}

/** First component of a "City, Region, Country" label. */
export function cityFromLocation(location: string | null | undefined): string {
  return location?.split(',')[0]?.trim() ?? '';
}

/**
 * Heading city for the home screen: in mock mode the scenario's own label wins
 * over any saved location on disk.
 */
export function resolveHomeCity(
  savedName: string | null | undefined,
  snapshotLocation: string | null | undefined,
  isMock = false,
): string {
  if (isMock) return cityFromLocation(snapshotLocation);
  return cityFromLocation(savedName) || cityFromLocation(snapshotLocation);
}

/** Resolves a concise display name for a location chip or pill. */
export function resolveLocationChipName(place: {
  label?: string | null;
  displayName?: string | null;
}): string {
  const fromLabel = cityFromLocation(place.label);
  if (fromLabel) return fromLabel;
  const fromDisplay = cityFromLocation(place.displayName);
  if (fromDisplay) return fromDisplay;
  if (place.label) return place.label;
  if (place.displayName) return place.displayName;
  return 'Location';
}

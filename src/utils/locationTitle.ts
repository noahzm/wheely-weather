/** Header title helpers for the weather screen. */

/** First component of a "City, Region, Country" label. */
export function cityFromLocation(location: string | null | undefined): string {
  return location?.split(',')[0]?.trim() ?? '';
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

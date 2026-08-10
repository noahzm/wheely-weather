import type { RecentLocation } from '@/services/locationStorage';

/** A location row, plus the synthetic "use current location" entry. */
export type RowItem = RecentLocation & {
  _kind?: 'device';
  /**
   * Set on iOS search suggestions, which arrive from MKLocalSearchCompleter
   * with placeholder coordinates. The row is not a real place until this id is
   * resolved, so it must not be pinned or saved as-is.
   */
  _completionId?: string;
};

export interface LocationSection {
  id: 'home' | 'pinned' | 'recent' | 'results' | 'options';
  title?: string;
  data: RowItem[];
}

export function isPinned(place: { lat: number; lon: number }, pins: RecentLocation[]): boolean {
  return pins.some((p) => p.lat === place.lat && p.lon === place.lon);
}

/** Coordinate identity — the only thing that makes two location rows the same place. */
export function sameCoords(
  place: { lat: number; lon: number },
  other: { lat: number; lon: number } | null | undefined,
): boolean {
  return other?.lat === place.lat && other.lon === place.lon;
}

export function isHome(
  place: { lat: number; lon: number },
  home: { lat: number; lon: number } | null,
): boolean {
  return sameCoords(place, home);
}

/** True for the location the forecast is currently showing. */
export function isActive(
  place: { lat: number; lon: number },
  active: { lat: number; lon: number } | null,
): boolean {
  return sameCoords(place, active);
}

/**
 * True for rows that name a real place and so may be pinned or set as home.
 * The device row is an action, and a suggestion has placeholder coordinates
 * until it is resolved — saving either would store a location that is nowhere.
 */
export function isSavablePlace(item: RowItem): boolean {
  return !item._kind && !item._completionId;
}

/**
 * Turns a picked row into a place with real coordinates. Suggestions from
 * MKLocalSearchCompleter carry only an id, so the resolver is injected rather
 * than imported: that keeps this platform-agnostic and directly testable.
 * Returns null when the suggestion cannot be placed, so callers leave the
 * current location alone instead of saving 0,0.
 */
export async function resolveSuggestedPlace(
  place: RowItem,
  resolve: (id: string) => Promise<{ lat: number; lon: number } | null>,
): Promise<RecentLocation | null> {
  if (!place._completionId) return place;
  const coords = await resolve(place._completionId);
  if (!coords) return null;
  return {
    lat: coords.lat,
    lon: coords.lon,
    label: place.label,
    displayName: place.displayName,
  };
}

export function homeAccessibilityLabel(home: boolean): string {
  return home ? 'Clear home location' : 'Set as home location';
}

export function placeKey(item: RowItem): string {
  // Suggestions all share placeholder coordinates, so the completion id is the
  // only thing that keeps their rows distinct.
  return item._kind ?? item._completionId ?? `${item.lat}-${item.lon}`;
}

export function pinAccessibilityLabel(pinned: boolean): string {
  return pinned ? 'Unpin location' : 'Pin location';
}

export function buildSections(
  isSearching: boolean,
  results: RecentLocation[],
  pinnedLocations: RecentLocation[],
  recentLocations: RecentLocation[],
  homeLocation: RecentLocation | null = null,
): LocationSection[] {
  const sections: LocationSection[] = [];
  if (isSearching) {
    if (results.length > 0) {
      sections.push({ id: 'results', title: 'Results', data: results });
    }
  } else {
    // Home sits above Pinned: it is the single place whose climate calibrates
    // every verdict, so it outranks the merely-frequent locations below it.
    if (homeLocation) {
      sections.push({ id: 'home', title: 'Home', data: [homeLocation] });
    }
    // A home that is also pinned or recent stays listed once, in Home.
    const withoutHome = (list: RecentLocation[]) => list.filter((r) => !isHome(r, homeLocation));
    const pinnedRest = withoutHome(pinnedLocations);
    const unpinnedRecent = withoutHome(recentLocations).filter(
      (r) => !isPinned(r, pinnedLocations),
    );
    if (pinnedRest.length > 0) {
      sections.push({ id: 'pinned', title: 'Pinned', data: pinnedRest });
    }
    if (unpinnedRecent.length > 0) {
      sections.push({ id: 'recent', title: 'Recent', data: unpinnedRecent });
    }
  }
  if (!isSearching) {
    sections.push({
      id: 'options',
      title: 'Options',
      data: [{ lat: 0, lon: 0, label: 'Use Current Location', _kind: 'device' }],
    });
  }
  return sections;
}

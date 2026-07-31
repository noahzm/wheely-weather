import type { RecentLocation } from '@/services/locationStorage';

export type RowItem = RecentLocation & { _kind?: 'device' };

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

export function homeAccessibilityLabel(home: boolean): string {
  return home ? 'Clear home location' : 'Set as home location';
}

export function placeKey(item: RowItem): string {
  return item._kind ?? `${item.lat}-${item.lon}`;
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

export interface LocationSearchListProps {
  sections: LocationSection[];
  busy: boolean;
  message: string;
  isLoading: boolean;
  isSearching: boolean;
  resultsCount: number;
  pinnedLocations: RecentLocation[];
  homeLocation: RecentLocation | null;
  /** The location the forecast is currently showing, marked as selected in the list. */
  activeLocation: { lat: number; lon: number } | null;
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
  onToggleHome: (item: RowItem) => void;
}

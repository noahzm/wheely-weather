import type { RecentLocation } from '@/services/locationStorage';

export type RowItem = RecentLocation & { _kind?: 'device' };

export interface LocationSection {
  id: 'pinned' | 'recent' | 'results' | 'options';
  title?: string;
  data: RowItem[];
}

export function isPinned(place: { lat: number; lon: number }, pins: RecentLocation[]): boolean {
  return pins.some((p) => p.lat === place.lat && p.lon === place.lon);
}

export function placeKey(item: RowItem): string {
  return item._kind ?? `${item.lat}-${item.lon}`;
}

export function buildSections(
  isSearching: boolean,
  results: RecentLocation[],
  pinnedLocations: RecentLocation[],
  recentLocations: RecentLocation[],
): LocationSection[] {
  const sections: LocationSection[] = [];
  if (isSearching) {
    if (results.length > 0) {
      sections.push({ id: 'results', title: 'Results', data: results });
    }
  } else if (recentLocations.length > 0 || pinnedLocations.length > 0) {
    const unpinnedRecent = recentLocations.filter((r) => !isPinned(r, pinnedLocations));
    if (pinnedLocations.length > 0) {
      sections.push({ id: 'pinned', title: 'Pinned', data: pinnedLocations });
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
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
}

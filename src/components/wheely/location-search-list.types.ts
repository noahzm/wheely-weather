import type { LocationSection, RowItem } from '@/utils/locationRows';
import type { RecentLocation } from '@/services/locationStorage';

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

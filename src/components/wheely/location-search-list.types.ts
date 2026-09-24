import type { LocationSection, RowItem } from '@/utils/locationRows';
import type { RecentLocation } from '@/services/locationStorage';
import type { PlaceVerdict } from '@/utils/placeVerdict';

export interface LocationSearchListProps {
  sections: LocationSection[];
  busy: boolean;
  message: string;
  /** Why "Use Current Location" failed, shown under that row; empty when it didn't. */
  deviceMessage: string;
  isLoading: boolean;
  isSearching: boolean;
  resultsCount: number;
  pinnedLocations: RecentLocation[];
  homeLocation: RecentLocation | null;
  /** The location the forecast is currently showing, marked as selected in the list. */
  activeLocation: { lat: number; lon: number } | null;
  /** A saved place's cached verdict, or null when none is cached. */
  verdictFor: (item: RowItem) => PlaceVerdict | null;
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
  onToggleHome: (item: RowItem) => void;
}

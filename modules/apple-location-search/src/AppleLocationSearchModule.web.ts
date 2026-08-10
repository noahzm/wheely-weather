import { registerWebModule, NativeModule } from 'expo';

import type { LocationSuggestion, ResolvedCoordinates } from './AppleLocationSearch.types';

// MapKit is iOS-only; the web/Android path uses the Nominatim geocoder instead.
class AppleLocationSearchModule extends NativeModule<Record<string, never>> {
  search(_query: string): Promise<LocationSuggestion[]> {
    // MapKit is iOS-only; nothing to search on web/Android.
    return Promise.resolve([]);
  }

  resolve(_id: string): Promise<ResolvedCoordinates | null> {
    return Promise.resolve(null);
  }
}

export default registerWebModule(AppleLocationSearchModule, 'AppleLocationSearch');

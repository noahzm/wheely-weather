import { registerWebModule, NativeModule } from 'expo';

import type { LocationResult } from './AppleLocationSearch.types';

// MapKit is iOS-only; the web/Android path uses the Nominatim geocoder instead.
class AppleLocationSearchModule extends NativeModule<Record<string, never>> {
  search(_query: string): Promise<LocationResult[]> {
    // MapKit is iOS-only; nothing to search on web/Android.
    return Promise.resolve([]);
  }
}

export default registerWebModule(AppleLocationSearchModule, 'AppleLocationSearch');

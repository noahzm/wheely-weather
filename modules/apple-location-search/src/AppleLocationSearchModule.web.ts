import { registerWebModule, NativeModule } from 'expo';

import type { LocationResult } from './AppleLocationSearch.types';

// MapKit is iOS-only; the web/Android path uses the Nominatim geocoder instead.
class AppleLocationSearchModule extends NativeModule<Record<string, never>> {
  async search(_query: string): Promise<LocationResult[]> {
    return [];
  }
}

export default registerWebModule(AppleLocationSearchModule, 'AppleLocationSearch');

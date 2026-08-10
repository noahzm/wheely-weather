import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { LocationSuggestion, ResolvedCoordinates } from './AppleLocationSearch.types';

declare class AppleLocationSearchModule extends NativeModule<Record<string, never>> {
  search(query: string): Promise<LocationSuggestion[]>;
  /** Resolves a suggestion id to coordinates; null when MapKit has no placemark. */
  resolve(id: string): Promise<ResolvedCoordinates | null>;
}

// Returns null before the native module is built/linked; the iOS search
// service checks for null and throws — search is unavailable in that state.
export default requireOptionalNativeModule<AppleLocationSearchModule>('AppleLocationSearch');

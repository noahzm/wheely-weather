import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { LocationResult } from './AppleLocationSearch.types';

declare class AppleLocationSearchModule extends NativeModule<Record<string, never>> {
  search(query: string): Promise<LocationResult[]>;
}

// Returns null before the native module is built/linked; the iOS search
// service checks for null and throws — search is unavailable in that state.
export default requireOptionalNativeModule<AppleLocationSearchModule>('AppleLocationSearch');

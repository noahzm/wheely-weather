// Default (Android / web): delegate to the existing Nominatim geocoder.
// The iOS-specific platform file (locationSearch.ios.ts) shadows this with MapKit.
export { searchLocations } from './locationGeocoding';

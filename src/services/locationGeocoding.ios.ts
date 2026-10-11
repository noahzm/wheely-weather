// iOS: name device locations from Apple's reverse geocode (CLGeocoder via the
// WeatherKit native module), the same lookup that gives the forecast its time
// zone, so coordinates stay with Apple and naming costs no extra request.
// Place search lives in locationSearch.ios.ts (MapKit). Like the other iOS
// services, there is no Nominatim fallback: without the native module (before
// a rebuild links it) places are just "Your Location".
import AppleWeatherKitModule from '../../modules/apple-weatherkit/src/AppleWeatherKitModule';
import { formatPlaceLabel } from '../utils/locationTitle';

/** Reverse-geocodes coordinates into a "City, ST" string via Apple. */
export async function fetchLocationName(lat: number, lon: number): Promise<string | null> {
  try {
    const place = await AppleWeatherKitModule?.place(lat, lon);
    if (place) {
      return formatPlaceLabel({
        city: place.locality ?? place.subAdministrativeArea,
        region: place.administrativeArea,
        countryCode: place.isoCountryCode,
      });
    }
  } catch {
    /* empty */
  }
  return 'Your Location';
}

import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  WeatherKitAlert,
  WeatherKitAttribution,
  WeatherKitForecastResult,
  WeatherKitPlace,
} from './AppleWeatherKit.types';

declare class AppleWeatherKitModule extends NativeModule<Record<string, never>> {
  forecast(lat: number, lon: number): Promise<WeatherKitForecastResult>;
  alerts(lat: number, lon: number): Promise<WeatherKitAlert[]>;
  /** Shares the forecast's cached reverse geocode; null when it fails. */
  place(lat: number, lon: number): Promise<WeatherKitPlace | null>;
  attribution(): Promise<WeatherKitAttribution>;
}

// Returns null before the native module is built/linked; the iOS weather
// service checks for null and throws — forecasts are unavailable in that state.
export default requireOptionalNativeModule<AppleWeatherKitModule>('AppleWeatherKit');

import { registerWebModule, NativeModule } from 'expo';

import type {
  WeatherKitAlert,
  WeatherKitAttribution,
  WeatherKitForecastResult,
} from './AppleWeatherKit.types';

// WeatherKit is iOS-only; the web/Android path uses Open-Meteo instead.
class AppleWeatherKitModule extends NativeModule<Record<string, never>> {
  forecast(_lat: number, _lon: number): Promise<WeatherKitForecastResult> {
    return Promise.reject(new Error('WeatherKit is not available on this platform.'));
  }

  alerts(_lat: number, _lon: number): Promise<WeatherKitAlert[]> {
    return Promise.resolve([]);
  }

  attribution(): Promise<WeatherKitAttribution> {
    return Promise.reject(new Error('WeatherKit is not available on this platform.'));
  }
}

export default registerWebModule(AppleWeatherKitModule, 'AppleWeatherKit');

import { applyAirQualityToToday } from '@/domain/air-quality';
import type { ForecastSnapshot } from './forecastSnapshot';
import { buildMockWeather } from './mockWeather';
import { buildWeatherFromData } from './weatherParsing';
import { RIDE_DURATION_HOURS, type RideDuration } from '@/types/settings';

/** Re-rate in memory only: choosing a draft must never fetch or persist a forecast. */
export function previewRideLength(snapshot: ForecastSnapshot, duration: RideDuration) {
  if (duration === snapshot.rideDuration) return snapshot.weather;
  const hours = RIDE_DURATION_HOURS[duration];
  if (snapshot.mockScenario) {
    return buildMockWeather(snapshot.mockScenario, hours, snapshot.nightRiding);
  }
  if (!snapshot.forecastData) return null;
  const thresholds = snapshot.acclimatization.thresholds;
  const weather = buildWeatherFromData(
    snapshot.forecastData,
    thresholds,
    hours,
    snapshot.nightRiding,
  );
  return applyAirQualityToToday(
    { ...weather, aqi: snapshot.weather.aqi, nwsAlerts: snapshot.weather.nwsAlerts },
    thresholds,
  );
}

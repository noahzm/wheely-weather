import { HEAT_INDEX_HAZARD } from './constants';
import { ALERT_MESSAGES } from './copy';
import { heatIndex } from './heat-index';
import { formatTemperature, type TempUnit } from '../utils/temperature';

import type { Weather, WeatherAlert } from '@/types/weather';

export const getWeatherAlerts = (
  weather: Weather,
  tempUnit: TempUnit = 'fahrenheit',
): WeatherAlert[] => {
  const alerts: WeatherAlert[] = [];
  if (weather.nwsAlerts) {
    for (const nws of weather.nwsAlerts) {
      alerts.push({
        ...nws,
        message: nws.headline ?? nws.event,
        icon: 'default',
      });
    }
  }
  // Provider alerts (WeatherKit on iOS and web, NWS on Android and as the web
  // fallback) can already carry a heat alert — dedupe against either so we don't stack a synthesized
  // one on top of it.
  const hasProviderHeat = alerts.some(
    (a) => (a.type === 'nws' || a.type === 'weatherkit') && /\bheat\b/i.test(a.event ?? ''),
  );
  // The same heat index, and the same 103°F line, as the rating's hazard, so
  // the extreme alert appears exactly when the current conditions rate a
  // no-go. It used to read the provider's feels-like against 104°F, which
  // could sit over a "maybe". Without a dew point, the air temperature is a
  // floor for it.
  const index = heatIndex(weather.temperature, weather.dewpoint) ?? weather.temperature;
  if (!hasProviderHeat && index >= HEAT_INDEX_HAZARD.WARNING) {
    const label = formatTemperature(index, tempUnit, { withUnitLabel: true });
    const extreme = index >= HEAT_INDEX_HAZARD.POOR;
    alerts.push({
      type: 'heat',
      severity: extreme ? 'extreme' : 'warning',
      message: extreme ? ALERT_MESSAGES.HEAT_EXTREME(label) : ALERT_MESSAGES.HEAT_WARNING(label),
      icon: 'thermometer',
    });
  }
  return alerts;
};

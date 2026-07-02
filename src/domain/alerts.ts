import { ALERT_MESSAGES } from './copy';
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
  const hasNwsHeat = alerts.some((a) => a.type === 'nws' && /\bheat\b/i.test(a.event ?? ''));
  if (!hasNwsHeat) {
    if (weather.feelsLike > 104)
      alerts.push({
        type: 'heat',
        severity: 'extreme',
        message: ALERT_MESSAGES.HEAT_EXTREME(
          formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
        ),
        icon: 'thermometer',
      });
    else if (weather.feelsLike > 95)
      alerts.push({
        type: 'heat',
        severity: 'warning',
        message: ALERT_MESSAGES.HEAT_WARNING(
          formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
        ),
        icon: 'thermometer',
      });
  }
  return alerts;
};

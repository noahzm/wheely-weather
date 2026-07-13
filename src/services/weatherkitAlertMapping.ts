import type { WeatherKitAlert } from '../../modules/apple-weatherkit/src/AppleWeatherKit.types';
import type { WeatherAlert } from '@/types/weather';

/** Maps WeatherKit's 4-tier severity (plus "unknown") to the app's 2-tier scheme. */
const WEATHERKIT_SEVERITY: Record<string, WeatherAlert['severity']> = {
  minor: 'warning',
  moderate: 'warning',
  unknown: 'warning',
  severe: 'extreme',
  extreme: 'extreme',
};

export function mapWeatherKitAlert(alert: WeatherKitAlert): WeatherAlert {
  const description = [alert.source, alert.region].filter((part) => !!part).join(' • ');
  return {
    type: 'weatherkit',
    severity: WEATHERKIT_SEVERITY[alert.severity] ?? 'warning',
    event: alert.summary,
    headline: alert.summary,
    description: description || undefined,
    message: alert.summary,
    expires: alert.expirationDate,
    detailsUrl: alert.detailsURL,
  };
}

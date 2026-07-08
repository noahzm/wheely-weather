// Mirrors src/services/weatherService.ts's `OpenMeteoData` wire shape, except
// `weather_code: number` (a WMO int) is replaced by `condition: string`
// (WeatherKit's raw `WeatherCondition.rawValue`) — the WMO translation happens
// in src/domain/weatherkit-codes.ts, applied by weatherService.ios.ts.
export interface WeatherKitCurrent {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  wind_speed_10m: number;
  wind_gusts_10m: number | null;
  dewpoint_2m: number;
  condition: string;
  wind_direction_10m: number;
}

export interface WeatherKitHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: (number | null)[];
  precipitation_probability: number[];
  condition: string[];
  dewpoint_2m: number[];
  uv_index: number[];
}

export interface WeatherKitDaily {
  time: string[];
  sunrise: string[];
  sunset: string[];
  apparent_temperature_max: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: (number | null)[];
  precipitation_probability_max: number[];
  condition: string[];
  uv_index_max: number[];
}

export interface WeatherKitForecastResult {
  utc_offset_seconds: number;
  current: WeatherKitCurrent;
  hourly: WeatherKitHourly;
  daily: WeatherKitDaily;
}

export interface WeatherKitAlert {
  summary: string;
  severity: string;
  source: string;
  region: string | null;
  detailsURL: string;
  expirationDate: string;
}

export interface WeatherKitAttribution {
  logoLightURL: string;
  logoDarkURL: string;
  legalPageURL: string;
}

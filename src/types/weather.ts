export type Condition = 'good' | 'fair' | 'marginal' | 'poor' | 'bad';
export type RideStatus = 'yes' | 'maybe' | 'no';
export type MetricType =
  'temperature' | 'windSpeed' | 'windGust' | 'rainChance' | 'aqi' | 'dewpoint' | 'uv' | 'humidity';

export interface HourlyWeather {
  hour: number;
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  dewpoint: number | null;
  weatherCode: number | null;
  uv?: number | null;
  condition: Condition;
}

export interface DailyWeather {
  date: Date | string;
  high: number;
  low: number;
  feelsLike?: number | null;
  dewpoint?: number | null;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  weatherCode: number | null;
  condition: Condition;
}

export interface DaylightWindow {
  sunriseHour: number;
  sunsetHour: number;
}

export interface WeatherAlert {
  type: string;
  severity: 'warning' | 'extreme';
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  expires?: string;
  message?: string;
  icon?: string;
}

export interface Weather {
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  windGust: number | null;
  windDirection?: number | null;
  rainChance: number;
  weatherCode: number | null;
  hasThunderstorms: boolean;
  condition: string;
  dewpoint: number;
  aqi: number | null;
  uvIndex?: number | null;
  uvIndexDailyMax?: number | null;
  hourly: HourlyWeather[];
  pastHourly: HourlyWeather[];
  daily: DailyWeather[];
  sunrise?: string | null;
  sunset?: string | null;
  daylight?: DaylightWindow | null;
  nwsAlerts?: WeatherAlert[];
}

export interface RideFactor {
  type: MetricType | 'weatherCode';
  label: string;
  value: string;
  condition: Condition;
}

export interface GearTipItem {
  slot?: string;
  icon: string;
  label: string;
  qualifier?: string;
}

export interface GearTip {
  headline?: string;
  items: GearTipItem[];
}

export interface GearSuggestion {
  headline: string;
  items: GearTipItem[];
}

export interface ForecastExtras {
  aqi: number | null;
  nwsAlerts: WeatherAlert[];
}

export interface LocationSearchResult {
  lat: number;
  lon: number;
  label: string;
  displayName?: string;
}

export type MockScenario = 'ride' | 'maybe' | 'rest' | 'alert';

/**
 * A rider's home-climate baseline: representative *warm* exposure at home, used
 * to estimate heat/humidity acclimatization. Derived from recent weather because
 * the body acclimatizes to recent exposure (~weeks), not annual normals.
 */
export interface HomeBaseline {
  warmTemp: number;
  warmDewpoint: number;
}

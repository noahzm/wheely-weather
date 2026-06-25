export type Condition = 'good' | 'fair' | 'marginal' | 'poor' | 'bad';
export type RideStatus = 'yes' | 'maybe' | 'no';
export type MetricType =
  | 'feelsLike'
  | 'windSpeed'
  | 'windGust'
  | 'rainChance'
  | 'aqi'
  | 'dewpoint';

export type HourlyWeather = {
  hour: number;
  feelsLike: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  dewpoint: number | null;
  weatherCode: number | null;
  uv?: number | null;
  condition: Condition;
};

export type DailyWeather = {
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
};

export type DaylightWindow = {
  sunriseHour: number;
  sunsetHour: number;
};

export type WeatherAlert = {
  type: string;
  severity: 'warning' | 'extreme';
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  expires?: string;
  message?: string;
  icon?: string;
};

export type Weather = {
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
};

export type RideFactor = {
  type: MetricType | 'weatherCode';
  label: string;
  value: string;
  condition: Condition;
};

export type GearTipItem = {
  slot?: string;
  icon: string;
  label: string;
  qualifier?: string;
};

export type GearTip = {
  headline?: string;
  items: GearTipItem[];
};

export type GearSuggestion = {
  headline: string;
  items: GearTipItem[];
};

export type ForecastExtras = {
  aqi: number | null;
  nwsAlerts: WeatherAlert[];
};

export type LocationSearchResult = {
  lat: number;
  lon: number;
  label: string;
  displayName?: string;
};

export type MockScenario = 'ride' | 'maybe' | 'rest' | 'alert';

import { createContext, useContext, type ReactNode } from 'react';
import { useGlobalSearchParams } from 'expo-router';

import { useWeatherForecast } from './use-weather-forecast';

// ---------- types ----------
// Mirror the return type of useWeatherForecast.
type ForecastContextValue = ReturnType<typeof useWeatherForecast>;

// ---------- context ----------
const ForecastContext = createContext<ForecastContextValue | null>(null);

// ---------- provider ----------
const MOCK_SCENARIOS = new Set(['ride', 'maybe', 'rest', 'alert']);

export function ForecastProvider({ children }: { children: ReactNode }) {
  const params = useGlobalSearchParams<{ mock?: string }>();
  const mockScenario = MOCK_SCENARIOS.has(String(params.mock)) ? String(params.mock) : null;
  const forecast = useWeatherForecast(mockScenario);
  return <ForecastContext.Provider value={forecast}>{children}</ForecastContext.Provider>;
}

// ---------- consumer ----------
export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) throw new Error('useForecast must be used inside <ForecastProvider>');
  return ctx;
}

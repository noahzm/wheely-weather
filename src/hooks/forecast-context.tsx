import { createContext, useContext, useState, type ReactNode } from 'react';
import { useGlobalSearchParams } from 'expo-router';

import { useWeatherForecast } from './use-weather-forecast';

// ---------- types ----------
// Mirror the return type of useWeatherForecast.
type ForecastContextValue = ReturnType<typeof useWeatherForecast>;

// ---------- context ----------
const ForecastContext = createContext<ForecastContextValue | null>(null);

// ---------- provider ----------
const MOCK_SCENARIOS = new Set(['ride', 'maybe', 'rest', 'alert']);

export function ForecastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const params = useGlobalSearchParams<{ mock?: string }>();
  const paramMock = MOCK_SCENARIOS.has(String(params.mock)) ? String(params.mock) : null;
  // Tab navigation drops query params, so latch the last seen scenario for the session.
  const [latchedMock, setLatchedMock] = useState(paramMock);
  if (paramMock && paramMock !== latchedMock) setLatchedMock(paramMock);
  const forecast = useWeatherForecast(paramMock ?? latchedMock);
  return <ForecastContext.Provider value={forecast}>{children}</ForecastContext.Provider>;
}

// ---------- consumer ----------
export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) throw new Error('useForecast must be used inside <ForecastProvider>');
  return ctx;
}

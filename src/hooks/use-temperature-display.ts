import { useResolvedTempUnit } from '@/hooks/settings-context';
import { formatTemperature, formatWindSpeed, type TempUnit } from '@/utils/temperature';

interface TemperatureDisplay {
  /** Concrete display unit ('auto' preference already resolved). */
  unit: TempUnit;
  /** Formats a Fahrenheit source value in the resolved unit. */
  format: (fahrenheit: number, options?: { withUnitLabel?: boolean }) => string;
  /** Formats an mph wind speed in the unit paired with the resolved temperature unit. */
  formatWind: (mph: number) => string;
}

/**
 * The one hook for showing a temperature: resolves the user's unit preference
 * and formats Fahrenheit source values at the display boundary. Domain code
 * stays framework-free and takes `unit` as a plain parameter.
 */
export function useTemperatureDisplay(): TemperatureDisplay {
  const unit = useResolvedTempUnit();
  const format = (fahrenheit: number, options?: { withUnitLabel?: boolean }) =>
    formatTemperature(fahrenheit, unit, options);
  const formatWind = (mph: number) => formatWindSpeed(mph, unit);
  return { unit, format, formatWind };
}

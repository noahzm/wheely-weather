import { useResolvedTempUnit } from '@/hooks/settings-context';
import { formatTemperature, type TempUnit } from '@/utils/temperature';

export interface TemperatureDisplay {
  /** Concrete display unit ('auto' preference already resolved). */
  unit: TempUnit;
  /** Formats a Fahrenheit source value in the resolved unit. */
  format: (fahrenheit: number, options?: { withUnitLabel?: boolean }) => string;
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
  return { unit, format };
}

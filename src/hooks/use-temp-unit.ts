import { useCallback, useEffect, useState } from 'react';
import { loadTempUnit, saveTempUnit, type TempUnitPreference } from '@/services/locationStorage';

/**
 * Persists the user's temperature unit preference (Auto / °F / °C) across
 * sessions via AsyncStorage. 'auto' resolves against the device locale at
 * display time (see `useResolvedTempUnit` in settings-context).
 */
export function useTempUnit(): [TempUnitPreference, (next: TempUnitPreference) => void] {
  const [tempUnit, setTempUnit] = useState<TempUnitPreference>('auto');

  useEffect(() => {
    void loadTempUnit().then(setTempUnit);
  }, []);

  const select = useCallback((next: TempUnitPreference) => {
    setTempUnit(next);
    saveTempUnit(next).catch(() => {
      // Best-effort persistence; ignore write failures.
    });
  }, []);

  return [tempUnit, select];
}

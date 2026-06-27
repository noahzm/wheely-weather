import { useCallback, useEffect, useState } from 'react';
import { loadAppearance, saveAppearance, type Appearance } from '@/services/locationStorage';

/**
 * Persists the user's appearance preference (System / Light / Dark) across
 * sessions via AsyncStorage. The root layout reads this to drive
 * `ColorSchemeOverrideContext`; the settings screen reads+writes it.
 */
export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>('system');

  useEffect(() => {
    void loadAppearance().then(setAppearance);
  }, []);

  const select = useCallback((next: Appearance) => {
    setAppearance(next);
    saveAppearance(next).catch(() => {
      // Best-effort persistence; ignore write failures.
    });
  }, []);

  return [appearance, select];
}

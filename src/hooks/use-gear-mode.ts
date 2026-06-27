import { useCallback, useEffect, useState } from 'react';
import { loadGearMode, saveGearMode } from '@/services/locationStorage';

type GearMode = 'casual' | 'pro';

/**
 * Persists the user's selected gear mode (Everyday / Performance) across
 * sessions via AsyncStorage. Components that need gear mode read+write state
 * use this hook; storage details stay in the services layer.
 */
export function useGearMode(): [GearMode, (next: GearMode) => void] {
  const [mode, setMode] = useState<GearMode>('casual');

  useEffect(() => {
    void loadGearMode().then(setMode);
  }, []);

  const select = useCallback((next: GearMode) => {
    setMode(next);
    saveGearMode(next).catch(() => {
      // Best-effort persistence; ignore write failures.
    });
  }, []);

  return [mode, select];
}

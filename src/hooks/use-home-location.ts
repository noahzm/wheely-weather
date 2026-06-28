import { useCallback, useEffect, useState } from 'react';
import {
  loadHomeLocation,
  saveHomeLocation,
  clearHomeLocation,
  type SavedLocation,
} from '@/services/locationStorage';

/**
 * Persists the rider's "home" location across sessions. Home anchors the
 * acclimatization baseline: the verdict for any viewed city is judged against
 * what the rider is used to at home. When unset, callers fall back to the active
 * location (zero acclimatization shift).
 */
export function useHomeLocation(): [SavedLocation | null, (next: SavedLocation | null) => void] {
  const [home, setHome] = useState<SavedLocation | null>(null);

  useEffect(() => {
    void loadHomeLocation().then(setHome);
  }, []);

  const select = useCallback((next: SavedLocation | null) => {
    setHome(next);
    if (next) {
      saveHomeLocation(next).catch(() => {
        // Best-effort persistence; ignore write failures.
      });
    } else {
      clearHomeLocation().catch(() => {
        // Best-effort; ignore clear failures.
      });
    }
  }, []);

  return [home, select];
}

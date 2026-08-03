import { useEffect, useState } from 'react';

import { searchLocations } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';

/** Below this many characters a query is treated as "not searching yet". */
export const MIN_SEARCH_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

export interface LocationSearchState {
  results: RecentLocation[];
  message: string;
  isLoading: boolean;
}

/**
 * Debounced city search shared by the location screen and the home-climate
 * picker, so both get the same staleness guarantees.
 *
 * The two guards below are the whole point of this hook, and both are easy to
 * omit when reimplementing it: shortening the query back under the minimum must
 * clear the previous results immediately, and during the debounce window the
 * previous query's results must not still be on screen looking selectable.
 * Deriving both at render (rather than only inside the effect) is what makes
 * that hold — an effect that early-returns leaves stale state visible.
 */
export function useLocationSearch(query: string): LocationSearchState {
  const trimmed = query.trim();
  const [fetchKey, setFetchKey] = useState('');
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) return;

    const controller = new AbortController();
    const runSearch = async () => {
      setFetchKey(trimmed);
      setResults([]);
      setMessage('Searching…');
      setIsLoading(true);
      try {
        const places = await searchLocations(trimmed, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(
          (places as (RecentLocation | null)[]).filter((p): p is RecentLocation => p != null),
        );
        setMessage(places.length > 0 ? '' : 'No matches.');
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        const rateLimited = error instanceof Error && error.message === 'Rate limited';
        setMessage(
          rateLimited ? 'Too many searches. Try again shortly.' : 'Search unavailable. Try again.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    const timer = setTimeout(() => void runSearch(), SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
    return { results: [], message: '', isLoading: false };
  }
  if (fetchKey !== trimmed) {
    return { results: [], message: 'Searching…', isLoading: true };
  }
  return { results, message, isLoading };
}

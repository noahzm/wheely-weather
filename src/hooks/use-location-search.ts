import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { searchLocations } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';

/** Below this many characters a query is treated as "not searching yet". */
export const MIN_SEARCH_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

interface LocationSearchState {
  results: RecentLocation[];
  message: string;
  isLoading: boolean;
  submitSearch: () => void;
}

/**
 * iOS uses debounced MapKit autocomplete. Other platforms only send an
 * explicitly submitted query: public Nominatim prohibits autocomplete.
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
  const autocomplete = Platform.OS === 'ios';
  const [submission, setSubmission] = useState({ draft: '', query: '', attempt: 0 });
  if (submission.draft !== trimmed) {
    setSubmission({ draft: trimmed, query: '', attempt: submission.attempt });
  }
  const submitted = autocomplete || (submission.draft === trimmed && submission.query === trimmed);
  const attempt = submission.attempt;
  const submitSearch = () => {
    setSubmission((current) => ({ draft: trimmed, query: trimmed, attempt: current.attempt + 1 }));
  };
  const [fetchKey, setFetchKey] = useState({ query: '', attempt: 0 });
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH || !submitted) return;

    const controller = new AbortController();
    const runSearch = async () => {
      setFetchKey({ query: trimmed, attempt });
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
    const timer = setTimeout(() => void runSearch(), autocomplete ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, submitted, attempt, autocomplete]);

  if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
    return { results: [], message: '', isLoading: false, submitSearch };
  }
  if (!submitted) {
    return {
      results: [],
      message: 'Press Search to find a place.',
      isLoading: false,
      submitSearch,
    };
  }
  if (fetchKey.query !== trimmed || fetchKey.attempt !== attempt) {
    return { results: [], message: 'Searching…', isLoading: true, submitSearch };
  }
  return { results, message, isLoading, submitSearch };
}

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { buildSections, type RowItem } from '@/components/wheely/location-search-list.types';
import { useForecast } from '@/hooks/forecast-context';
import { searchLocations } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';

function useLocationSearch(query: string) {
  const trimmed = query.trim();
  const [fetchKey, setFetchKey] = useState('');
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (trimmed.length < 2) return;

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
    const timer = setTimeout(() => void runSearch(), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (trimmed.length < 2) {
    return { results: [], message: '', isLoading: false };
  }
  if (fetchKey !== trimmed) {
    return { results: [], message: 'Searching…', isLoading: true };
  }
  return { results, message, isLoading };
}

export function useLocationSearchScreen() {
  const router = useRouter();
  const forecast = useForecast();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { results, message, isLoading } = useLocationSearch(query);

  const goToHome = useCallback(() => {
    // On web the tabs render as a Stack; navigate() pushes a duplicate home
    // screen instead of unwinding, so dismiss back to it. Native tabs switch.
    if (Platform.OS === 'web') {
      router.dismissTo('/');
    } else {
      router.navigate('/');
    }
  }, [router]);

  const choosePlace = useCallback(
    async (place: RecentLocation) => {
      setBusy(true);
      await forecast.setManualLocation(place);
      setBusy(false);
      goToHome();
    },
    [forecast, goToHome],
  );

  const handleUseDevice = useCallback(async () => {
    setBusy(true);
    const ok = await forecast.useDeviceLocation();
    setBusy(false);
    if (ok) goToHome();
  }, [forecast, goToHome]);

  const handleTogglePin = useCallback(
    (item: RowItem) => {
      if (item._kind) return;
      void forecast.togglePin(item);
    },
    [forecast],
  );

  const handleSelect = useCallback(
    (item: RowItem) => {
      if (item._kind === 'device') void handleUseDevice();
      else void choosePlace(item);
    },
    [handleUseDevice, choosePlace],
  );

  const isSearching = query.trim().length >= 2;
  const sections = buildSections(
    isSearching,
    results,
    forecast.pinnedLocations,
    forecast.recentLocations,
  );

  return {
    query,
    setQuery,
    busy,
    message,
    isLoading,
    isSearching,
    resultsCount: results.length,
    sections,
    pinnedLocations: forecast.pinnedLocations,
    handleSelect,
    handleTogglePin,
  };
}

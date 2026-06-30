import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { buildSections, type RowItem } from '@/components/wheely/location-search-list.types';
import { useForecast } from '@/hooks/forecast-context';
import { searchLocations } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';

function useLocationSearch(query: string) {
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const runSearch = async () => {
      setMessage('Searching…');
      try {
        const places = await searchLocations(trimmed, { signal: controller.signal });
        setResults(
          (places as (RecentLocation | null)[]).filter((p): p is RecentLocation => p != null),
        );
        setMessage(places.length > 0 ? '' : 'No matches.');
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setMessage('Search unavailable. Try again.');
      }
    };
    const timer = setTimeout(() => void runSearch(), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, message };
}

export function useLocationSearchScreen() {
  const router = useRouter();
  const forecast = useForecast();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { results, message } = useLocationSearch(query);

  const goToHome = useCallback(() => {
    router.navigate('/');
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
    isSearching,
    resultsCount: results.length,
    sections,
    pinnedLocations: forecast.pinnedLocations,
    handleSelect,
    handleTogglePin,
  };
}

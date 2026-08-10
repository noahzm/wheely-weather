import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

import {
  buildSections,
  isSavablePlace,
  resolveSuggestedPlace,
  type RowItem,
} from '@/utils/locationRows';
import { useForecast } from '@/hooks/forecast-context';
import { useHomeLocation } from '@/hooks/settings-context';
import { MIN_SEARCH_QUERY_LENGTH, useLocationSearch } from '@/hooks/use-location-search';
import { resolveSuggestion } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';

export function useLocationSearchScreen() {
  const router = useRouter();
  const forecast = useForecast();

  const [homeLocation, setHomeLocation] = useHomeLocation();
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
    async (place: RowItem) => {
      setBusy(true);
      const target = await resolveSuggestedPlace(place, resolveSuggestion);
      if (!target) {
        setBusy(false);
        return;
      }
      const ok = await forecast.setManualLocation(target);
      setBusy(false);
      if (ok) goToHome();
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
      if (!isSavablePlace(item)) return;
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

  // Home is stored as a SavedLocation but listed as a RecentLocation row, so it
  // needs a label; fall back to coordinates when the saved entry has no name.
  const homeRow: RecentLocation | null = homeLocation
    ? {
        lat: homeLocation.lat,
        lon: homeLocation.lon,
        label:
          homeLocation.name ?? `${homeLocation.lat.toFixed(1)}, ${homeLocation.lon.toFixed(1)}`,
      }
    : null;

  const handleToggleHome = useCallback(
    (item: RowItem) => {
      if (!isSavablePlace(item)) return;
      const alreadyHome = homeLocation?.lat === item.lat && homeLocation.lon === item.lon;
      setHomeLocation(
        alreadyHome ? null : { lat: item.lat, lon: item.lon, name: item.label, source: 'manual' },
      );
    },
    [homeLocation, setHomeLocation],
  );

  const isSearching = query.trim().length >= MIN_SEARCH_QUERY_LENGTH;
  const sections = buildSections(
    isSearching,
    results,
    forecast.pinnedLocations,
    forecast.recentLocations,
    homeRow,
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
    homeLocation: homeRow,
    activeLocation: forecast.savedLocation,
    handleSelect,
    handleTogglePin,
    handleToggleHome,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { searchLocations } from '@/services/locationSearch';
import { DEFAULT_LOCATION } from '@/services/weatherService';
import type { RecentLocation } from '@/services/locationStorage';
import { Spacing, type WheelyPalette } from '@/constants/theme';

type Section = {
  title: string;
  data: RecentLocation[];
};

export default function LocationScreen() {
  const router = useRouter();
  const forecast = useForecast();
  const c = useWheelyColors();
  const styles = makeStyles(c);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Short query: render derives display from recentLocations/isSearching guard.
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      setMessage('Searching…');
      try {
        const places = await searchLocations(trimmed, { signal: controller.signal });
        setResults((places as (RecentLocation | null)[]).filter((p): p is RecentLocation => p != null));
        setMessage(places.length ? '' : 'No matches.');
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'AbortError') return;
        setMessage('Search unavailable. Try again.');
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choosePlace = useCallback(
    async (place: RecentLocation) => {
      setBusy(true);
      await forecast.setManualLocation(place);
      setBusy(false);
      router.back();
    },
    [forecast, router],
  );

  const handleUseDevice = useCallback(async () => {
    setBusy(true);
    const ok = await forecast.useDeviceLocation();
    setBusy(false);
    if (ok) router.back();
  }, [forecast, router]);

  const handleUseDefault = useCallback(async () => {
    setBusy(true);
    await forecast.useDefaultLocation();
    setBusy(false);
    router.back();
  }, [forecast, router]);

  // Build section list data
  const isSearching = query.trim().length >= 2;
  const sections: Section[] = [];

  if (isSearching) {
    // Always include Results when actively searching — the footer shows status messages.
    sections.push({ title: 'Results', data: results });
  } else if (forecast.recentLocations.length > 0) {
    sections.push({ title: 'Recent', data: forecast.recentLocations });
  }

  // The actions section is always shown
  const actionRows: RecentLocation[] = [
    { lat: 0, lon: 0, label: 'Use Current Location', displayName: '__device__' },
    { lat: 0, lon: 0, label: DEFAULT_LOCATION, displayName: '__default__' },
  ];
  sections.push({ title: 'Options', data: actionRows });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Location',
          headerSearchBarOptions: {
            placeholder: 'Search a city or place',
            autoCapitalize: 'words',
            hideWhenScrolling: false,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
          },
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        )}
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            item.displayName === '__device__' || item.displayName === '__default__'
              ? item.displayName
              : `${item.lat}-${item.lon}-${index}`
          }
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionHeaderText}>{section.title}</ThemedText>
            </View>
          )}
          renderItem={({ item }) => {
            const isDevice = item.displayName === '__device__';
            const isDefault = item.displayName === '__default__';
            const isAction = isDevice || isDefault;

            return (
              <Pressable
                onPress={() => {
                  if (isDevice) handleUseDevice();
                  else if (isDefault) handleUseDefault();
                  else choosePlace(item);
                }}
                disabled={busy}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                {isDevice && (
                  <SymbolView
                    name="location.fill"
                    size={18}
                    tintColor={c.primary}
                    style={styles.rowIcon}
                  />
                )}
                <View style={styles.rowContent}>
                  <ThemedText
                    style={[styles.rowLabel, isAction && styles.rowLabelAction]}
                    numberOfLines={1}>
                    {item.label}
                  </ThemedText>
                  {!isAction && !!item.displayName && !item.displayName.startsWith(item.label) && (
                    <ThemedText style={styles.rowSub} numberOfLines={1}>
                      {item.displayName}
                    </ThemedText>
                  )}
                </View>
                {!isAction && (
                  <SymbolView
                    name="chevron.right"
                    size={13}
                    tintColor={c.mutedInk}
                    style={styles.chevron}
                  />
                )}
              </Pressable>
            );
          }}
          renderSectionFooter={({ section }) => {
            if (section.title === 'Options' || section.data.length > 0 || !message) return null;
            return (
              <View style={styles.messageRow}>
                <ThemedText style={styles.messageText}>{message}</ThemedText>
              </View>
            );
          }}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </>
  );
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Platform.OS === 'ios' ? c.background : c.background,
    },
    busyOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.15)',
      zIndex: 10,
    },
    sectionHeader: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.one,
      backgroundColor: c.background,
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.mutedInk,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionSeparator: {
      height: Spacing.three,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: Spacing.four,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      backgroundColor: c.paper,
      minHeight: 52,
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowIcon: {
      marginRight: Spacing.three,
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: '400',
      color: c.ink,
    },
    rowLabelAction: {
      color: c.ink,
      fontWeight: '500',
    },
    rowSub: {
      fontSize: 13,
      color: c.mutedInk,
    },
    chevron: {
      marginLeft: Spacing.two,
    },
    messageRow: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      backgroundColor: c.paper,
    },
    messageText: {
      fontSize: 15,
      color: c.mutedInk,
    },
  });
}

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { ChevronRight, Navigation, Pin, Search, X } from 'lucide-react-native';

import {
  BrutalCard,
  HapticPressable,
  SectionTitle,
  WebContentColumn,
  bottomNavBarHeight,
} from '@/components/wheely';
import { ThemedText } from '@/components/themed-text';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { searchLocations } from '@/services/locationSearch';
import type { RecentLocation } from '@/services/locationStorage';
import { Fonts, Spacing, TRANSPARENT } from '@/constants/theme';

const BUSY_OVERLAY_COLOR = 'rgba(0,0,0,0.15)';
const ios = Platform.OS === 'ios';

type RowItem = RecentLocation & { _kind?: 'device' };
interface Section {
  title: string;
  data: RowItem[];
}

function isPinned(place: { lat: number; lon: number }, pins: RecentLocation[]): boolean {
  return pins.some((p) => p.lat === place.lat && p.lon === place.lon);
}

function renderPinIcon(c: ReturnType<typeof useWheelyColors>, pinned: boolean) {
  if (ios) {
    return (
      <SymbolView
        name={pinned ? 'pin.fill' : 'pin'}
        size={16}
        tintColor={pinned ? c.ink : c.mutedInk}
      />
    );
  }
  return <Pin size={16} color={pinned ? c.ink : c.mutedInk} strokeWidth={pinned ? 2.5 : 2} />;
}

function PinButton({ pinned, onPress }: Readonly<{ pinned: boolean; onPress: () => void }>) {
  const c = useWheelyColors();

  if (ios) {
    return (
      <GlassView isInteractive glassEffectStyle="regular" style={pinButtonStyles.glass}>
        <HapticPressable
          onPress={onPress}
          style={pinButtonStyles.hit}
          accessibilityRole="button"
          accessibilityLabel={pinned ? 'Unpin location' : 'Pin location'}
        >
          {renderPinIcon(c, pinned)}
        </HapticPressable>
      </GlassView>
    );
  }

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        pinButtonStyles.fallback,
        { borderColor: c.border },
        pressed && pinButtonStyles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={pinned ? 'Unpin location' : 'Pin location'}
    >
      {renderPinIcon(c, pinned)}
    </HapticPressable>
  );
}

const pinButtonStyles = StyleSheet.create({
  glass: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  hit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});

function buildSections(
  isSearching: boolean,
  results: RecentLocation[],
  pinnedLocations: RecentLocation[],
  recentLocations: RecentLocation[],
): Section[] {
  const sections: Section[] = [];
  if (isSearching) {
    if (results.length > 0) sections.push({ title: 'Results', data: results });
  } else {
    if (pinnedLocations.length > 0) sections.push({ title: 'Pinned', data: pinnedLocations });
    if (recentLocations.length > 0) sections.push({ title: 'Recent', data: recentLocations });
  }
  if (!isSearching) {
    sections.push({
      title: 'Options',
      data: [{ lat: 0, lon: 0, label: 'Use Current Location', _kind: 'device' }],
    });
  }
  return sections;
}

function LocationRow({
  item,
  isLast,
  busy,
  pinned,
  onSelect,
  onTogglePin,
}: Readonly<{
  item: RowItem;
  isLast: boolean;
  busy: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}>) {
  const c = useWheelyColors();
  const isDevice = item._kind === 'device';
  const isAction = isDevice;
  const showSub = !isAction && !!item.displayName && !item.displayName.startsWith(item.label);

  return (
    <HapticPressable
      style={({ pressed }) => [
        styles.row,
        { borderColor: c.border },
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onSelect}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      {isDevice &&
        (ios ? (
          <SymbolView name="location.fill" size={18} tintColor={c.ink} style={styles.rowIcon} />
        ) : (
          <Navigation size={18} color={c.ink} strokeWidth={2.5} style={styles.rowIcon} />
        ))}
      <View style={styles.rowContent}>
        <ThemedText
          style={[styles.rowLabel, isAction && styles.rowLabelAction, { color: c.ink }]}
          numberOfLines={1}
        >
          {item.label}
        </ThemedText>
        {showSub && (
          <ThemedText style={[styles.rowSub, { color: c.mutedInk }]} numberOfLines={1}>
            {item.displayName}
          </ThemedText>
        )}
      </View>
      {!isAction && <PinButton pinned={pinned} onPress={onTogglePin} />}
      {!isAction &&
        (ios ? (
          <SymbolView
            name="chevron.right"
            size={13}
            tintColor={c.mutedInk}
            style={styles.chevron}
          />
        ) : (
          <ChevronRight size={16} color={c.mutedInk} strokeWidth={2.5} style={styles.chevron} />
        ))}
    </HapticPressable>
  );
}

function LocationList({
  sections,
  busy,
  pinnedLocations,
  onSelect,
  onTogglePin,
}: Readonly<{
  sections: Section[];
  busy: boolean;
  pinnedLocations: RecentLocation[];
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
}>) {
  return (
    <>
      {sections.map((section) => (
        <View key={section.title} style={styles.sectionGroup}>
          <SectionTitle title={section.title} />
          <BrutalCard style={styles.sectionCard}>
            {section.data.map((item, idx) => (
              <LocationRow
                key={item._kind ?? `${item.lat}-${item.lon}-${idx}`}
                item={item}
                isLast={idx === section.data.length - 1}
                busy={busy}
                pinned={!item._kind && isPinned(item, pinnedLocations)}
                onSelect={() => {
                  onSelect(item);
                }}
                onTogglePin={() => {
                  onTogglePin(item);
                }}
              />
            ))}
          </BrutalCard>
        </View>
      ))}
    </>
  );
}

function WebSearchField({
  c,
  query,
  onQueryChange,
}: Readonly<{
  c: ReturnType<typeof useWheelyColors>;
  query: string;
  onQueryChange: (text: string) => void;
}>) {
  return (
    <BrutalCard small style={styles.searchCard}>
      <View style={styles.searchRow}>
        <Search size={18} color={c.mutedInk} strokeWidth={2.5} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search a city or place"
          placeholderTextColor={c.mutedInk}
          style={[styles.searchInput, { color: c.ink }]}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search for a location"
        />
        {query.length > 0 && (
          <HapticPressable
            onPress={() => {
              onQueryChange('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={c.mutedInk} strokeWidth={2.5} />
          </HapticPressable>
        )}
      </View>
    </BrutalCard>
  );
}

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

export default function LocationSearchScreen() {
  const router = useRouter();
  const forecast = useForecast();
  const c = useWheelyColors();

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

  return (
    <>
      <Stack.Screen
        options={
          Platform.OS === 'web'
            ? { headerShown: false }
            : {
                headerSearchBarOptions: {
                  placeholder: 'Search a city or place',
                  autoCapitalize: 'words',
                  hideWhenScrolling: false,
                  onChangeText: (e) => {
                    setQuery(e.nativeEvent.text);
                  },
                },
              }
        }
      />
      <View style={styles.screen} collapsable={false}>
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={
            Platform.OS === 'web' ? styles.scrollContentWeb : styles.scrollContent
          }
        >
          <WebContentColumn innerStyle={styles.scrollInner}>
            {Platform.OS === 'web' && (
              <WebSearchField c={c} query={query} onQueryChange={setQuery} />
            )}
            {isSearching && results.length === 0 && !!message && (
              <BrutalCard small>
                <ThemedText style={[styles.messageText, { color: c.mutedInk }]}>
                  {message}
                </ThemedText>
              </BrutalCard>
            )}

            <LocationList
              sections={sections}
              busy={busy}
              pinnedLocations={forecast.pinnedLocations}
              onSelect={handleSelect}
              onTogglePin={handleTogglePin}
            />
          </WebContentColumn>
        </ScrollView>
        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  scroll: {
    backgroundColor: TRANSPARENT,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  scrollContentWeb: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: bottomNavBarHeight(0) + Spacing.six,
  },
  scrollInner: {
    gap: Spacing.four,
  },
  searchCard: {
    paddingVertical: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.sans,
    paddingVertical: Spacing.one,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  messageText: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  sectionGroup: {
    gap: Spacing.two,
  },
  sectionCard: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowDivider: {
    borderBottomWidth: 2,
  },
  rowPressed: {
    opacity: 0.5,
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
    fontFamily: Fonts.sans,
  },
  rowLabelAction: {
    fontFamily: Fonts.monoBold,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  chevron: {
    marginLeft: Spacing.two,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUSY_OVERLAY_COLOR,
    zIndex: 10,
  },
});

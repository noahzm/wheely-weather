import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  PlatformColor,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ScreenShell } from '@/components/tartan-background';
import { HapticPressable } from '@/components/wheely';
import { ThemedText } from '@/components/themed-text';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { searchLocations } from '@/services/locationSearch';
import { DEFAULT_LOCATION } from '@/services/weatherService';
import type { RecentLocation } from '@/services/locationStorage';
import { Fonts, Spacing, TRANSPARENT } from '@/constants/theme';

const IOS_TINT = '#007AFF';
const BUSY_OVERLAY_COLOR = 'rgba(0,0,0,0.15)';

const ios = Platform.OS === 'ios';

type RowItem = RecentLocation & { _kind?: 'device' | 'default' };
interface Section {
  title: string;
  data: RowItem[];
}

// iOS 26 native system colors — let the sheet's Liquid Glass surface show through
const CELL_BG = ios ? PlatformColor('secondarySystemGroupedBackground') : undefined;
const SEPARATOR = ios ? PlatformColor('separator') : undefined;
const LABEL = ios ? PlatformColor('label') : undefined;
const SECONDARY_LABEL = ios ? PlatformColor('secondaryLabel') : undefined;

function buildSections(
  isSearching: boolean,
  results: RecentLocation[],
  recentLocations: RecentLocation[],
): Section[] {
  const sections: Section[] = [];
  if (isSearching) {
    if (results.length > 0) sections.push({ title: 'Results', data: results });
  } else if (recentLocations.length > 0) {
    sections.push({ title: 'Recent', data: recentLocations });
  }
  sections.push({
    title: 'Options',
    data: [
      { lat: 0, lon: 0, label: 'Use Current Location', _kind: 'device' },
      { lat: 0, lon: 0, label: DEFAULT_LOCATION, _kind: 'default' },
    ],
  });
  return sections;
}

function LocationRow({
  item,
  showSeparator,
  busy,
  labelColor,
  mutedColor,
  onPress,
}: Readonly<{
  item: RowItem;
  showSeparator: boolean;
  busy: boolean;
  labelColor: string;
  mutedColor: string;
  onPress: () => void;
}>) {
  const c = useWheelyColors();
  const isDevice = item._kind === 'device';
  const isAction = isDevice || item._kind === 'default';
  const showSub = !isAction && !!item.displayName && !item.displayName.startsWith(item.label);
  return (
    <View>
      {showSeparator && (
        <View
          style={[
            styles.separator,
            ios
              ? { backgroundColor: SEPARATOR as unknown as string, marginLeft: Spacing.four }
              : { backgroundColor: c.border, marginLeft: Spacing.four },
          ]}
        />
      )}
      <HapticPressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={onPress}
        disabled={busy}
      >
        {isDevice && (
          <SymbolView name="location.fill" size={18} tintColor={IOS_TINT} style={styles.rowIcon} />
        )}
        <View style={styles.rowContent}>
          <ThemedText
            style={[styles.rowLabel, { color: isAction ? IOS_TINT : labelColor }]}
            numberOfLines={1}
          >
            {item.label}
          </ThemedText>
          {showSub && (
            <ThemedText style={[styles.rowSub, { color: mutedColor }]} numberOfLines={1}>
              {item.displayName}
            </ThemedText>
          )}
        </View>
        {!isAction && (
          <SymbolView
            name="chevron.right"
            size={13}
            tintColor={mutedColor}
            style={styles.chevron}
          />
        )}
      </HapticPressable>
    </View>
  );
}

function LocationList({
  sections,
  busy,
  labelColor,
  mutedColor,
  onSelect,
}: Readonly<{
  sections: Section[];
  busy: boolean;
  labelColor: string;
  mutedColor: string;
  onSelect: (item: RowItem) => void;
}>) {
  return (
    <>
      {sections.map((section) => (
        <View key={section.title} style={styles.sectionGroup}>
          <ThemedText style={[styles.sectionHeader, { color: mutedColor }]}>
            {section.title}
          </ThemedText>
          <View
            style={[styles.sectionCard, ios && { backgroundColor: CELL_BG as unknown as string }]}
          >
            {section.data.map((item, idx) => (
              <LocationRow
                key={item._kind ?? `${item.lat}-${item.lon}-${idx}`}
                item={item}
                showSeparator={idx > 0}
                busy={busy}
                labelColor={labelColor}
                mutedColor={mutedColor}
                onPress={() => {
                  onSelect(item);
                }}
              />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

export default function LocationScreen() {
  const router = useRouter();
  const forecast = useForecast();
  const c = useWheelyColors();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecentLocation[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runSearch = async () => {
      setMessage('Searching…');
      try {
        const places = await searchLocations(trimmed, { signal: controller.signal });
        setResults(
          (places as (RecentLocation | null)[]).filter((p): p is RecentLocation => p != null),
        );
        setMessage(places.length > 0 ? '' : 'No matches.');
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : '';
        if (name === 'AbortError') return;
        setMessage('Search unavailable. Try again.');
      }
    };
    const timer = setTimeout(() => void runSearch(), 300);
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

  const isSearching = query.trim().length >= 2;
  const sections = buildSections(isSearching, results, forecast.recentLocations);

  const labelColor = (LABEL ?? c.ink) as string;
  const mutedColor = (SECONDARY_LABEL ?? c.mutedInk) as string;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Location',
          headerSearchBarOptions: {
            placeholder: 'Search a city or place',
            autoCapitalize: 'words',
            hideWhenScrolling: false,
            onChangeText: (e) => {
              setQuery(e.nativeEvent.text);
            },
          },
        }}
      />
      <ScreenShell>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          {busy && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator color={c.primary} size="large" />
            </View>
          )}
          <ScrollView
            style={styles.scroll}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollContent}
          >
            {isSearching && results.length === 0 && !!message && (
              <ThemedText style={[styles.messageText, { color: mutedColor }]}>{message}</ThemedText>
            )}

            <LocationList
              sections={sections}
              busy={busy}
              labelColor={labelColor}
              mutedColor={mutedColor}
              onSelect={(item) => {
                if (item._kind === 'device') void handleUseDevice();
                else if (item._kind === 'default') void handleUseDefault();
                else void choosePlace(item);
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </ScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  scroll: {
    backgroundColor: TRANSPARENT,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUSY_OVERLAY_COLOR,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  messageText: {
    fontSize: 15,
    opacity: 0.5,
    paddingTop: Spacing.three,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  sectionGroup: {
    gap: Spacing.two,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.two,
    fontFamily: Fonts.sans,
  },
  sectionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    minHeight: 52,
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
    fontWeight: '400',
    fontFamily: Fonts.sans,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  chevron: {
    marginLeft: Spacing.two,
  },
});

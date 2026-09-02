import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Navigation, Pin } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { resolveLocationChipName } from '@/utils/locationTitle';
import { sameCoords } from '@/utils/locationRows';
import {
  Fonts,
  FontWeightBlack,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';
import { HapticPressable, PlatformIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.two,
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingVertical: 2,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.paper,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 6,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    pillActive: {
      backgroundColor: c.primary,
      borderColor: c.border,
    },
    pillText: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontSize: Type.small.fontSize,
      fontWeight: '600',
    },
    pillTextActive: {
      color: c.primaryInk,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
    },
    iconWrap: {
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

export function PinnedLocationsBar({
  pinnedLocations,
  savedLocation,
  followingDevice,
  onSelectCurrentLocation,
  onSelectPinnedLocation,
}: Readonly<{
  pinnedLocations: RecentLocation[];
  savedLocation: SavedLocation | null;
  followingDevice: boolean;
  onSelectCurrentLocation: () => void;
  onSelectPinnedLocation: (place: RecentLocation) => void;
}>) {
  const { c, styles } = useStyles();

  if (pinnedLocations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="tablist"
        accessibilityLabel="Pinned locations"
      >
        <HapticPressable
          onPress={() => {
            onSelectCurrentLocation();
          }}
          accessibilityRole="tab"
          accessibilityLabel="Current location"
          accessibilityState={{ selected: followingDevice }}
          style={[styles.pill, followingDevice && styles.pillActive]}
        >
          <View style={styles.iconWrap}>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="location.fill"
                size={12}
                tintColor={followingDevice ? c.primaryInk : c.ink}
              />
            ) : (
              <PlatformIcon
                icon={Navigation}
                size={12}
                color={followingDevice ? c.primaryInk : c.ink}
                strokeWidth={2.5}
              />
            )}
          </View>
          <ThemedText style={[styles.pillText, followingDevice && styles.pillTextActive]}>
            Current
          </ThemedText>
        </HapticPressable>

        {pinnedLocations.map((place) => {
          const active = !followingDevice && sameCoords(place, savedLocation);
          const name = resolveLocationChipName(place);
          return (
            <HapticPressable
              key={`${place.lat}-${place.lon}`}
              onPress={() => {
                onSelectPinnedLocation(place);
              }}
              accessibilityRole="tab"
              accessibilityLabel={`Location: ${name}`}
              accessibilityState={{ selected: active }}
              style={[styles.pill, active && styles.pillActive]}
            >
              <View style={styles.iconWrap}>
                {Platform.OS === 'ios' ? (
                  <SymbolView
                    name="pin.fill"
                    size={12}
                    tintColor={active ? c.primaryInk : c.mutedInk}
                  />
                ) : (
                  <PlatformIcon
                    icon={Pin}
                    size={12}
                    color={active ? c.primaryInk : c.mutedInk}
                    strokeWidth={2}
                  />
                )}
              </View>
              <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>
                {name}
              </ThemedText>
            </HapticPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

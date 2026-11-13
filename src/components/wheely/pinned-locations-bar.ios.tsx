import { StyleSheet, View } from 'react-native';
import { Button, Host, HStack, ScrollView } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  padding,
  scrollIndicators,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { Spacing } from '@/constants/theme';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';
import { selectionFeedback } from '@/utils/haptics';
import { sameCoords } from '@/utils/locationRows';
import { resolveLocationChipName } from '@/utils/locationTitle';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.two,
  },
  host: {
    width: '100%',
  },
});

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
  const c = useWheelyColors();
  const scheme = useColorSchemeName();

  if (pinnedLocations.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel="Pinned locations"
    >
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <ScrollView
          axes="horizontal"
          showsIndicators={false}
          modifiers={[scrollIndicators('never', 'horizontal')]}
        >
          <HStack spacing={8} modifiers={[padding({ vertical: 2, trailing: 8 })]}>
            <Button
              label="Current"
              systemImage="location.fill"
              onPress={() => {
                selectionFeedback();
                onSelectCurrentLocation();
              }}
              modifiers={[
                buttonStyle(followingDevice ? 'borderedProminent' : 'bordered'),
                buttonBorderShape('capsule'),
                controlSize('small'),
                tint(followingDevice ? c.primary : c.ink),
                foregroundStyle(followingDevice ? c.primaryInk : c.ink),
                accessibilityLabel('Current location'),
                ...(followingDevice ? [accessibilityAddTraits(['isSelected'])] : []),
              ]}
            />

            {pinnedLocations.map((place) => {
              const active = !followingDevice && sameCoords(place, savedLocation);
              const name = resolveLocationChipName(place);
              return (
                <Button
                  key={`${place.lat}-${place.lon}`}
                  label={name}
                  systemImage="pin.fill"
                  onPress={() => {
                    selectionFeedback();
                    onSelectPinnedLocation(place);
                  }}
                  modifiers={[
                    buttonStyle(active ? 'borderedProminent' : 'bordered'),
                    buttonBorderShape('capsule'),
                    controlSize('small'),
                    tint(active ? c.primary : c.ink),
                    foregroundStyle(active ? c.primaryInk : c.ink),
                    accessibilityLabel(`Location: ${name}`),
                    ...(active ? [accessibilityAddTraits(['isSelected'])] : []),
                  ]}
                />
              );
            })}
          </HStack>
        </ScrollView>
      </Host>
    </View>
  );
}

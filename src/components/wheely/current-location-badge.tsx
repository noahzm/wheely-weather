import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, Type, type WheelyPalette } from '@/constants/theme';

import { PlatformIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      // Pulls up through the content column's top margin and into the large
      // title's native bottom whitespace, so the badge reads as part of the
      // title rather than as the first item of the page.
      marginTop: Platform.OS === 'web' ? 0 : -Spacing.four,
    },
    label: {
      color: c.mutedInk,
      fontSize: Type.small.fontSize,
    },
  });
}

/**
 * Marks the header city as the rider's live device location rather than a city
 * they picked. Sits under the native large title because that title is a plain
 * string — an SF Symbol cannot be rendered inside it — so the arrow goes in the
 * content just below. Web renders the same arrow inline beside its own heading.
 *
 * The glyph matches the "Use Current Location" row on the search screen:
 * `location.fill` on iOS, lucide `Navigation` elsewhere.
 */
export function CurrentLocationBadge() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row} accessibilityRole="text">
      {Platform.OS === 'ios' ? (
        <SymbolView name="location.fill" size={14} tintColor={c.mutedInk} />
      ) : (
        <PlatformIcon icon={Navigation} size={14} color={c.mutedInk} strokeWidth={2.5} />
      )}
      <ThemedText style={styles.label}>Current Location</ThemedText>
    </View>
  );
}

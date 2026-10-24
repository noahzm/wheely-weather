import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Navigation } from './icons';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { LabelText, SceneColors, Spacing, Type, type WheelyPalette } from '@/constants/theme';

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
      ...LabelText,
      ...Type.micro,
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
 * `location.fill` on iOS, Bootstrap `Navigation` elsewhere.
 */
export function CurrentLocationBadge({
  onScene = false,
}: Readonly<{
  /** Drawn over the home scene's sky, which takes dark ink in both color schemes. */
  onScene?: boolean;
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const ink = onScene ? SceneColors.mutedInk : c.mutedInk;
  return (
    <View style={styles.row} accessibilityRole="text">
      {Platform.OS === 'ios' ? (
        <SymbolView name="location.fill" size={14} tintColor={ink} />
      ) : (
        <PlatformIcon icon={Navigation} size={14} color={ink} filled />
      )}
      <ThemedText style={[styles.label, { color: ink }]}>Current Location</ThemedText>
    </View>
  );
}

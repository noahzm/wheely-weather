import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import { makeButtonStyles } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      paddingTop: Spacing.four,
      gap: Spacing.three,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      fontSize: 13,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const buttonStyles = useMemo(() => makeButtonStyles(c), [c]);
  return { c, styles, buttonStyles };
}

export function WeatherHeader({
  location,
  statusMessage,
  onOpenLocation,
}: Readonly<{
  location: string;
  statusMessage: string;
  onOpenLocation: () => void;
}>) {
  const { c, styles, buttonStyles } = useStyles();
  return (
    <View style={styles.header} accessibilityRole="header">
      <Pressable
        onPress={onOpenLocation}
        accessibilityRole="button"
        accessibilityLabel={location ? `Change location, currently ${location}` : 'Set location'}
        style={({ pressed }) => [
          buttonStyles.base,
          buttonStyles.surface,
          pressed && buttonStyles.pressed,
        ]}
      >
        <MapPin size={14} color={c.ink} strokeWidth={2.5} />
        <ThemedText style={buttonStyles.label}>{location || 'Set location'}</ThemedText>
      </Pressable>
      {!!statusMessage && (
        <ThemedText style={styles.statusMessage} accessibilityLiveRegion="polite" role="status">
          {statusMessage}
        </ThemedText>
      )}
    </View>
  );
}

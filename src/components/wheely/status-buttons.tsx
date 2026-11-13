import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import { MapPin, RefreshCw, Search } from './icons';
import { HapticPressable, makeButtonStyles, PlatformIcon } from './primitives';

function makeLocalStyles() {
  return StyleSheet.create({
    retryButton: {
      minWidth: 32,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

function useButtonContext(): {
  c: WheelyPalette;
  buttonStyles: ReturnType<typeof makeButtonStyles>;
  localStyles: ReturnType<typeof makeLocalStyles>;
} {
  const c = useWheelyColors();
  const buttonStyles = useMemo(() => makeButtonStyles(c), [c]);
  const localStyles = useMemo(() => makeLocalStyles(), []);
  return { c, buttonStyles, localStyles };
}

export function RefreshForecastButton({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { c, buttonStyles } = useButtonContext();

  return (
    <HapticPressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Refresh forecast"
      style={({ pressed }) => [
        buttonStyles.base,
        buttonStyles.primary,
        pressed && buttonStyles.pressed,
      ]}
    >
      <PlatformIcon icon={RefreshCw} size={14} color={c.primaryInk} strokeWidth={2.5} />
      <ThemedText style={[buttonStyles.label, buttonStyles.primaryLabel]}>Refresh</ThemedText>
    </HapticPressable>
  );
}

export function StaleRetryButton({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { c, localStyles } = useButtonContext();

  return (
    <HapticPressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry refresh"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={localStyles.retryButton}
    >
      <PlatformIcon icon={RefreshCw} size={16} color={c.ink} strokeWidth={2} />
    </HapticPressable>
  );
}

export function LocationPromptButtons({
  busy,
  onUseDeviceLocation,
  onChooseLocation,
}: Readonly<{
  busy: boolean;
  onUseDeviceLocation: () => void;
  onChooseLocation: () => void;
}>) {
  const { c, buttonStyles } = useButtonContext();

  return (
    <>
      <HapticPressable
        onPress={onUseDeviceLocation}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => [
          buttonStyles.base,
          buttonStyles.primary,
          (pressed || busy) && buttonStyles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={c.primaryInk} />
        ) : (
          <PlatformIcon icon={MapPin} size={14} color={c.primaryInk} filled />
        )}
        <ThemedText style={[buttonStyles.label, buttonStyles.primaryLabel]}>
          Use current location
        </ThemedText>
      </HapticPressable>
      <HapticPressable
        onPress={onChooseLocation}
        accessibilityRole="button"
        accessibilityLabel="Search for a city"
        style={({ pressed }) => [
          buttonStyles.base,
          buttonStyles.surface,
          pressed && buttonStyles.pressed,
        ]}
      >
        <PlatformIcon icon={Search} size={14} color={c.ink} strokeWidth={2.5} />
        <ThemedText style={buttonStyles.label}>Search for a city</ThemedText>
      </HapticPressable>
    </>
  );
}

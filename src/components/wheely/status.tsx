import { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { AlertTriangle, CloudOff, MapPin, RefreshCw, Search } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing, TRANSPARENT, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, HapticPressable, makeButtonStyles, SectionHeading } from './primitives';
import { webBottomInset } from './bottom-nav-chrome';

function makeStyles(c: WheelyPalette, webPaddingBottom?: number) {
  return StyleSheet.create({
    centerState: {
      flex: 1,
      minHeight: 420,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
      paddingBottom: webPaddingBottom ?? Spacing.four,
      backgroundColor: TRANSPARENT,
    },
    centerCard: {
      maxWidth: MaxContentWidth,
      alignItems: 'center',
    },
    centerIcon: {
      marginBottom: Spacing.two,
    },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
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
  const insets = useSafeAreaInsets();
  const webPaddingBottom =
    Platform.OS === 'web' ? webBottomInset(insets.bottom) + Spacing.four : undefined;
  const styles = useMemo(() => makeStyles(c, webPaddingBottom), [c, webPaddingBottom]);
  const buttonStyles = useMemo(() => makeButtonStyles(c), [c]);
  return { c, styles, buttonStyles };
}

export function ErrorState({
  kind,
  onRetry,
}: Readonly<{
  kind: 'network' | 'default';
  onRetry: () => void;
}>) {
  const { c, styles, buttonStyles } = useStyles();
  const network = kind === 'network';
  const Icon = network ? CloudOff : AlertTriangle;
  const sfIcon = network ? 'cloud.slash.fill' : 'exclamationmark.triangle.fill';
  return (
    <View style={styles.centerState}>
      <BrutalCard style={styles.centerCard}>
        {Platform.OS === 'ios' ? (
          <SymbolView
            name={sfIcon as SFSymbol}
            size={42}
            tintColor={c.ink}
            style={styles.centerIcon}
          />
        ) : (
          <Icon size={42} color={c.ink} strokeWidth={2} style={styles.centerIcon} />
        )}
        <SectionHeading>
          {network ? 'Forecast unavailable' : 'Something went sideways'}
        </SectionHeading>
        <ThemedText style={styles.muted}>
          {network
            ? 'Check your connection and try again.'
            : 'The forecast could not be loaded right now.'}
        </ThemedText>
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
          {Platform.OS === 'ios' ? (
            <SymbolView name="arrow.clockwise" size={14} tintColor={c.primaryInk} />
          ) : (
            <RefreshCw size={14} color={c.primaryInk} strokeWidth={2.5} />
          )}
          <ThemedText style={[buttonStyles.label, buttonStyles.primaryLabel]}>Refresh</ThemedText>
        </HapticPressable>
      </BrutalCard>
    </View>
  );
}

export function LoadingState() {
  const { c, styles } = useStyles();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={c.ink} />
      <ThemedText style={styles.statusMessage}>Loading forecast...</ThemedText>
    </View>
  );
}

function UseLocationButtonIcon({ busy, ink }: Readonly<{ busy: boolean; ink: string }>) {
  if (busy) {
    return <ActivityIndicator size="small" color={ink} />;
  }
  if (Platform.OS === 'ios') {
    return <SymbolView name="location.fill" size={14} tintColor={ink} />;
  }
  return <MapPin size={14} color={ink} strokeWidth={2.5} />;
}

export function LocationPromptState({
  onChooseLocation,
  onUseDeviceLocation,
  busy = false,
  statusMessage = '',
}: Readonly<{
  onChooseLocation: () => void;
  onUseDeviceLocation: () => void;
  busy?: boolean;
  statusMessage?: string;
}>) {
  const { c, styles, buttonStyles } = useStyles();
  return (
    <View style={styles.centerState}>
      <BrutalCard style={styles.centerCard}>
        {Platform.OS === 'ios' ? (
          <SymbolView name="location.fill" size={42} tintColor={c.ink} style={styles.centerIcon} />
        ) : (
          <MapPin size={42} color={c.ink} strokeWidth={2} style={styles.centerIcon} />
        )}
        <SectionHeading>Where are you riding?</SectionHeading>
        <ThemedText style={styles.muted}>
          Use your current location or search for a city to see the forecast.
        </ThemedText>
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
          <UseLocationButtonIcon busy={busy} ink={c.primaryInk} />
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
          {Platform.OS === 'ios' ? (
            <SymbolView name="magnifyingglass" size={14} tintColor={c.ink} />
          ) : (
            <Search size={14} color={c.ink} strokeWidth={2.5} />
          )}
          <ThemedText style={buttonStyles.label}>Search for a city</ThemedText>
        </HapticPressable>
        {statusMessage.length > 0 && (
          <ThemedText style={styles.statusMessage} accessibilityLiveRegion="polite">
            {statusMessage}
          </ThemedText>
        )}
      </BrutalCard>
    </View>
  );
}

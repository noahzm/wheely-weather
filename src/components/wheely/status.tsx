import { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { AlertTriangle, CloudOff, MapPin } from './icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing, TRANSPARENT, Type, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, PlatformIcon, SectionHeading } from './primitives';
import { LocationPromptButtons, RefreshForecastButton, StaleRetryButton } from './status-buttons';
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
      width: '100%',
      maxWidth: MaxContentWidth,
      alignItems: 'center',
    },
    centerIcon: {
      marginBottom: Spacing.two,
    },
    centerHeading: {
      textAlign: 'center',
    },
    muted: {
      color: c.mutedInk,
      textAlign: 'center',
      ...Type.small,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      ...Type.small,
    },
    staleNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    staleNoticeText: {
      flex: 1,
      color: c.ink,
      ...Type.small,
    },
  });
}

function useStylesFor(c: WheelyPalette) {
  const insets = useSafeAreaInsets();
  const webPaddingBottom =
    Platform.OS === 'web' ? webBottomInset(insets.bottom) + Spacing.four : undefined;
  const styles = useMemo(() => makeStyles(c, webPaddingBottom), [c, webPaddingBottom]);
  return { c, styles };
}

/** Page-level states (no card) style with the page palette. */
function useStyles() {
  return useStylesFor(useWheelyColors());
}

/** Card states style their contents with the card palette. */
function useCardStyles() {
  return useStylesFor(useWheelyColors());
}

export function ErrorState({
  kind,
  onRetry,
}: Readonly<{
  kind: 'network' | 'default';
  onRetry: () => void;
}>) {
  const { c, styles } = useCardStyles();
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
          <PlatformIcon icon={Icon} size={42} color={c.ink} filled style={styles.centerIcon} />
        )}
        <SectionHeading style={styles.centerHeading}>
          {network ? 'Forecast unavailable' : 'Something went sideways'}
        </SectionHeading>
        <ThemedText style={styles.muted}>
          {network
            ? 'Check your connection and try again.'
            : 'The forecast could not be loaded right now.'}
        </ThemedText>
        <RefreshForecastButton onRetry={onRetry} />
      </BrutalCard>
    </View>
  );
}

/**
 * Inline banner for when a background refresh (pull-to-refresh, stale-data
 * revalidation) fails while a snapshot is still on screen — the content stays
 * visible, but the user is told it may be out of date instead of the failure
 * being silent. Distinct from `ErrorState`, which replaces the whole screen
 * when there is no content to show at all.
 */
export function StaleDataNotice({
  kind,
  onRetry,
}: Readonly<{
  kind: 'network' | 'default';
  onRetry: () => void;
}>) {
  const { c, styles } = useCardStyles();
  const message =
    kind === 'network'
      ? "Couldn't refresh — check your connection. Showing the last forecast."
      : "Couldn't refresh the forecast. Showing the last one.";
  return (
    <BrutalCard small style={styles.staleNotice}>
      {Platform.OS === 'ios' ? (
        <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={c.warning} />
      ) : (
        <PlatformIcon icon={AlertTriangle} size={16} color={c.warning} filled />
      )}
      <ThemedText style={styles.staleNoticeText} accessibilityLiveRegion="polite">
        {message}
      </ThemedText>
      <StaleRetryButton onRetry={onRetry} />
    </BrutalCard>
  );
}

export function LoadingState() {
  const { c, styles } = useStyles();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={c.ink} />
      <ThemedText style={styles.statusMessage}>Loading forecast…</ThemedText>
    </View>
  );
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
  const { c, styles } = useCardStyles();
  return (
    <BrutalCard style={styles.centerCard}>
      {Platform.OS === 'ios' ? (
        <SymbolView name="location.fill" size={42} tintColor={c.ink} style={styles.centerIcon} />
      ) : (
        <PlatformIcon icon={MapPin} size={42} color={c.ink} filled style={styles.centerIcon} />
      )}
      <SectionHeading style={styles.centerHeading}>Where are you riding?</SectionHeading>
      <ThemedText style={styles.muted}>
        Use your current location or search for a city to see the forecast.
      </ThemedText>
      <LocationPromptButtons
        busy={busy}
        onUseDeviceLocation={onUseDeviceLocation}
        onChooseLocation={onChooseLocation}
      />
      {statusMessage.length > 0 && (
        <ThemedText style={styles.statusMessage} accessibilityLiveRegion="polite">
          {statusMessage}
        </ThemedText>
      )}
    </BrutalCard>
  );
}

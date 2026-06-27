import { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing, TRANSPARENT, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, makeButtonStyles, StrokedSectionHeading } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    centerState: {
      flex: 1,
      minHeight: 420,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
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
  const styles = useMemo(() => makeStyles(c), [c]);
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
        <StrokedSectionHeading>
          {network ? 'Forecast unavailable' : 'Something went sideways'}
        </StrokedSectionHeading>
        <ThemedText style={styles.muted}>
          {network
            ? 'Check your connection and try again.'
            : 'The forecast could not be loaded right now.'}
        </ThemedText>
        <Pressable
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
            <SymbolView name="arrow.clockwise" size={14} tintColor={c.ink} />
          ) : (
            <RefreshCw size={14} color={c.ink} strokeWidth={2.5} />
          )}
          <ThemedText style={buttonStyles.label}>Refresh</ThemedText>
        </Pressable>
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

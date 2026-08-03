import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Sunrise, Umbrella } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { PlatformIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    // Straddles the card's top border like the hero verdict's floating badges
    // (`ride-verdict.tsx`): a fixed negative marginBottom pulls the card up
    // underneath it by a constant amount, so the overlap depth stays the same
    // no matter how many lines the message wraps to (unlike a `top` offset,
    // which would let a two-line message dip further into the chart).
    noteStickers: {
      alignItems: 'flex-end',
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      marginBottom: -Spacing.three,
      zIndex: 10,
      pointerEvents: 'none',
    },
    noteSticker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      maxWidth: '100%',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.none,
      backgroundColor: c.paper,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
    },
    noteStickerText: {
      color: c.ink,
      fontWeight: '400',
      fontSize: Type.caption.fontSize,
      flexShrink: 1,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function HourlyNoteSticker({ icon, text }: Readonly<{ icon: SFSymbol; text: string }>) {
  const { c, styles } = useStyles();
  const FallbackIcon = icon === 'umbrella.fill' ? Umbrella : Sunrise;

  return (
    <View style={styles.noteSticker} accessibilityRole="text" accessibilityLabel={text}>
      {Platform.OS === 'ios' ? (
        <SymbolView name={icon} size={13} tintColor={c.ink} />
      ) : (
        <PlatformIcon icon={FallbackIcon} size={13} color={c.ink} strokeWidth={2.5} />
      )}
      <ThemedText style={styles.noteStickerText}>{text}</ThemedText>
    </View>
  );
}

export function HourlyNoteStickers({
  rainTiming,
  daylightWarning,
}: Readonly<{
  rainTiming?: string | null;
  daylightWarning?: string | null;
}>) {
  const { styles } = useStyles();
  if (!rainTiming && !daylightWarning) return null;

  return (
    <View style={styles.noteStickers}>
      {!!rainTiming && <HourlyNoteSticker icon="umbrella.fill" text={rainTiming} />}
      {!!daylightWarning && <HourlyNoteSticker icon="sunrise.fill" text={daylightWarning} />}
    </View>
  );
}

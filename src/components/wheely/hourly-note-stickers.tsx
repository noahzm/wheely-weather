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
    noteStickers: {
      position: 'absolute',
      right: Spacing.one,
      top: Spacing.one,
      zIndex: 4,
      alignItems: 'flex-end',
      gap: Spacing.one,
    },
    noteSticker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
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
    <View style={[styles.noteStickers, { pointerEvents: 'none' }]}>
      {!!rainTiming && <HourlyNoteSticker icon="umbrella.fill" text={rainTiming} />}
      {!!daylightWarning && <HourlyNoteSticker icon="sunrise.fill" text={daylightWarning} />}
    </View>
  );
}

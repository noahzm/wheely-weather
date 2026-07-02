import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Sunrise, Umbrella } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';

const NOTE_STICKER_ROTATE = '4deg';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    noteStickers: {
      position: 'absolute',
      right: -8,
      top: -14,
      zIndex: 4,
      alignItems: 'flex-end',
      gap: Spacing.one,
    },
    noteSticker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      borderWidth: 2,
      borderColor: c.shadow,
      backgroundColor: c.paper,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      transform: [{ rotate: NOTE_STICKER_ROTATE }],
    },
    noteStickerText: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 12,
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
        <FallbackIcon size={13} color={c.ink} strokeWidth={2.5} />
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

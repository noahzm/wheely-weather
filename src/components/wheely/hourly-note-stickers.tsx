import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Sunrise, Umbrella } from './icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { PlatformIcon } from './primitives';

/** The section's title-to-card gap the sticker reaches across (`section.gap` on home). */
const TITLE_GAP = Spacing.three;
/** How deep the sticker dips into the card below its top border. */
const CARD_OVERLAP = Spacing.three;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    // Rendered as the "Hour by hour" title's right accessory, so the card keeps
    // the same title gap as every other section. A fixed negative marginBottom
    // drops it across that gap to straddle the card's top border by a constant
    // depth however many lines it wraps to; the extra lines grow upward beside
    // the title (it only takes the width the title leaves), never into the chart.
    // The title row needs a zIndex above the card for this to paint on top.
    noteStickers: {
      // SectionTitle's heading also grows (flexGrow 1), so an even split would
      // wrap short notes early; this claims nearly all the width the title leaves.
      flexGrow: 1000,
      flexShrink: 1,
      flexBasis: 0,
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
      gap: Spacing.one,
      paddingRight: Spacing.three,
      marginBottom: -(TITLE_GAP + CARD_OVERLAP),
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

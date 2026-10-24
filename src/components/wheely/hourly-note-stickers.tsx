import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sunrise, Umbrella } from './icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { PlatformIcon, StickerTag } from './primitives';

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
      maxWidth: '100%',
      paddingHorizontal: Spacing.two,
    },
    noteStickerText: {
      color: c.ink,
      fontWeight: '400',
      ...Type.micro,
      flexShrink: 1,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function formatStickerText(text: string): string {
  // A time range stays whole: a word joiner after the dash stops a break there,
  // which left "Rain / tomorrow 3 PM– / 8 PM" on a narrow phone.
  const glued = text
    .replaceAll(' AM', '\u00A0AM')
    .replaceAll(' PM', '\u00A0PM')
    .replaceAll('–', '–\u2060');
  const lastSpaceIdx = glued.lastIndexOf(' ');
  if (lastSpaceIdx <= 0) return glued;
  // The last word is glued to the one before so it never sits alone; a range is
  // long enough to stand alone, and gluing it on would leave too wide a piece.
  const lastWord = glued.slice(lastSpaceIdx + 1);
  if (lastWord.includes('–')) return glued;
  return `${glued.slice(0, lastSpaceIdx)}\u00A0${lastWord}`;
}

function HourlyNoteSticker({ icon, text }: Readonly<{ icon: SFSymbol; text: string }>) {
  const { c, styles } = useStyles();
  const FallbackIcon = icon === 'umbrella.fill' ? Umbrella : Sunrise;

  return (
    <Animated.View entering={FadeInDown.delay(180).springify().damping(15)}>
      <StickerTag style={styles.noteSticker} accessibilityRole="text" accessibilityLabel={text}>
        {Platform.OS === 'ios' ? (
          <SymbolView name={icon} size={13} tintColor={c.ink} />
        ) : (
          <PlatformIcon icon={FallbackIcon} size={13} color={c.ink} filled />
        )}
        <ThemedText style={styles.noteStickerText}>{formatStickerText(text)}</ThemedText>
      </StickerTag>
    </Animated.View>
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

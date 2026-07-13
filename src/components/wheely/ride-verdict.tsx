import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBold, Spacing, WheelyTheme, type WheelyPalette } from '@/constants/theme';
import { verdictFeedback } from '@/utils/haptics';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    verdictWrap: {
      position: 'relative',
      overflow: 'visible',
      marginTop: Spacing.two,
    },
    verdict: {
      borderWidth: 2,
      borderColor: c.shadow,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.five,
      paddingBottom: Spacing.three,
      overflow: 'hidden',
    },
    verdictBadge: {
      position: 'absolute',
      top: -12,
      left: Spacing.three,
      zIndex: 2,
      backgroundColor: c.shadow,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      transform: [{ rotate: '-2deg' }],
    },
    verdictBadgeText: {
      // Badge sits on c.shadow (#161310) in both themes — always use light cream ink.
      color: WheelyTheme.light.paper,
      fontFamily: Fonts.heading,
      fontSize: 16,
      fontWeight: FontWeightBold,
    },
    verdictText: {
      fontFamily: Fonts.body,
      fontSize: 34,
      lineHeight: 36,
      fontWeight: '400',
    },
    acclimatizationNote: {
      fontFamily: Fonts.body,
      fontSize: 13,
      marginTop: Spacing.two,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

export function RideVerdict({
  status,
  message,
  label,
  acclimatizationNote,
}: Readonly<{
  status: 'yes' | 'maybe' | 'no';
  message: string;
  label?: string;
  acclimatizationNote?: string | null;
}>) {
  const { c, styles } = useStyles();
  // Fire a tone-matched haptic when the verdict first appears or changes.
  useEffect(() => {
    verdictFeedback(status);
  }, [status]);
  const meta = {
    yes: { defaultLabel: 'Ride day', ...c.condition.good },
    maybe: { defaultLabel: 'Mixed conditions', ...c.condition.marginal },
    no: { defaultLabel: 'Rest day', ...c.condition.bad },
  }[status];
  const badgeLabel = label ?? meta.defaultLabel;
  return (
    <View
      style={styles.verdictWrap}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${badgeLabel}. ${message}${
        acclimatizationNote ? `. ${acclimatizationNote}` : ''
      }`}
    >
      <View style={[styles.verdict, { backgroundColor: meta.bg }]}>
        <ThemedText style={[styles.verdictText, { color: meta.ink }]}>{message}</ThemedText>
        {!!acclimatizationNote && (
          <ThemedText style={[styles.acclimatizationNote, { color: meta.ink }]}>
            {acclimatizationNote}
          </ThemedText>
        )}
      </View>
      <View style={[styles.verdictBadge, { pointerEvents: 'none' }]}>
        <ThemedText style={styles.verdictBadgeText}>{badgeLabel}</ThemedText>
      </View>
    </View>
  );
}

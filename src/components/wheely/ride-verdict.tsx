import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { brutalShadow } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    verdictWrap: {
      position: 'relative',
      overflow: 'visible',
      marginTop: Spacing.two,
    },
    verdict: {
      borderWidth: 2,
      borderColor: c.ink,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
      minHeight: 190,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      ...brutalShadow(c.ink, 9),
    },
    verdictBadge: {
      position: 'absolute',
      top: -12,
      left: Spacing.three,
      zIndex: 2,
      backgroundColor: c.ink,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      transform: [{ rotate: '-2deg' }],
    },
    verdictBadgeText: {
      color: c.paper,
      fontFamily: Fonts.monoBold,
      fontSize: 16,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    verdictText: {
      color: c.ink,
      fontFamily: Fonts.sans,
      fontSize: 34,
      lineHeight: 36,
      fontWeight: '400',
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
}: Readonly<{
  status: 'yes' | 'maybe' | 'no';
  message: string;
  label?: string;
}>) {
  const { c, styles } = useStyles();
  const meta = {
    yes: { defaultLabel: 'Ride day', color: c.success },
    maybe: { defaultLabel: 'Mixed conditions', color: c.warning },
    no: { defaultLabel: 'Rest day', color: c.error },
  }[status];
  const badgeLabel = label ?? meta.defaultLabel;
  return (
    <View
      style={styles.verdictWrap}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${badgeLabel}. ${message}`}
    >
      <View style={[styles.verdict, { backgroundColor: meta.color }]}>
        <ThemedText style={styles.verdictText}>{message}</ThemedText>
      </View>
      <View style={styles.verdictBadge} pointerEvents="none">
        <ThemedText style={styles.verdictBadgeText}>{badgeLabel}</ThemedText>
      </View>
    </View>
  );
}

import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import {
  FontWeightBlack,
  Fonts,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import { verdictFeedback } from '@/utils/haptics';
import type { VerdictMessage } from '@/types/weather';
import { BrutalCard, Chip } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    verdictWrap: {
      position: 'relative',
      overflow: 'visible',
      marginTop: Spacing.two,
    },
    verdict: {
      paddingTop: Spacing.four,
      gap: Spacing.two,
      overflow: 'hidden',
    },
    verdictBadge: {
      position: 'absolute',
      top: -12,
      left: Spacing.three,
      zIndex: 2,
      backgroundColor: c.shadow,
      borderRadius: Radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
      transform: [{ rotate: '-1deg' }],
    },
    verdictBadgeText: {
      // Badge sits on c.shadow (the scheme's ink), so text takes the page color.
      color: c.background,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      fontSize: Type.small.fontSize,
    },
    verdictText: {
      fontFamily: Fonts.body,
      ...Type.stat,
      fontWeight: '400',
    },
    issueRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
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
  message: VerdictMessage;
  label?: string;
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
  const spokenMessage = [message.lead, message.issues.join(', '), message.timing]
    .filter(Boolean)
    .join(' ');
  const hasChips = message.issues.length > 0 || message.timing != null;
  return (
    <View
      style={styles.verdictWrap}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${badgeLabel}. ${spokenMessage}`}
    >
      <BrutalCard variant="featured" style={[styles.verdict, { backgroundColor: meta.bg }]}>
        <ThemedText style={[styles.verdictText, { color: meta.ink }]}>{message.lead}</ThemedText>
        {hasChips && (
          <View style={styles.issueRow}>
            {message.issues.map((issue) => (
              <Chip key={issue} burst={false}>
                {issue}
              </Chip>
            ))}
            {message.timing != null && <Chip ink>{message.timing}</Chip>}
          </View>
        )}
      </BrutalCard>
      <View style={[styles.verdictBadge, { pointerEvents: 'none' }]}>
        <ThemedText style={styles.verdictBadgeText}>{badgeLabel}</ThemedText>
      </View>
    </View>
  );
}

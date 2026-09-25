import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Clock, CloudRain, Sun, Wind, type IconComponent } from './icons';

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
import { scoreToStars } from '@/utils/starRating';
import type { Condition, VerdictMessage } from '@/types/weather';
import { formatIssuesAsSentence, formatVerdictDetail } from '@/domain';
import { BrutalCard, PlatformIcon, weatherIconFor, weatherSfSymbol } from './primitives';
import { StarRating } from './star-rating';

type VerdictStatus = 'yes' | 'maybe' | 'no';

/** How far the timing chip hangs below the card's bottom edge. */
const TIMING_BADGE_OVERHANG = 18;
/** How far the star pill rises above the card's top edge. */
const SCORE_BADGE_OVERHANG = 18;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    // The star pill rises into the gap above the card rather than pushing it
    // down, so the card edge lands the same distance under the title as every
    // other section's card. This margin is only the sliver of overhang that
    // doesn't fit in home's 16px gap, so the pill never overlaps what's above.
    verdictWrap: {
      position: 'relative',
      overflow: 'visible',
      marginTop: SCORE_BADGE_OVERHANG - Spacing.three,
    },
    badgeGroup: {
      position: 'absolute',
      top: -SCORE_BADGE_OVERHANG,
      right: Spacing.three,
      zIndex: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      pointerEvents: 'none',
    },
    scorePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      backgroundColor: c.paper,
      borderRadius: Radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1.5,
      borderColor: c.border,
      transform: [{ rotate: '1deg' }],
    },
    // Clears the timing chip's overhang, so whatever sits below isn't covered.
    // Spacing past that belongs to the screen (home's section gap / alert margin).
    verdictWrapWithBadge: {
      marginBottom: TIMING_BADGE_OVERHANG,
    },
    bottomBadgeGroup: {
      position: 'absolute',
      bottom: -TIMING_BADGE_OVERHANG,
      left: Spacing.three,
      zIndex: 10,
      pointerEvents: 'none',
    },
    timingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.shadow,
      borderRadius: Radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1.5,
      borderColor: c.border,
      transform: [{ rotate: '1deg' }],
    },
    timingBadgeText: {
      color: c.background,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      fontSize: Type.small.fontSize,
      letterSpacing: 0.3,
    },
    verdictCard: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four + Spacing.two,
      paddingHorizontal: Spacing.four,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.two + Spacing.half,
    },
    textColumn: {
      flex: 1,
      gap: Spacing.one,
    },
    leadText: {
      fontFamily: Fonts.bold,
      ...Type.heading,
      fontWeight: FontWeightBlack,
    },
    issueSentenceText: {
      fontFamily: Fonts.body,
      ...Type.body,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function getFallbackStatusIcon(status: VerdictStatus): IconComponent {
  if (status === 'yes') return Sun;
  if (status === 'maybe') return Wind;
  return CloudRain;
}

function getFallbackStatusSfSymbol(status: VerdictStatus): SFSymbol {
  if (status === 'yes') return 'sun.max.fill';
  if (status === 'maybe') return 'wind';
  return 'cloud.rain.fill';
}

export function RideVerdict({
  status,
  message,
  label,
  score,
  weatherCode,
  condition,
  waiting = false,
}: Readonly<{
  status: VerdictStatus;
  /** The rating behind `status`; colors the card like the week list. Defaults per status. */
  condition?: Condition;
  message: VerdictMessage;
  label?: string;
  score?: number;
  weatherCode?: number | null;
  /** Bad now, good later: the accent pink sets it apart from a go-now verdict. */
  waiting?: boolean;
}>) {
  const { c, styles } = useStyles();

  useEffect(() => {
    verdictFeedback(status);
  }, [status]);

  const byStatus = {
    yes: { defaultLabel: 'Ride day', rating: 'good' },
    maybe: { defaultLabel: 'Mixed conditions', rating: 'marginal' },
    no: { defaultLabel: 'Rest day', rating: 'bad' },
  } as const satisfies Record<VerdictStatus, { defaultLabel: string; rating: Condition }>;
  const { defaultLabel, rating } = byStatus[status];
  const meta = waiting
    ? { defaultLabel: 'Ride later', bg: c.accent, ink: c.accentInk }
    : { defaultLabel, ...c.condition[condition ?? rating] };

  const statusIcon =
    weatherCode == null ? getFallbackStatusIcon(status) : weatherIconFor(weatherCode);
  const statusSfSymbol =
    weatherCode == null
      ? getFallbackStatusSfSymbol(status)
      : (weatherSfSymbol(weatherCode) as SFSymbol);
  const headlineText = (label ?? message.lead).replace(/(, but|:)$/i, '').trim();
  const issuesSentence = formatIssuesAsSentence(message.issues);
  // Without a label the lead is the headline, so it isn't repeated below.
  const detailSentence = label ? formatVerdictDetail(status, message) : issuesSentence;
  const hasBottomBadge = message.timing != null;
  const hasDetails = detailSentence.length > 0;
  const cardPaddingBottom = hasBottomBadge ? Spacing.four + Spacing.two : Spacing.four;
  const rowAlignment = hasDetails ? 'flex-start' : 'center';

  const spokenMessage = [
    meta.defaultLabel,
    headlineText,
    score == null ? '' : `Ride score ${scoreToStars(score)} out of 5 stars.`,
    detailSentence,
    message.timing,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      style={[styles.verdictWrap, hasBottomBadge && styles.verdictWrapWithBadge]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={spokenMessage}
    >
      {/* Top Floating Badge (Score) */}
      {score != null && scoreToStars(score) > 0 && (
        <View style={styles.badgeGroup}>
          {/* The entrance animates `transform`, so the tilt lives on an inner
              view: on the same view the animation overwrote it mid-entrance. */}
          <Animated.View entering={ZoomIn.delay(160).springify()}>
            <View style={styles.scorePill}>
              <StarRating rating={scoreToStars(score)} />
            </View>
          </Animated.View>
        </View>
      )}

      <BrutalCard
        variant="featured"
        style={[styles.verdictCard, { backgroundColor: meta.bg, paddingBottom: cardPaddingBottom }]}
      >
        {/* Weather Icon + Aligned Text Column */}
        <View style={[styles.contentRow, { alignItems: rowAlignment }]}>
          {Platform.OS === 'ios' ? (
            <SymbolView
              name={statusSfSymbol}
              size={30}
              tintColor={meta.ink}
              style={hasDetails ? { marginTop: 1 } : undefined}
            />
          ) : (
            <PlatformIcon
              icon={statusIcon}
              size={30}
              color={meta.ink}
              filled
              style={hasDetails ? { marginTop: 1 } : undefined}
            />
          )}

          <View style={styles.textColumn}>
            <ThemedText style={[styles.leadText, { color: meta.ink }]}>{headlineText}</ThemedText>

            {detailSentence.length > 0 && (
              <ThemedText style={[styles.issueSentenceText, { color: meta.ink }]}>
                {detailSentence}
              </ThemedText>
            )}
          </View>
        </View>
      </BrutalCard>

      {/* Bottom Floating Timing Badge Button */}
      {message.timing != null && (
        <View style={styles.bottomBadgeGroup}>
          <Animated.View entering={FadeInDown.delay(200)}>
            <View style={styles.timingBadge}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="clock.fill" size={14} tintColor={c.background} />
              ) : (
                <Clock size={14} color={c.background} strokeWidth={2.5} />
              )}
              <ThemedText style={styles.timingBadgeText}>{message.timing}</ThemedText>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

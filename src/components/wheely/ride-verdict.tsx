import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Clock, CloudRain, Sun, Wind, type LucideIcon } from 'lucide-react-native';

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
import type { VerdictMessage } from '@/types/weather';
import { BrutalCard, PlatformIcon, weatherIconFor, weatherSfSymbol } from './primitives';
import { StarRating } from './star-rating';

type VerdictStatus = 'yes' | 'maybe' | 'no';

export function formatIssuesAsSentence(issues: readonly string[]): string {
  if (issues.length === 0) return '';
  if (issues.length === 1) {
    return `${issues[0]}.`;
  }
  const formatted = issues.map((item, idx) => {
    if (idx === 0) return item;
    return item.charAt(0).toLowerCase() + item.slice(1);
  });
  if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}.`;
  }
  const last = formatted.at(-1);
  const rest = formatted.slice(0, -1).join(', ');
  return `${rest}, and ${last}.`;
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    verdictWrap: {
      position: 'relative',
      overflow: 'visible',
      marginTop: Spacing.three,
      marginBottom: Spacing.three,
    },
    badgeGroup: {
      position: 'absolute',
      top: -18,
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
    bottomBadgeGroup: {
      position: 'absolute',
      bottom: -18,
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
      overflow: 'hidden',
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

function getFallbackStatusIcon(status: VerdictStatus): LucideIcon {
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
}: Readonly<{
  status: VerdictStatus;
  message: VerdictMessage;
  label?: string;
  score?: number;
  weatherCode?: number | null;
}>) {
  const { c, styles } = useStyles();

  useEffect(() => {
    verdictFeedback(status);
  }, [status]);

  const meta = {
    yes: { defaultLabel: 'Ride day', ...c.condition.good },
    maybe: { defaultLabel: 'Mixed conditions', ...c.condition.marginal },
    no: { defaultLabel: 'Rest day', ...c.condition.bad },
  }[status];

  const statusIcon =
    weatherCode == null ? getFallbackStatusIcon(status) : weatherIconFor(weatherCode);
  const statusSfSymbol =
    weatherCode == null
      ? getFallbackStatusSfSymbol(status)
      : (weatherSfSymbol(weatherCode) as SFSymbol);
  const headlineText = (label ?? message.lead).replace(/(, but|:)$/i, '').trim();
  const issuesSentence = formatIssuesAsSentence(message.issues);
  const detailSentence =
    status === 'yes' && label && message.lead && label !== message.lead
      ? message.lead
      : issuesSentence;
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
      style={styles.verdictWrap}
      accessibilityLiveRegion="polite"
      accessibilityLabel={spokenMessage}
    >
      {/* Top Floating Badge (Score) */}
      {score != null && scoreToStars(score) > 0 && (
        <View style={styles.badgeGroup}>
          <Animated.View entering={ZoomIn.delay(160).springify()} style={styles.scorePill}>
            <StarRating rating={scoreToStars(score)} />
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
              strokeWidth={2.5}
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
          <Animated.View entering={FadeInDown.delay(200)} style={styles.timingBadge}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="clock.fill" size={14} tintColor={c.background} />
            ) : (
              <Clock size={14} color={c.background} strokeWidth={2.5} />
            )}
            <ThemedText style={styles.timingBadgeText}>{message.timing}</ThemedText>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

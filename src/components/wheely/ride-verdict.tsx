import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { Clock } from './icons';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import {
  Fonts,
  PosterText,
  Spacing,
  Type,
  WheelyTheme,
  type WheelyPalette,
} from '@/constants/theme';
import { verdictFeedback } from '@/utils/haptics';
import { formatHourSpan } from '@/utils/timeFormat';
import { scoreToStars } from '@/utils/starRating';
import type { Condition, VerdictMessage } from '@/types/weather';
import { formatIssuesAsSentence, formatVerdictDetail } from '@/domain';
import { BrutalCard, StickerTag, brutalShadow, stickerFrame } from './primitives';
import { StarRating } from './star-rating';

// The stickers land once Home's entrance has slapped the card down (its
// Stagger in the home screen): the stars pop on, then the timing tag.
const STARS_POP_DELAY_MS = 720;
const TIMING_TAG_DELAY_MS = 820;

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
    scoreTag: {
      paddingHorizontal: 12,
      paddingVertical: 5,
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
    timingTag: {
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    timingTagText: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.small,
    },
    verdictCard: {
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four + Spacing.two,
      paddingHorizontal: Spacing.four,
    },
    textColumn: {
      gap: Spacing.one,
    },
    leadText: {
      ...PosterText,
      ...Type.headline,
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

function preventOrphans(text: string): string {
  const glued = text
    .replaceAll(' mph', '\u00A0mph')
    .replaceAll(' km/h', '\u00A0km/h')
    .replaceAll(' kph', '\u00A0kph')
    .replaceAll(' AM', '\u00A0AM')
    .replaceAll(' PM', '\u00A0PM')
    .replaceAll('dew ', 'dew\u00A0')
    .replaceAll('AQI ', 'AQI\u00A0');
  const lastSpaceIdx = glued.lastIndexOf(' ');
  if (lastSpaceIdx <= 0 || glued.indexOf(' ') === lastSpaceIdx) return glued;
  return `${glued.slice(0, lastSpaceIdx)}\u00A0${glued.slice(lastSpaceIdx + 1)}`;
}

function formatRecommendedTime(
  rideWindow: { startHour: number; endHour: number; tomorrow?: boolean } | null | undefined,
  waiting: boolean,
  timing?: string | null,
): string | null {
  if (!rideWindow) return null;
  if (waiting && timing) return timing;
  const timeLabel = rideWindow.tomorrow ? 'Tomorrow' : 'Best riding';
  return `${timeLabel} · ${formatHourSpan(rideWindow.startHour, rideWindow.endHour)}`;
}

const BY_STATUS = {
  yes: { defaultLabel: 'Ride day', rating: 'good' },
  maybe: { defaultLabel: 'Mixed conditions', rating: 'marginal' },
  no: { defaultLabel: 'Rest day', rating: 'bad' },
} as const satisfies Record<VerdictStatus, { defaultLabel: string; rating: Condition }>;

export function RideVerdict({
  status,
  message,
  label,
  score,
  condition,
  waiting = false,
  entrance = true,
  rideWindow,
}: Readonly<{
  rideWindow?: { startHour: number; endHour: number; tomorrow?: boolean } | null;
  status: VerdictStatus;
  /** The rating behind `status`; colors the card like the week list. Defaults per status. */
  condition?: Condition;
  message: VerdictMessage;
  label?: string;
  score?: number;
  /** Bad now, good later: the accent pink sets it apart from a go-now verdict. */
  waiting?: boolean;
  /** Pop the stickers on as Home makes its entrance; off on a web return and under Reduce Motion. */
  entrance?: boolean;
}>) {
  const { c, styles } = useStyles();

  useEffect(() => {
    verdictFeedback(status);
  }, [status]);

  const { defaultLabel, rating } = BY_STATUS[status];
  const meta = waiting
    ? { defaultLabel: 'Ride later', bg: c.accent, ink: c.accentInk }
    : { defaultLabel, ...c.condition[condition ?? rating] };
  // The painted sky is daylight in both color schemes, so the card and its
  // stickers keep light mode's paper, black outline and black shadow; waiting
  // sits on the plain page and follows the active scheme.
  const chrome = waiting ? c : WheelyTheme.light;

  const headlineText = (label ?? message.lead).replace(/(, but|:)$/i, '').trim();
  const issuesSentence = formatIssuesAsSentence(message.issues);
  // Without a label the lead is the headline, so it isn't repeated below.
  const detailSentence = label ? formatVerdictDetail(status, message) : issuesSentence;
  const recommendedTime = formatRecommendedTime(rideWindow, waiting, message.timing);
  const hasBottomBadge = !recommendedTime && message.timing != null;
  const cardPaddingBottom = hasBottomBadge ? Spacing.four + Spacing.two : Spacing.four;

  const spokenMessage = [
    meta.defaultLabel,
    headlineText,
    score == null ? '' : `Ride score ${scoreToStars(score)} out of 5 stars.`,
    detailSentence,
    recommendedTime ?? message.timing,
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
          <Animated.View
            entering={entrance ? ZoomIn.delay(STARS_POP_DELAY_MS).springify() : undefined}
          >
            <StickerTag
              tilt={1}
              style={[styles.scoreTag, { backgroundColor: chrome.paper, ...stickerFrame(chrome) }]}
            >
              <StarRating
                rating={scoreToStars(score)}
                color={chrome.ink}
                emptyColor={chrome.border}
              />
            </StickerTag>
          </Animated.View>
        </View>
      )}

      <BrutalCard
        variant="featured"
        style={[
          styles.verdictCard,
          {
            backgroundColor: meta.bg,
            borderColor: chrome.border,
            paddingBottom: cardPaddingBottom,
            ...brutalShadow(chrome.shadow, 6),
          },
        ]}
      >
        <View style={styles.textColumn}>
          <ThemedText style={[styles.leadText, { color: meta.ink }]}>
            {preventOrphans(headlineText)}
          </ThemedText>

          {recommendedTime && (
            <ThemedText style={[styles.timingTagText, { color: meta.ink, marginTop: Spacing.two }]}>
              {preventOrphans(recommendedTime)}
            </ThemedText>
          )}
          {detailSentence.length > 0 && (
            <ThemedText style={[styles.issueSentenceText, { color: meta.ink }]}>
              {preventOrphans(detailSentence)}
            </ThemedText>
          )}
        </View>
      </BrutalCard>

      {/* Bottom Floating Timing Badge Button */}
      {hasBottomBadge && (
        <View style={styles.bottomBadgeGroup}>
          <Animated.View entering={entrance ? FadeInDown.delay(TIMING_TAG_DELAY_MS) : undefined}>
            <StickerTag
              tilt={-1}
              style={[styles.timingTag, { backgroundColor: chrome.paper, ...stickerFrame(chrome) }]}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView name="clock.fill" size={14} tintColor={chrome.ink} />
              ) : (
                <Clock size={14} color={chrome.ink} strokeWidth={2.5} />
              )}
              <ThemedText style={[styles.timingTagText, { color: chrome.ink }]}>
                {preventOrphans(message.timing ?? '')}
              </ThemedText>
            </StickerTag>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

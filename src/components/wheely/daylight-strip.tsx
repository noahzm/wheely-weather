import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, TabularNumbers, Type, type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import type { DaylightHour } from '@/types/weather';
import { splitDaylightStrip } from '@/utils/daylightStrip';
import { fullHourLabel } from '@/utils/timeFormat';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';

const STRIP_GAP = 2;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    strip: {
      flexDirection: 'row',
      gap: STRIP_GAP,
      height: 8,
      marginVertical: Spacing.one,
    },
    hour: { flex: 1 },
    pastHour: { opacity: 0.35 },
    window: { flexDirection: 'row', gap: STRIP_GAP },
    windowOutline: {
      position: 'absolute',
      top: -3,
      bottom: -3,
      left: -3,
      right: -3,
      borderWidth: 2,
      borderColor: c.ink,
      borderRadius: 3,
      pointerEvents: 'none',
    },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    axisLabel: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
      ...TabularNumbers,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

/**
 * The day's daylight hours as a row of colored blocks, rated like the hourly
 * chart, with the recommended ride window outlined: when the riding is good
 * at a glance. Today's finished hours are faded. Decorative for screen
 * readers; the row's label already says the rating and the window.
 */
export function DaylightStrip({
  hours,
  window,
}: Readonly<{
  hours: DaylightHour[];
  window: { startHour: number; endHour: number } | null;
}>) {
  const { c, styles } = useStyles();
  const { before, inWindow, after } = splitDaylightStrip(hours, window);
  const block = (h: DaylightHour) => (
    <View
      key={h.hour}
      style={[
        styles.hour,
        { backgroundColor: h.condition ? c.condition[h.condition].bg : c.divider },
        h.isPast && styles.pastHour,
      ]}
    />
  );
  return (
    <View
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {before.map((h) => block(h))}
      {inWindow.length > 0 && (
        // Flex by hour count, so the window's blocks stay as wide as the rest.
        <View style={[styles.window, { flex: inWindow.length }]}>
          {inWindow.map((h) => block(h))}
          <View style={styles.windowOutline} />
        </View>
      )}
      {after.map((h) => block(h))}
    </View>
  );
}

/**
 * The strip's two ends, labeled once a day is expanded ("7 AM … 7 PM"), so
 * the strip reads as a timeline of the day's light.
 */
export function DaylightAxis({
  hours,
  isExpanded,
}: Readonly<{ hours: DaylightHour[]; isExpanded: boolean }>) {
  const { styles } = useStyles();
  const openProgress = useExpandAnimation(isExpanded);
  const first = hours[0];
  const last = hours.at(-1);
  if (!first || !last) return null;
  return (
    <AnimatedExpand openProgress={openProgress}>
      <View
        style={styles.axis}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ThemedText style={styles.axisLabel}>{fullHourLabel(first.hour)}</ThemedText>
        <ThemedText style={styles.axisLabel}>{fullHourLabel(last.hour + 1)}</ThemedText>
      </View>
    </AnimatedExpand>
  );
}

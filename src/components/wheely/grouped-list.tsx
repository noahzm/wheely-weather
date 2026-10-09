// Inset-grouped list pieces for the web (and Android) screens, shaped like the
// native SwiftUI `List` the iOS app renders for Settings and Search: a muted
// section header, rows on one rounded paper card with inset hairline
// separators, and an optional muted footer.
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import { ArrowUpRight, ChevronRight } from './icons';
import { HapticPressable, PlatformIcon } from './primitives';

/** Minimum row height, matching a standard iOS list row. */
export const GROUPED_ROW_MIN_HEIGHT = 52;
const ROW_PADDING = Spacing.three + Spacing.one;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    section: {
      gap: Spacing.two,
    },
    header: {
      color: c.mutedInk,
      fontFamily: Fonts.heading,
      ...Type.caption,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: ROW_PADDING,
    },
    card: {
      backgroundColor: c.paper,
      borderRadius: Radius.card,
      overflow: 'hidden',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(c.ink, 0.16),
      marginLeft: ROW_PADDING,
    },
    footer: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.caption,
      paddingHorizontal: ROW_PADDING,
    },
    row: {
      minHeight: GROUPED_ROW_MIN_HEIGHT,
      paddingHorizontal: ROW_PADDING,
      paddingVertical: Spacing.two + Spacing.one,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
    },
    rowStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: Spacing.two,
    },
    rowPressed: {
      backgroundColor: withAlpha(c.ink, 0.08),
    },
    rowLabel: {
      flex: 1,
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.body,
    },
    rowValue: {
      flexShrink: 1,
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.body,
      textAlign: 'right',
    },
  });
}

export function useGroupedListStyles() {
  return makeStyles(useWheelyColors());
}

export function GroupedSection({
  title,
  footer,
  children,
}: Readonly<{
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}>) {
  const styles = useGroupedListStyles();
  // Separators go between rendered rows only; `false`/`null` children (rows
  // hidden by state) don't leave a stray line behind.
  const rows = Children.toArray(children).filter((child) => isValidElement(child));
  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText style={styles.header} accessibilityRole="header">
          {title}
        </ThemedText>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 && <View style={styles.separator} />}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? (
        <ThemedText style={styles.footer} accessibilityLiveRegion="polite">
          {footer}
        </ThemedText>
      ) : (
        footer
      )}
    </View>
  );
}

/**
 * A plain row container for custom content. Side by side by default (label
 * and switch); `stacked` puts full-width content like a picker in a column.
 */
export function GroupedRow({
  children,
  stacked = false,
  style,
}: Readonly<{ children: ReactNode; stacked?: boolean; style?: StyleProp<ViewStyle> }>) {
  const styles = useGroupedListStyles();
  return <View style={[styles.row, stacked && styles.rowStacked, style]}>{children}</View>;
}

/**
 * A tappable row: label, optional trailing value, and a chevron (navigates)
 * or an up-right arrow (opens an external link).
 */
export function GroupedLinkRow({
  label,
  value,
  icon,
  external = false,
  onPress,
  accessibilityLabel,
}: Readonly<{
  label: string;
  value?: string;
  icon?: ReactNode;
  external?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}>) {
  const c = useWheelyColors();
  const styles = useGroupedListStyles();
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}: ${value}` : label)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {icon}
      <ThemedText style={styles.rowLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText style={styles.rowValue} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      <PlatformIcon
        icon={external ? ArrowUpRight : ChevronRight}
        size={external ? 15 : 17}
        color={withAlpha(c.ink, 0.4)}
        strokeWidth={2.5}
      />
    </HapticPressable>
  );
}

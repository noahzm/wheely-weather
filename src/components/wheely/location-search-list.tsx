// Default (Android / web) location search list. iOS is shadowed by location-search-list.ios.tsx
// with a native SwiftUI List.
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Check, House, Navigation, Pin } from './icons';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';

import { HapticPressable, PlatformIcon, PressedOpacity } from './primitives';
import { GROUPED_ROW_MIN_HEIGHT, useGroupedListStyles } from './grouped-list';
import {
  homeAccessibilityLabel,
  isActive,
  isHome,
  isPinned,
  pinAccessibilityLabel,
  type RowItem,
} from '@/utils/locationRows';
import type { PlaceVerdict } from '@/utils/placeVerdict';

import { type LocationSearchListProps } from './location-search-list.types';

function PinButton({ pinned, onPress }: Readonly<{ pinned: boolean; onPress: () => void }>) {
  const c = useWheelyColors();

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        pinButtonStyles.fallback,
        pressed && { backgroundColor: withAlpha(c.ink, 0.08) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={pinAccessibilityLabel(pinned)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <PlatformIcon
        icon={Pin}
        size={16}
        color={pinned ? c.ink : c.mutedInk}
        strokeWidth={pinned ? 2.5 : 2}
        filled={pinned}
      />
    </HapticPressable>
  );
}

function HomeButton({ home, onPress }: Readonly<{ home: boolean; onPress: () => void }>) {
  const c = useWheelyColors();

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        pinButtonStyles.fallback,
        pressed && { backgroundColor: withAlpha(c.ink, 0.08) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={homeAccessibilityLabel(home)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <PlatformIcon
        icon={House}
        size={16}
        color={home ? c.ink : c.mutedInk}
        strokeWidth={home ? 2.5 : 2}
        filled={home}
      />
    </HapticPressable>
  );
}

const pinButtonStyles = StyleSheet.create({
  fallback: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function LocationRow({
  item,
  isLast,
  busy,
  pinned,
  home,
  active,
  verdict,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<{
  item: RowItem;
  isLast: boolean;
  busy: boolean;
  pinned: boolean;
  home: boolean;
  active: boolean;
  verdict: PlaceVerdict | null;
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleHome: () => void;
}>) {
  const c = useWheelyColors();
  const listStyles = useGroupedListStyles();
  const isDevice = item._kind === 'device';
  const isAction = isDevice;
  const showSub = !isAction && !!item.displayName && !item.displayName.startsWith(item.label);

  return (
    <Fragment>
      <View style={styles.row}>
        <HapticPressable
          style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
          onPress={onSelect}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: active }}
        >
          {isDevice && (
            <PlatformIcon icon={Navigation} size={18} color={c.ink} filled style={styles.rowIcon} />
          )}
          <View style={styles.rowContent}>
            <ThemedText
              style={[
                styles.rowLabel,
                isAction && styles.rowLabelAction,
                active && styles.rowLabelActive,
                { color: c.ink },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </ThemedText>
            {showSub && (
              <ThemedText style={[styles.rowSub, { color: c.mutedInk }]} numberOfLines={1}>
                {item.displayName}
              </ThemedText>
            )}
            {verdict && (
              <View style={styles.verdictRow}>
                <View
                  style={[
                    styles.verdictDot,
                    {
                      backgroundColor: verdict.waiting
                        ? c.accent
                        : c.condition[verdict.condition].bg,
                      borderColor: c.border,
                    },
                  ]}
                />
                <ThemedText style={[styles.rowSub, { color: c.mutedInk }]} numberOfLines={1}>
                  {verdict.label}
                </ThemedText>
              </View>
            )}
          </View>
          {/* Only the place on screen gets a mark, like the iOS list's checkmark;
            a chevron beside the home and pin buttons read as clutter. */}
          {active && (
            <PlatformIcon
              icon={Check}
              size={16}
              color={c.accent}
              strokeWidth={3}
              style={styles.chevron}
            />
          )}
        </HapticPressable>
        {!isAction && <HomeButton home={home} onPress={onToggleHome} />}
        {!isAction && <PinButton pinned={pinned} onPress={onTogglePin} />}
      </View>
      {!isLast && <View style={listStyles.separator} />}
    </Fragment>
  );
}

export function LocationSearchList({
  sections,
  busy,
  message,
  deviceMessage,
  isLoading,
  isSearching,
  resultsCount: _resultsCount,
  pinnedLocations,
  homeLocation,
  activeLocation,
  verdictFor,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<LocationSearchListProps>) {
  const c = useWheelyColors();
  const listStyles = useGroupedListStyles();
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeIn.duration(200);
  const exiting = reduceMotion ? undefined : FadeOut.duration(150);

  return (
    <>
      {isSearching && !!message && (
        <View style={[listStyles.card, styles.messageCard]}>
          <View style={styles.messageRow}>
            {isLoading && <ActivityIndicator size="small" color={c.ink} />}
            <ThemedText style={[styles.messageText, { color: c.mutedInk }]}>{message}</ThemedText>
          </View>
        </View>
      )}

      {sections.map((section) => {
        if (section.id === 'pinned' && section.data.length === 0) return null;
        return (
          <Animated.View
            key={section.id}
            entering={entering}
            exiting={exiting}
            style={styles.sectionGroup}
          >
            {section.title ? (
              <ThemedText style={listStyles.header} accessibilityRole="header">
                {section.title}
              </ThemedText>
            ) : null}
            <View style={listStyles.card}>
              {section.data.map((item, idx) => (
                <Animated.View
                  key={item._kind ?? `${item.lat}-${item.lon}`}
                  entering={entering}
                  exiting={exiting}
                >
                  <LocationRow
                    item={item}
                    isLast={idx === section.data.length - 1}
                    busy={busy}
                    pinned={!item._kind && isPinned(item, pinnedLocations)}
                    home={!item._kind && isHome(item, homeLocation)}
                    active={!item._kind && isActive(item, activeLocation)}
                    verdict={verdictFor(item)}
                    onSelect={() => {
                      onSelect(item);
                    }}
                    onTogglePin={() => {
                      onTogglePin(item);
                    }}
                    onToggleHome={() => {
                      onToggleHome(item);
                    }}
                  />
                </Animated.View>
              ))}
            </View>
            {section.id === 'options' && !!deviceMessage && (
              <ThemedText
                style={[styles.deviceMessage, { color: c.mutedInk }]}
                accessibilityLiveRegion="polite"
              >
                {deviceMessage}
              </ThemedText>
            )}
          </Animated.View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  messageCard: {
    padding: Spacing.three,
  },
  deviceMessage: {
    ...Type.caption,
    fontFamily: Fonts.body,
    paddingHorizontal: Spacing.three + Spacing.one,
  },
  messageText: {
    fontSize: Type.body.fontSize,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  sectionGroup: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three + Spacing.one,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    minHeight: GROUPED_ROW_MIN_HEIGHT,
    gap: Spacing.one,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowPressed: {
    opacity: PressedOpacity,
  },
  rowIcon: {
    marginRight: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: Type.body.fontSize,
    fontFamily: Fonts.body,
  },
  rowLabelAction: {
    fontFamily: Fonts.heading,
  },
  // The location currently on screen; weight carries the state so it still
  // reads when the accent check is not enough on its own.
  rowLabelActive: {
    fontFamily: Fonts.heading,
  },
  rowSub: {
    fontSize: Type.small.fontSize,
    fontFamily: Fonts.body,
  },
  chevron: {
    marginLeft: Spacing.two,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Bordered so the pale accent (the wait state) still reads on white paper.
  verdictDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});

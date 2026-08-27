// Default (Android / web) location search list. iOS is shadowed by location-search-list.ios.tsx
// with a native SwiftUI List.
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { Check, ChevronRight, House, Navigation, Pin } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';

import {
  BrutalCard,
  HapticPressable,
  PlatformIcon,
  PressedOpacity,
  SectionTitle,
} from './primitives';
import {
  homeAccessibilityLabel,
  isActive,
  isHome,
  isPinned,
  pinAccessibilityLabel,
  type RowItem,
} from '@/utils/locationRows';

import { type LocationSearchListProps } from './location-search-list.types';

function PinButton({ pinned, onPress }: Readonly<{ pinned: boolean; onPress: () => void }>) {
  const c = useWheelyColors();

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        pinButtonStyles.fallback,
        { borderColor: c.border },
        pressed && pinButtonStyles.pressed,
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
        { borderColor: c.border },
        pressed && pinButtonStyles.pressed,
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
      />
    </HapticPressable>
  );
}

const pinButtonStyles = StyleSheet.create({
  fallback: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});

function LocationRow({
  item,
  isLast,
  busy,
  pinned,
  home,
  active,
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
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleHome: () => void;
}>) {
  const c = useWheelyColors();
  const isDevice = item._kind === 'device';
  const isAction = isDevice;
  const showSub = !isAction && !!item.displayName && !item.displayName.startsWith(item.label);

  return (
    <View style={[styles.row, { borderColor: c.border }, !isLast && styles.rowDivider]}>
      <HapticPressable
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
        onPress={onSelect}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
      >
        {isDevice && (
          <PlatformIcon
            icon={Navigation}
            size={18}
            color={c.ink}
            strokeWidth={2.5}
            style={styles.rowIcon}
          />
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
        </View>
        {!isAction && (
          <PlatformIcon
            icon={active ? Check : ChevronRight}
            size={16}
            color={active ? c.accent : c.mutedInk}
            strokeWidth={active ? 3 : 2.5}
            style={styles.chevron}
          />
        )}
      </HapticPressable>
      {!isAction && <HomeButton home={home} onPress={onToggleHome} />}
      {!isAction && <PinButton pinned={pinned} onPress={onTogglePin} />}
    </View>
  );
}

export function LocationSearchList({
  sections,
  busy,
  message,
  isLoading,
  isSearching,
  resultsCount: _resultsCount,
  pinnedLocations,
  homeLocation,
  activeLocation,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<LocationSearchListProps>) {
  // Styles the message-card contents; rows resolve the card scheme via context.
  const c = useWheelyColors();
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeIn.duration(200);
  const exiting = reduceMotion ? undefined : FadeOut.duration(150);
  const layoutAnim =
    Platform.OS !== 'web' && !reduceMotion ? LinearTransition.duration(250) : undefined;

  return (
    <>
      {isSearching && !!message && (
        <BrutalCard small>
          <View style={styles.messageRow}>
            {isLoading && <ActivityIndicator size="small" color={c.ink} />}
            <ThemedText style={[styles.messageText, { color: c.mutedInk }]}>{message}</ThemedText>
          </View>
        </BrutalCard>
      )}

      {sections.map((section) => {
        if (section.id === 'pinned' && section.data.length === 0) return null;
        return (
          <Animated.View
            key={section.id}
            entering={entering}
            exiting={exiting}
            layout={layoutAnim}
            style={styles.sectionGroup}
          >
            {section.title ? <SectionTitle title={section.title} /> : null}
            <BrutalCard style={styles.sectionCard}>
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
            </BrutalCard>
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
  messageText: {
    fontSize: Type.body.fontSize,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  sectionGroup: {
    gap: Spacing.two,
  },
  sectionCard: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivider: {
    borderBottomWidth: 1,
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
});

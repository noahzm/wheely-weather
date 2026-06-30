// Default (Android / web) location search list. iOS is shadowed by location-search-list.ios.tsx
// with a native SwiftUI List.
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { ChevronRight, Navigation, Pin } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing } from '@/constants/theme';

import { BrutalCard, HapticPressable, SectionTitle } from './primitives';
import { isPinned, type LocationSearchListProps, type RowItem } from './location-search-list.types';

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
      accessibilityLabel={pinned ? 'Unpin location' : 'Pin location'}
    >
      <Pin size={16} color={pinned ? c.ink : c.mutedInk} strokeWidth={pinned ? 2.5 : 2} />
    </HapticPressable>
  );
}

const pinButtonStyles = StyleSheet.create({
  fallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});

function LocationRow({
  item,
  isLast,
  busy,
  pinned,
  onSelect,
  onTogglePin,
}: Readonly<{
  item: RowItem;
  isLast: boolean;
  busy: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}>) {
  const c = useWheelyColors();
  const isDevice = item._kind === 'device';
  const isAction = isDevice;
  const showSub = !isAction && !!item.displayName && !item.displayName.startsWith(item.label);

  return (
    <HapticPressable
      style={({ pressed }) => [
        styles.row,
        { borderColor: c.border },
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onSelect}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      {isDevice && <Navigation size={18} color={c.ink} strokeWidth={2.5} style={styles.rowIcon} />}
      <View style={styles.rowContent}>
        <ThemedText
          style={[styles.rowLabel, isAction && styles.rowLabelAction, { color: c.ink }]}
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
      {!isAction && <PinButton pinned={pinned} onPress={onTogglePin} />}
      {!isAction && (
        <ChevronRight size={16} color={c.mutedInk} strokeWidth={2.5} style={styles.chevron} />
      )}
    </HapticPressable>
  );
}

export function LocationSearchList({
  sections,
  busy,
  message,
  isSearching,
  resultsCount,
  pinnedLocations,
  onSelect,
  onTogglePin,
}: Readonly<LocationSearchListProps>) {
  const c = useWheelyColors();
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeIn.duration(200);
  const exiting = reduceMotion ? undefined : FadeOut.duration(150);
  const layoutAnim =
    Platform.OS !== 'web' && !reduceMotion ? LinearTransition.duration(250) : undefined;

  return (
    <>
      {isSearching && resultsCount === 0 && !!message && (
        <BrutalCard small>
          <ThemedText style={[styles.messageText, { color: c.mutedInk }]}>{message}</ThemedText>
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
                    onSelect={() => {
                      onSelect(item);
                    }}
                    onTogglePin={() => {
                      onTogglePin(item);
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
  messageText: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: Fonts.sans,
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
  },
  rowDivider: {
    borderBottomWidth: 2,
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowIcon: {
    marginRight: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: Fonts.sans,
  },
  rowLabelAction: {
    fontFamily: Fonts.monoBold,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  chevron: {
    marginLeft: Spacing.two,
  },
});

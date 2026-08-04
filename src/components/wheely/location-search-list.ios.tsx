import { StyleSheet, View } from 'react-native';
import {
  Button,
  ContentUnavailableView,
  Host,
  HStack,
  Image,
  Label,
  List,
  ProgressView,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  buttonStyle,
  controlSize,
  disabled,
  foregroundStyle,
  labelStyle,
  listStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { Spacing, TRANSPARENT } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

import {
  homeAccessibilityLabel,
  isActive,
  isHome,
  isPinned,
  pinAccessibilityLabel,
  placeKey,
  type LocationSection,
  type RowItem,
} from '@/utils/locationRows';

import { type LocationSearchListProps } from './location-search-list.types';

function hasSubtitle(item: RowItem): boolean {
  return !!item.displayName && !item.displayName.startsWith(item.label);
}

function LocationRowTexts({ item }: Readonly<{ item: RowItem }>) {
  const showSub = hasSubtitle(item);

  if (showSub) {
    return (
      <VStack alignment="leading" spacing={2}>
        <Text>{item.label}</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {item.displayName}
        </Text>
      </VStack>
    );
  }

  return <Text>{item.label}</Text>;
}

function PinnableRow({
  item,
  busy,
  pinned,
  home,
  active,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<{
  item: RowItem;
  busy: boolean;
  pinned: boolean;
  home: boolean;
  active: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleHome: () => void;
}>) {
  const c = useWheelyColors();
  const rowId = placeKey(item);
  const pinModifiers = [
    labelStyle('iconOnly'),
    buttonStyle('plain'),
    controlSize('small'),
    disabled(busy),
    tint(c.accent),
  ];
  const swipePinModifiers = [labelStyle('iconOnly'), tint(c.accent)];
  const homeSystemImage = home ? 'house.fill' : 'house';

  return (
    <SwipeActions modifiers={[tag(rowId)]}>
      <HStack alignment="center">
        <Button modifiers={[buttonStyle('plain'), disabled(busy)]} onPress={onSelect}>
          <LocationRowTexts item={item} />
          <Spacer />
          {/* Always rendered so row contents keep a stable width; the checkmark
              is simply invisible for the locations that are not on screen. */}
          <Image
            systemName="checkmark"
            size={15}
            modifiers={[foregroundStyle(active ? c.accent : TRANSPARENT)]}
          />
        </Button>
        <Button
          label={homeAccessibilityLabel(home)}
          systemImage={homeSystemImage}
          modifiers={pinModifiers}
          onPress={onToggleHome}
        />
        <Button
          label={pinAccessibilityLabel(pinned)}
          systemImage={pinned ? 'pin.fill' : 'pin'}
          modifiers={pinModifiers}
          onPress={onTogglePin}
        />
      </HStack>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe>
        <Button
          systemImage={pinned ? 'pin.fill' : 'pin'}
          label={pinAccessibilityLabel(pinned)}
          modifiers={swipePinModifiers}
          onPress={onTogglePin}
        />
        <Button
          systemImage={homeSystemImage}
          label={homeAccessibilityLabel(home)}
          modifiers={swipePinModifiers}
          onPress={onToggleHome}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function OptionsRow({
  item,
  busy,
  onSelect,
}: Readonly<{
  item: RowItem;
  busy: boolean;
  onSelect: (item: RowItem) => void;
}>) {
  return (
    <Button
      modifiers={[buttonStyle('plain'), disabled(busy)]}
      onPress={() => {
        onSelect(item);
      }}
    >
      <Label title={item.label} systemImage="location.fill" modifiers={[tag(placeKey(item))]} />
      <Spacer />
    </Button>
  );
}

function LocationSectionView({
  section,
  busy,
  pinnedLocations,
  homeLocation,
  activeLocation,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<{
  section: LocationSection;
  busy: boolean;
  pinnedLocations: LocationSearchListProps['pinnedLocations'];
  homeLocation: LocationSearchListProps['homeLocation'];
  activeLocation: LocationSearchListProps['activeLocation'];
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
  onToggleHome: (item: RowItem) => void;
}>) {
  if (section.id === 'options') {
    return (
      <Section title={section.title}>
        {section.data.map((item) => (
          <OptionsRow key={placeKey(item)} item={item} busy={busy} onSelect={onSelect} />
        ))}
      </Section>
    );
  }

  return (
    <Section title={section.title}>
      <List.ForEach>
        {section.data.map((item) => (
          <PinnableRow
            key={placeKey(item)}
            item={item}
            busy={busy}
            pinned={isPinned(item, pinnedLocations)}
            home={isHome(item, homeLocation)}
            active={isActive(item, activeLocation)}
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
        ))}
      </List.ForEach>
    </Section>
  );
}

/**
 * iOS location search list — native SwiftUI List with tap-to-pin and swipe-to-pin.
 */
export function LocationSearchList({
  sections,
  busy,
  message,
  isLoading: _isLoading,
  isSearching,
  resultsCount,
  pinnedLocations,
  homeLocation,
  activeLocation,
  onSelect,
  onTogglePin,
  onToggleHome,
}: Readonly<LocationSearchListProps>) {
  const showUnavailable = isSearching && !!message && resultsCount === 0;

  return (
    <View style={styles.container}>
      <Host style={styles.listHost}>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            animation(Animation.spring({ duration: 0.35 }), pinnedLocations.length),
          ]}
        >
          {showUnavailable && (
            <ContentUnavailableView title={message} systemImage="magnifyingglass" />
          )}
          {sections.map((section) => (
            <LocationSectionView
              key={section.id}
              section={section}
              busy={busy}
              pinnedLocations={pinnedLocations}
              homeLocation={homeLocation}
              activeLocation={activeLocation}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onToggleHome={onToggleHome}
            />
          ))}
        </List>
      </Host>
      {busy && (
        <View style={styles.progressBar}>
          <Host matchContents style={styles.progressHost}>
            <ProgressView />
          </Host>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  listHost: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  progressHost: {
    backgroundColor: TRANSPARENT,
  },
  progressBar: {
    position: 'absolute',
    bottom: Spacing.four,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

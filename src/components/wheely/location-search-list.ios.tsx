import { StyleSheet, View } from 'react-native';
import {
  Button,
  ContentUnavailableView,
  Host,
  HStack,
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
  isPinned,
  pinAccessibilityLabel,
  placeKey,
  type LocationSearchListProps,
  type LocationSection,
  type RowItem,
} from './location-search-list.types';

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
  onSelect,
  onTogglePin,
}: Readonly<{
  item: RowItem;
  busy: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}>) {
  const c = useWheelyColors();
  const rowId = placeKey(item);
  const pinModifiers = [
    labelStyle('iconOnly'),
    buttonStyle('plain'),
    controlSize('small'),
    disabled(busy),
    tint(c.primary),
  ];
  const swipePinModifiers = [labelStyle('iconOnly'), tint(c.primary)];

  return (
    <SwipeActions modifiers={[tag(rowId)]}>
      <HStack alignment="center">
        <Button modifiers={[buttonStyle('plain'), disabled(busy)]} onPress={onSelect}>
          <LocationRowTexts item={item} />
          <Spacer />
        </Button>
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
  onSelect,
  onTogglePin,
}: Readonly<{
  section: LocationSection;
  busy: boolean;
  pinnedLocations: LocationSearchListProps['pinnedLocations'];
  onSelect: (item: RowItem) => void;
  onTogglePin: (item: RowItem) => void;
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
            onSelect={() => {
              onSelect(item);
            }}
            onTogglePin={() => {
              onTogglePin(item);
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
  onSelect,
  onTogglePin,
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
              onSelect={onSelect}
              onTogglePin={onTogglePin}
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

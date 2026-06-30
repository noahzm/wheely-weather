import { StyleSheet, View } from 'react-native';
import {
  Button,
  ContentUnavailableView,
  Host,
  Label,
  List,
  ProgressView,
  Section,
  SwipeActions,
  Text,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  disabled,
  foregroundStyle,
  listRowSeparator,
  listStyle,
  onTapGesture,
  scrollContentBackground,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { Spacing, TRANSPARENT } from '@/constants/theme';

import {
  isPinned,
  placeKey,
  type LocationSearchListProps,
  type LocationSection,
  type RowItem,
} from './location-search-list.types';

function hasSubtitle(item: RowItem): boolean {
  return !!item.displayName && !item.displayName.startsWith(item.label);
}

function LocationRowLabel({
  item,
  busy,
  onSelect,
}: Readonly<{
  item: RowItem;
  busy: boolean;
  onSelect: () => void;
}>) {
  const showSub = hasSubtitle(item);
  const rowModifiers = [onTapGesture(onSelect), disabled(busy)];

  if (showSub) {
    return (
      <Label modifiers={rowModifiers}>
        <Text>{item.label}</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {item.displayName}
        </Text>
      </Label>
    );
  }

  return <Label title={item.label} modifiers={rowModifiers} />;
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
  const rowId = placeKey(item);

  return (
    <SwipeActions modifiers={[tag(rowId), listRowSeparator('hidden')]}>
      <LocationRowLabel item={item} busy={busy} onSelect={onSelect} />
      <SwipeActions.Actions edge="trailing" allowsFullSwipe>
        <Button
          systemImage={pinned ? 'pin.slash' : 'pin'}
          label={pinned ? 'Unpin' : 'Pin'}
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
    <Label
      title={item.label}
      systemImage="location.fill"
      modifiers={[
        tag(placeKey(item)),
        onTapGesture(() => {
          onSelect(item);
        }),
        disabled(busy),
      ]}
    />
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
 * iOS location search list — native SwiftUI List with swipe-to-pin.
 */
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
  const showUnavailable = isSearching && resultsCount === 0 && !!message;

  return (
    <View style={styles.container}>
      <Host style={styles.listHost}>
        <List
          modifiers={[
            listStyle('plain'),
            scrollContentBackground('hidden'),
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

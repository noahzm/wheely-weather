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
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  bold,
  buttonStyle,
  controlSize,
  disabled,
  foregroundStyle,
  labelStyle,
  listStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { Spacing, TRANSPARENT } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

import {
  isActive,
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

function LocationRowTexts({
  item,
  active = false,
  withSubtitle = false,
}: Readonly<{
  item: RowItem;
  /** The location the forecast is showing; carried by weight as well as colour. */
  active?: boolean;
  /**
   * Only search results show the subtitle. It disambiguates two same-named
   * cities while you are choosing between them; once a place is saved you
   * picked it deliberately, and "United States" under every US row is noise.
   */
  withSubtitle?: boolean;
}>) {
  const labelModifiers = active ? [bold()] : [];

  if (withSubtitle && hasSubtitle(item)) {
    return (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={labelModifiers}>{item.label}</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {item.displayName}
        </Text>
      </VStack>
    );
  }

  return <Text modifiers={labelModifiers}>{item.label}</Text>;
}

/**
 * A saved place: tap to show its forecast, pin button to keep it in the list.
 *
 * Setting home lives in Settings › Home climate rather than on every row — it
 * is one global choice, not a per-row one, and duplicating it here cost a second
 * control on the trailing edge. Pin stays inline rather than behind a swipe
 * because a swipe action's glyph is forced white by SwiftUI, and white cannot
 * sit on the accent (1.6:1); on the row itself the accent reads at ~11.8:1.
 */
function PinnableRow({
  item,
  busy,
  pinned,
  active,
  onSelect,
  onTogglePin,
}: Readonly<{
  item: RowItem;
  busy: boolean;
  pinned: boolean;
  active: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}>) {
  const c = useWheelyColors();

  return (
    <HStack alignment="center">
      <Button modifiers={[buttonStyle('plain'), disabled(busy)]} onPress={onSelect}>
        <LocationRowTexts item={item} active={active} />
        <Spacer />
        {/* A checkmark is the native idiom for the selected row, and it does not
            fight the group's own rounding or separators the way a stroked
            outline does. Always rendered so rows keep a stable width; it is
            simply invisible for the locations that are not on screen. */}
        <Image
          systemName="checkmark"
          size={15}
          modifiers={[foregroundStyle(active ? c.accent : TRANSPARENT)]}
        />
      </Button>
      {/* No controlSize('small') here: at the default size this clears the 44pt
          minimum, which the previous 15pt icon buttons did not. Colour carries
          the state alongside the fill, since fill alone was near-invisible. */}
      <Button
        label={pinAccessibilityLabel(pinned)}
        systemImage={pinned ? 'pin.fill' : 'pin'}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle('plain'),
          disabled(busy),
          foregroundStyle(
            pinned ? c.accent : { type: 'hierarchical' as const, style: 'secondary' as const },
          ),
        ]}
        onPress={onTogglePin}
      />
    </HStack>
  );
}

/**
 * Search results are tap-to-select only. Their coordinates are unresolved until
 * the row is picked, so pinning one would save a placeless entry — and the
 * home/pin actions only mean anything once a place already matters to you.
 */
function ResultRow({
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
      <LocationRowTexts item={item} withSubtitle />
      <Spacer />
    </Button>
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
  activeLocation,
  onSelect,
  onTogglePin,
}: Readonly<{
  section: LocationSection;
  busy: boolean;
  pinnedLocations: LocationSearchListProps['pinnedLocations'];
  activeLocation: LocationSearchListProps['activeLocation'];
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

  if (section.id === 'results') {
    return (
      <Section title={section.title}>
        {section.data.map((item) => (
          <ResultRow key={placeKey(item)} item={item} busy={busy} onSelect={onSelect} />
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
            active={isActive(item, activeLocation)}
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
  isLoading,
  isSearching,
  resultsCount,
  pinnedLocations,
  activeLocation,
  onSelect,
  onTogglePin,
}: Readonly<LocationSearchListProps>) {
  const showProgress = isSearching && isLoading;
  // ContentUnavailableView is for "nothing to show" — no matches, or a failed
  // search. Using it for the in-flight state made a heavy placeholder card
  // flash on every debounce cycle, so loading gets the quiet inline row below.
  const showUnavailable = isSearching && !!message && resultsCount === 0 && !isLoading;

  return (
    <View style={styles.container}>
      <Host style={styles.listHost}>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            animation(Animation.spring({ duration: 0.35 }), pinnedLocations.length),
          ]}
        >
          {showProgress && (
            <HStack spacing={Spacing.two}>
              <Spacer />
              <ProgressView modifiers={[controlSize('small')]} />
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {message}
              </Text>
              <Spacer />
            </HStack>
          )}
          {showUnavailable && (
            <ContentUnavailableView title={message} systemImage="magnifyingglass" />
          )}
          {sections.map((section) => (
            <LocationSectionView
              key={section.id}
              section={section}
              busy={busy}
              pinnedLocations={pinnedLocations}
              activeLocation={activeLocation}
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

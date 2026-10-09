import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import type { SearchBarCommands } from 'react-native-screens';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Search, X } from '@/components/wheely/icons';

import {
  WebContentColumn,
  WebScreenHeader,
  WebScreenTitle,
  bottomNavBarHeight,
} from '@/components/wheely';
import {
  WEB_TITLE_CONTENT_SPACING,
  WebCompactTitleBar,
  useWebTitleCollapse,
} from '@/components/wheely/web-screen-header';
import { ScreenGutter } from '@/components/wheely/content-column';
import { HapticPressable, PlatformIcon } from '@/components/wheely/primitives';
import { ThemedText } from '@/components/themed-text';
import { LocationSearchList } from '@/components/wheely/location-search-list';
import { useLocationSearchScreen } from '@/hooks/use-location-search-screen';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Spacing, TRANSPARENT, Type } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const SEARCH_FIELD_HEIGHT = 44;

// Styled after the iOS search bar: a filled capsule with no outline, a clear
// button inside, and Cancel beside it while the field is in use.
function SearchField({
  query,
  onQueryChange,
}: Readonly<{
  query: string;
  onQueryChange: (text: string) => void;
}>) {
  const c = useWheelyColors();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const showCancel = focused || query.length > 0;
  return (
    <View style={styles.searchBar}>
      <View style={[styles.searchField, { backgroundColor: withAlpha(c.ink, 0.1) }]}>
        <PlatformIcon icon={Search} size={17} color={c.mutedInk} strokeWidth={2.5} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search a city or place"
          placeholderTextColor={c.mutedInk}
          style={[styles.searchInput, { color: c.ink }]}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          enterKeyHint="search"
          accessibilityLabel="Search for a location"
          underlineColorAndroid="transparent"
          cursorColor={c.accent}
          selectionColor={c.accent}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
        />
        {query.length > 0 && (
          <HapticPressable
            onPress={() => {
              onQueryChange('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.clearButton, { backgroundColor: withAlpha(c.ink, 0.4) }]}
          >
            <PlatformIcon icon={X} size={10} color={c.background} strokeWidth={3} />
          </HapticPressable>
        )}
      </View>
      {showCancel && (
        <HapticPressable
          onPress={() => {
            onQueryChange('');
            inputRef.current?.blur();
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ThemedText style={[styles.cancelText, { color: c.ink }]}>Cancel</ThemedText>
        </HapticPressable>
      )}
    </View>
  );
}

// iOS search bar config. The ref is attached where the options are built in
// JSX: the React Compiler lint rejects passing a ref into a helper at render.
function iosSearchBarOptions(setQuery: (val: string) => void) {
  return {
    placeholder: 'Search a city or place',
    autoCapitalize: 'words' as const,
    hideWhenScrolling: false,
    onChangeText: (e: { nativeEvent: { text: string } }) => {
      setQuery(e.nativeEvent.text);
    },
  };
}

export default function LocationSearchScreen() {
  const c = useWheelyColors();
  const insets = useSafeAreaInsets();
  const titleCollapsed = useWebTitleCollapse();
  // Closes the native search bar once a place loads, so Search opens fresh.
  const searchBarRef = useRef<SearchBarCommands>(null);
  const {
    query,
    setQuery,
    busy,
    message,
    deviceMessage,
    isLoading,
    isSearching,
    resultsCount,
    sections,
    pinnedLocations,
    homeLocation,
    activeLocation,
    verdictFor,
    handleSelect,
    handleTogglePin,
    handleToggleHome,
  } = useLocationSearchScreen(() => searchBarRef.current?.cancelSearch());

  const listProps = {
    sections,
    busy,
    message,
    deviceMessage,
    isLoading,
    isSearching,
    resultsCount,
    pinnedLocations,
    homeLocation,
    activeLocation,
    verdictFor,
    onSelect: handleSelect,
    onTogglePin: handleTogglePin,
    onToggleHome: handleToggleHome,
  };

  return (
    <>
      <Head>
        <title>Search Location — Wheely Weather</title>
        <meta
          name="description"
          content="Search for a city or location to get today's cycling weather forecast."
        />
      </Head>
      <Stack.Screen
        options={
          isIOS
            ? { headerSearchBarOptions: { ...iosSearchBarOptions(setQuery), ref: searchBarRef } }
            : { headerShown: !isWeb }
        }
      />
      <View style={styles.screen} collapsable={false}>
        {isIOS ? (
          <LocationSearchList {...listProps} />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={
              isWeb
                ? [styles.scrollContentWeb, { paddingBottom: bottomNavBarHeight(insets.bottom) }]
                : styles.scrollContent
            }
          >
            <WebContentColumn innerStyle={styles.scrollInner}>
              {isWeb && (
                <WebScreenHeader
                  variant="title"
                  withScreenGutter={false}
                  title={<WebScreenTitle>Search</WebScreenTitle>}
                />
              )}
              <SearchField query={query} onQueryChange={setQuery} />
              <LocationSearchList {...listProps} />
            </WebContentColumn>
          </ScrollView>
        )}
        {isWeb && <WebCompactTitleBar title="Search" visible={titleCollapsed} />}
        {busy && !isIOS && (
          <View style={[styles.busyOverlay, { backgroundColor: withAlpha(c.shadow, 0.15) }]}>
            <ActivityIndicator color={c.accent} size="large" />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  scroll: {
    backgroundColor: TRANSPARENT,
  },
  scrollContent: {
    paddingHorizontal: ScreenGutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  scrollContentWeb: {
    width: '100%',
    alignItems: 'center',
  },
  scrollInner: {
    gap: WEB_TITLE_CONTENT_SPACING,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: SEARCH_FIELD_HEIGHT,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: Type.body.fontSize,
    fontFamily: Fonts.body,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : null),
  },
  clearButton: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: Fonts.body,
    ...Type.body,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Search, X } from '@/components/wheely/icons';

import {
  WebContentColumn,
  WebScreenHeader,
  WebScreenTitle,
  bottomNavBarHeight,
} from '@/components/wheely';
import { WEB_TITLE_CONTENT_SPACING } from '@/components/wheely/web-screen-header';
import { ScreenGutter } from '@/components/wheely/content-column';
import { BrutalCard, HapticPressable, PlatformIcon } from '@/components/wheely/primitives';
import { LocationSearchList } from '@/components/wheely/location-search-list';
import { useLocationSearchScreen } from '@/hooks/use-location-search-screen';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, TRANSPARENT, Type } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

function SearchField({
  query,
  onQueryChange,
}: Readonly<{
  query: string;
  onQueryChange: (text: string) => void;
}>) {
  // Card contents render on the card's paper surface.
  const c = useWheelyColors();
  const [focused, setFocused] = useState(false);
  return (
    <BrutalCard
      small
      style={[
        styles.searchCard,
        focused && {
          borderColor: c.accent,
          borderWidth: 2,
        },
      ]}
    >
      <View style={styles.searchRow}>
        <PlatformIcon icon={Search} size={18} color={c.mutedInk} strokeWidth={2.5} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search a city or place"
          placeholderTextColor={c.mutedInk}
          style={[styles.searchInput, { color: c.ink }]}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
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
          >
            <PlatformIcon icon={X} size={18} color={c.mutedInk} strokeWidth={2.5} />
          </HapticPressable>
        )}
      </View>
    </BrutalCard>
  );
}

function getScreenOptions(setQuery: (val: string) => void) {
  if (isWeb) {
    return { headerShown: false };
  }
  if (isIOS) {
    return {
      headerSearchBarOptions: {
        placeholder: 'Search a city or place',
        autoCapitalize: 'words' as const,
        hideWhenScrolling: false,
        onChangeText: (e: { nativeEvent: { text: string } }) => {
          setQuery(e.nativeEvent.text);
        },
      },
    };
  }
  return {};
}

export default function LocationSearchScreen() {
  const c = useWheelyColors();
  const insets = useSafeAreaInsets();
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
    handleSelect,
    handleTogglePin,
    handleToggleHome,
  } = useLocationSearchScreen();

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
      <Stack.Screen options={getScreenOptions(setQuery)} />
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
  searchCard: {
    paddingVertical: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: Type.body.fontSize,
    fontFamily: Fonts.body,
    paddingVertical: Spacing.one,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : null),
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

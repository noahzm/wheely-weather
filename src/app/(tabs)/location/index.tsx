import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Search, X } from 'lucide-react-native';

import {
  BrutalCard,
  HapticPressable,
  WebContentColumn,
  bottomNavBarHeight,
} from '@/components/wheely';
import { LocationSearchList } from '@/components/wheely/location-search-list';
import { useLocationSearchScreen } from '@/hooks/use-location-search-screen';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, TRANSPARENT } from '@/constants/theme';

const BUSY_OVERLAY_COLOR = 'rgba(0,0,0,0.15)';
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

function WebSearchField({
  c,
  query,
  onQueryChange,
}: Readonly<{
  c: ReturnType<typeof useWheelyColors>;
  query: string;
  onQueryChange: (text: string) => void;
}>) {
  return (
    <BrutalCard small style={styles.searchCard}>
      <View style={styles.searchRow}>
        <Search size={18} color={c.mutedInk} strokeWidth={2.5} />
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
        />
        {query.length > 0 && (
          <HapticPressable
            onPress={() => {
              onQueryChange('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={c.mutedInk} strokeWidth={2.5} />
          </HapticPressable>
        )}
      </View>
    </BrutalCard>
  );
}

export default function LocationSearchScreen() {
  const c = useWheelyColors();
  const {
    query,
    setQuery,
    busy,
    message,
    isSearching,
    resultsCount,
    sections,
    pinnedLocations,
    handleSelect,
    handleTogglePin,
  } = useLocationSearchScreen();

  const listProps = {
    sections,
    busy,
    message,
    isSearching,
    resultsCount,
    pinnedLocations,
    onSelect: handleSelect,
    onTogglePin: handleTogglePin,
  };

  return (
    <>
      <Stack.Screen
        options={
          isWeb
            ? { headerShown: false }
            : {
                headerSearchBarOptions: {
                  placeholder: 'Search a city or place',
                  autoCapitalize: 'words',
                  hideWhenScrolling: false,
                  onChangeText: (e) => {
                    setQuery(e.nativeEvent.text);
                  },
                },
              }
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
            contentContainerStyle={isWeb ? styles.scrollContentWeb : styles.scrollContent}
          >
            <WebContentColumn innerStyle={styles.scrollInner}>
              {isWeb && <WebSearchField c={c} query={query} onQueryChange={setQuery} />}
              <LocationSearchList {...listProps} />
            </WebContentColumn>
          </ScrollView>
        )}
        {busy && !isIOS && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={c.primary} size="large" />
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  scrollContentWeb: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingBottom: bottomNavBarHeight(0) + Spacing.six,
  },
  scrollInner: {
    gap: Spacing.four,
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
    fontSize: 16,
    fontFamily: Fonts.sans,
    paddingVertical: Spacing.one,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : null),
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUSY_OVERLAY_COLOR,
    zIndex: 10,
  },
});

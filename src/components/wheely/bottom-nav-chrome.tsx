import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Home, Search, Settings } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { GlassChrome } from './glass-chrome';
import { HapticPressable } from './primitives';

const NAV_TAB_HEIGHT = 40;
const TAB_ICON_SIZE = 22;

/** Returns the full height of the bottom nav bar including device safe inset. */
export function bottomNavBarHeight(insetsBottom: number) {
  return Spacing.three + NAV_TAB_HEIGHT + Spacing.three + insetsBottom;
}

function useBottomNavStyles(c: WheelyPalette) {
  return useMemo(
    () =>
      StyleSheet.create({
        bar: {
          width: '100%',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          paddingTop: Spacing.two,
        },
        tabsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        tabItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          minHeight: NAV_TAB_HEIGHT,
          paddingHorizontal: Spacing.one,
        },
        tabLabel: {
          fontFamily: Fonts.monoBold,
          fontSize: 11,
        },
      }),
    [c.border],
  );
}

/** Persistent bottom navigation bar. Renders on web only; returns null on native (native uses NativeTabs). */
export function BottomNavBar() {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  const styles = useBottomNavStyles(c);
  const router = useRouter();
  const pathname = usePathname();

  if (Platform.OS !== 'web') return null;

  const isHome = pathname === '/';
  const isLocation = pathname === '/location';
  const isSettings = pathname === '/settings';

  const homeColor = isHome ? c.ink : c.mutedInk;
  const locationColor = isLocation ? c.ink : c.mutedInk;
  const settingsColor = isSettings ? c.ink : c.mutedInk;

  return (
    <GlassChrome style={[styles.bar, { paddingBottom: insets.bottom + Spacing.two }]}>
      <View style={styles.tabsRow}>
        <HapticPressable
          onPress={() => { router.navigate('/'); }}
          accessibilityRole="tab"
          accessibilityLabel="Home"
          accessibilityState={{ selected: isHome }}
          style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
        >
          <Home size={TAB_ICON_SIZE} color={homeColor} strokeWidth={isHome ? 2.5 : 2} />
          <Text style={[styles.tabLabel, { color: homeColor }]}>Home</Text>
        </HapticPressable>

        <HapticPressable
          onPress={() => { router.navigate('/location'); }}
          accessibilityRole="tab"
          accessibilityLabel="Search"
          accessibilityState={{ selected: isLocation }}
          style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
        >
          <Search size={TAB_ICON_SIZE} color={locationColor} strokeWidth={isLocation ? 2.5 : 2} />
          <Text style={[styles.tabLabel, { color: locationColor }]}>Search</Text>
        </HapticPressable>

        <HapticPressable
          onPress={() => { router.navigate('/settings'); }}
          accessibilityRole="tab"
          accessibilityLabel="Settings"
          accessibilityState={{ selected: isSettings }}
          style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
        >
          <Settings size={TAB_ICON_SIZE} color={settingsColor} strokeWidth={isSettings ? 2.5 : 2} />
          <Text style={[styles.tabLabel, { color: settingsColor }]}>Settings</Text>
        </HapticPressable>
      </View>
    </GlassChrome>
  );
}

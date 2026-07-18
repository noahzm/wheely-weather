import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Home, Search, Settings, type LucideIcon } from 'lucide-react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import {
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import { GlassChrome } from './glass-chrome';
import { HapticPressable, PlatformIcon } from './primitives';

const NAV_TAB_HEIGHT = 40;
const TAB_ICON_SIZE = 22;
const DARK_INACTIVE_TAB_OPACITY = 0.72;

/** Returns the full height of the bottom nav bar including device safe inset. */
export function bottomNavBarHeight(insetsBottom: number) {
  return Spacing.three + NAV_TAB_HEIGHT + Spacing.three + insetsBottom;
}

/** Returns bottom padding to clear the web bottom nav bar including safe area. */
export function webBottomInset(insetsBottom: number) {
  return bottomNavBarHeight(insetsBottom);
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
          // Keep the glass bar full-bleed but align the tabs with the content column.
          width: '100%',
          maxWidth: MaxContentWidth,
          alignSelf: 'center',
        },
        tabItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: NAV_TAB_HEIGHT,
          paddingHorizontal: Spacing.one,
        },
        tabPill: {
          alignItems: 'center',
          gap: 3,
          borderRadius: Radius.small,
          paddingVertical: Spacing.one,
          paddingHorizontal: Spacing.three,
        },
        tabPillActive: {
          backgroundColor: c.primary,
        },
        tabPillInactive: {},
        tabLabel: {
          fontFamily: Fonts.heading,
          fontSize: Type.micro.fontSize,
        },
      }),
    [c.border, c.primary],
  );
}

function NavTab({
  label,
  icon: Icon,
  active,
  onPress,
  styles,
  c,
  inactiveOpacity,
}: Readonly<{
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof useBottomNavStyles>;
  c: WheelyPalette;
  inactiveOpacity: number;
}>) {
  const color = active ? c.primaryInk : c.ink;
  const inactiveStyle = !active && inactiveOpacity < 1 ? { opacity: inactiveOpacity } : null;
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.tabPill,
          active ? styles.tabPillActive : styles.tabPillInactive,
          inactiveStyle,
        ]}
      >
        <PlatformIcon
          icon={Icon}
          size={TAB_ICON_SIZE}
          color={color}
          strokeWidth={active ? 2.5 : 2}
        />
        <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      </View>
    </HapticPressable>
  );
}

/** Persistent bottom navigation bar. Renders on web only; returns null on native (native uses NativeTabs). */
export function BottomNavBar() {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  const colorScheme = useColorSchemeName();
  const styles = useBottomNavStyles(c);
  const inactiveOpacity = colorScheme === 'light' ? 1 : DARK_INACTIVE_TAB_OPACITY;
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  if (Platform.OS !== 'web') return null;

  const tabSegment = segments.at(-1) ?? '';
  const isHome = pathname === '/' || tabSegment === '(home)' || tabSegment === 'index';
  const isLocation = pathname.startsWith('/location') || tabSegment === 'location';
  const isSettings = pathname.startsWith('/settings') || tabSegment === 'settings';

  return (
    <GlassChrome style={[styles.bar, { paddingBottom: insets.bottom + Spacing.two }]}>
      <View style={styles.tabsRow} accessibilityRole="tablist">
        <NavTab
          label="Home"
          icon={Home}
          active={isHome}
          onPress={() => {
            if (!isHome) router.dismissTo('/');
          }}
          styles={styles}
          c={c}
          inactiveOpacity={inactiveOpacity}
        />
        <NavTab
          label="Search"
          icon={Search}
          active={isLocation}
          onPress={() => {
            if (!isLocation) router.dismissTo('/location');
          }}
          styles={styles}
          c={c}
          inactiveOpacity={inactiveOpacity}
        />
        <NavTab
          label="Settings"
          icon={Settings}
          active={isSettings}
          onPress={() => {
            if (!isSettings) router.dismissTo('/settings');
          }}
          styles={styles}
          c={c}
          inactiveOpacity={inactiveOpacity}
        />
      </View>
    </GlassChrome>
  );
}

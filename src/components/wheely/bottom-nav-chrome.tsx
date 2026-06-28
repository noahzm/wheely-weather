import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Home, Settings } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { GlassChrome } from './glass-chrome';
import { HapticPressable } from './primitives';

const NAV_CIRCLE_SIZE = 40;
const NAV_PILL_RADIUS = 20;
const NAV_CIRCLE_RADIUS = NAV_CIRCLE_SIZE / 2;
const isIos = Platform.OS === 'ios';

/** Returns the full height of the bottom nav bar including device safe inset. */
export function bottomNavBarHeight(insetsBottom: number) {
  return Spacing.three + NAV_CIRCLE_SIZE + Spacing.three + insetsBottom;
}

function useBottomNavStyles() {
  return useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.two,
        },
        circle: {
          width: NAV_CIRCLE_SIZE,
          height: NAV_CIRCLE_SIZE,
          borderRadius: NAV_CIRCLE_RADIUS,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pill: {
          borderRadius: NAV_PILL_RADIUS,
          paddingHorizontal: Spacing.three,
          height: NAV_CIRCLE_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cityLabel: {
          fontFamily: Fonts.monoBold,
          fontSize: 15,
        },
        hitTarget: {
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [],
  );
}

/**
 * Persistent bottom navigation bar. Renders on web and iOS; returns null on
 * Android (Android keeps the Stack header). On iOS the left slot is a Back
 * chevron on non-home routes and the Home icon on the home route; on web the
 * left slot is always Home. iOS icons use SF Symbols to match the native chrome.
 */
function leftSlotIcon(c: WheelyPalette, showBack: boolean, isHome: boolean) {
  if (showBack) {
    return isIos ? (
      <SymbolView name="chevron.backward" size={22} tintColor={c.ink} />
    ) : (
      <ChevronLeft size={22} color={c.ink} strokeWidth={2.5} />
    );
  }
  return isIos ? (
    <SymbolView name="house.fill" size={20} tintColor={isHome ? c.ink : c.mutedInk} />
  ) : (
    <Home size={20} color={isHome ? c.ink : c.mutedInk} strokeWidth={isHome ? 2.5 : 2} />
  );
}

function settingsIcon(c: WheelyPalette, isSettings: boolean) {
  return isIos ? (
    <SymbolView name="gearshape.fill" size={20} tintColor={isSettings ? c.ink : c.mutedInk} />
  ) : (
    <Settings
      size={20}
      color={isSettings ? c.ink : c.mutedInk}
      strokeWidth={isSettings ? 2.5 : 2}
    />
  );
}

export function BottomNavBar() {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  const styles = useBottomNavStyles();
  const router = useRouter();
  const pathname = usePathname();
  const forecast = useForecast();

  if (Platform.OS !== 'web') return null;

  const cityLabel = (
    (forecast.snapshot?.location ?? 'Location').split(',')[0] ?? 'Location'
  ).trim();
  const isHome = pathname === '/';
  const isLocation = pathname === '/location';
  const isSettings = pathname === '/settings';

  // On iOS, pushed screens (e.g. Settings) show a Back chevron in the left
  // slot instead of Home — Home is reached by going back. Web keeps Home.
  const showBack = isIos && !isHome;

  return (
    <View
      style={{
        paddingTop: Spacing.three,
        paddingBottom: insets.bottom + Spacing.three,
        width: '100%',
        alignItems: 'center',
      }}
    >
      <View style={styles.row}>
        {/* Left: Back (iOS non-home) or Home */}
        <HapticPressable
          onPress={() => {
            if (showBack) {
              router.back();
            } else {
              router.navigate('/');
            }
          }}
          accessibilityRole={showBack ? 'button' : 'tab'}
          accessibilityLabel={showBack ? 'Back' : 'Home'}
          accessibilityState={showBack ? undefined : { selected: isHome }}
          style={({ pressed }) => [styles.hitTarget, pressed && { opacity: 0.7 }]}
        >
          <GlassChrome style={styles.circle}>{leftSlotIcon(c, showBack, isHome)}</GlassChrome>
        </HapticPressable>

        {/* City pill */}
        <HapticPressable
          onPress={() => {
            router.navigate('/location');
          }}
          accessibilityRole="tab"
          accessibilityLabel={`Location: ${cityLabel}`}
          accessibilityState={{ selected: isLocation }}
          style={({ pressed }) => [styles.hitTarget, pressed && { opacity: 0.7 }]}
        >
          <GlassChrome style={styles.pill}>
            <Text
              style={[styles.cityLabel, { color: isLocation ? c.ink : c.mutedInk }]}
              numberOfLines={1}
            >
              {cityLabel}
            </Text>
          </GlassChrome>
        </HapticPressable>

        {/* Settings circle */}
        <HapticPressable
          onPress={() => {
            router.navigate('/settings');
          }}
          accessibilityRole="tab"
          accessibilityLabel="Settings"
          accessibilityState={{ selected: isSettings }}
          style={({ pressed }) => [styles.hitTarget, pressed && { opacity: 0.7 }]}
        >
          <GlassChrome style={styles.circle}>{settingsIcon(c, isSettings)}</GlassChrome>
        </HapticPressable>
      </View>
    </View>
  );
}

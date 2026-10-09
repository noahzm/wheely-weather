import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CloudSun, Search, Settings, type IconComponent } from './icons';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import { GlassChrome } from './glass-chrome';
import { ScreenGutter } from './content-column';
import { HapticPressable, PlatformIcon } from './primitives';

// Mirrors the iOS 26 tab bar: a floating glass capsule for the tabs, with
// Search split off into its own glass circle (the native `role="search"` tab).
const CAPSULE_HEIGHT = 62;
const CAPSULE_PADDING = 4;
const TAB_ICON_SIZE = 22;
// The capsule hugs its tabs like the native bar instead of spanning a desktop window.
const MAX_BAR_WIDTH = 440;
// Tabs in the capsule; the selection highlight slides across this many slots.
const CAPSULE_TABS = 2;
// A slight overshoot, like the iOS 26 tab bar's springy selection lens.
const SLIDE_EASING = 'cubic-bezier(0.34, 1.3, 0.5, 1)';
// Web-only CSS transitions (React Native styles have no `transition` key).
const tabMotion = { transition: 'transform 0.18s ease, background-color 0.2s ease' } as ViewStyle;

/** Space the floating bar covers at the bottom of the screen, including the safe area. */
export function bottomNavBarHeight(insetsBottom: number) {
  return barBottomOffset(insetsBottom) + CAPSULE_HEIGHT + Spacing.three;
}

/** Bottom padding that lets scroll content clear the floating bar. */
export function webBottomInset(insetsBottom: number) {
  return bottomNavBarHeight(insetsBottom);
}

function barBottomOffset(insetsBottom: number) {
  return Math.max(insetsBottom, Spacing.three);
}

function makeStyles(c: WheelyPalette) {
  const edge = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(c.ink, 0.14),
    boxShadow: `0 8px 24px ${withAlpha(c.shadow, 0.18)}`,
  };
  return StyleSheet.create({
    wrap: {
      width: '100%',
      maxWidth: MAX_BAR_WIDTH + ScreenGutter * 2,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: ScreenGutter,
    },
    capsule: {
      flex: 1,
      height: CAPSULE_HEIGHT,
      borderRadius: Radius.pill,
      padding: CAPSULE_PADDING,
      flexDirection: 'row',
      overflow: 'hidden',
      ...edge,
    },
    searchCircle: {
      width: CAPSULE_HEIGHT,
      height: CAPSULE_HEIGHT,
      borderRadius: Radius.pill,
      overflow: 'hidden',
      ...edge,
    },
    tab: {
      flex: 1,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    tabActive: {
      backgroundColor: withAlpha(c.ink, 0.1),
    },
    // Glass buttons swell slightly under the finger, as on iOS 26.
    tabPressed: {
      transform: [{ scale: 1.06 }],
    },
    // Inside the capsule's padding, so the highlight's 50% is exactly one tab.
    tabsRow: {
      flex: 1,
      flexDirection: 'row',
    },
    highlight: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: `${100 / CAPSULE_TABS}%`,
      borderRadius: Radius.pill,
      backgroundColor: withAlpha(c.ink, 0.1),
    },
    tabLabel: {
      fontFamily: Fonts.heading,
      fontSize: Type.micro.fontSize,
      lineHeight: Type.micro.lineHeight,
    },
  });
}

function NavTab({
  label,
  icon: Icon,
  active,
  onPress,
  showLabel = true,
  ownHighlight = false,
  styles,
  c,
}: Readonly<{
  label: string;
  icon: IconComponent;
  active: boolean;
  onPress: () => void;
  showLabel?: boolean;
  /** Paint its own active fill; capsule tabs share the sliding highlight instead. */
  ownHighlight?: boolean;
  styles: ReturnType<typeof makeStyles>;
  c: WheelyPalette;
}>) {
  const color = active ? c.ink : withAlpha(c.ink, 0.72);
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.tab,
        tabMotion,
        ownHighlight && active ? styles.tabActive : null,
        pressed ? styles.tabPressed : null,
      ]}
    >
      <PlatformIcon
        icon={Icon}
        size={TAB_ICON_SIZE}
        color={color}
        strokeWidth={active ? 2.5 : 2}
        // Filled like the iOS tab bar's SF `.fill` symbols.
        filled
      />
      {showLabel && <Text style={[styles.tabLabel, { color }]}>{label}</Text>}
    </HapticPressable>
  );
}

/** Floating bottom tab bar. Renders on web only; native uses NativeTabs. */
export function BottomNavBar() {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  if (Platform.OS !== 'web') return null;

  const tabSegment = segments.at(-1) ?? '';
  const isHome = pathname === '/' || tabSegment === '(home)';
  const isLocation = pathname.startsWith('/location') || tabSegment === 'location';
  const isSettings = pathname.startsWith('/settings') || tabSegment === 'settings';

  // Search lives in its own circle, so the capsule highlight hides while it's active.
  const capsuleIndex = isSettings ? 1 : 0;
  const highlightStyle = {
    transform: [{ translateX: `${capsuleIndex * 100}%` }],
    opacity: isHome || isSettings ? 1 : 0,
    transition: `transform 0.45s ${SLIDE_EASING}, opacity 0.2s ease`,
  } as ViewStyle;

  return (
    <View
      style={[styles.wrap, { paddingBottom: barBottomOffset(insets.bottom) }]}
      accessibilityRole="tablist"
    >
      <GlassChrome style={styles.capsule}>
        <View style={styles.tabsRow}>
          <View pointerEvents="none" style={[styles.highlight, highlightStyle]} />
          <NavTab
            label="Weather"
            icon={CloudSun}
            active={isHome}
            onPress={() => {
              if (!isHome) router.dismissTo('/');
            }}
            styles={styles}
            c={c}
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
          />
        </View>
      </GlassChrome>
      <GlassChrome style={styles.searchCircle}>
        <NavTab
          label="Search"
          icon={Search}
          active={isLocation}
          showLabel={false}
          ownHighlight
          onPress={() => {
            if (!isLocation) router.dismissTo('/location');
          }}
          styles={styles}
          c={c}
        />
      </GlassChrome>
    </View>
  );
}

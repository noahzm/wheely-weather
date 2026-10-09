import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from './icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBlack, Spacing, TRANSPARENT, Type } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import { contentColumnStyle, screenGutterStyle } from './content-column';
import { GlassChrome } from './glass-chrome';
import { HapticPressable, PlatformIcon } from './primitives';

const HEADER_SIDE = 36;
export const WEB_TITLE_CONTENT_SPACING = Spacing.three;
// The iOS navigation bar's height below the status bar.
const COMPACT_BAR_HEIGHT = 44;
// Scroll distance at which the large title has slid under the compact bar.
const COLLAPSE_OFFSET = 36;

/**
 * Tracks whether a screen's large title has scrolled away, so the compact
 * title bar can take over as iOS's collapsing navigation bar does. The page
 * scrolls as a document on web, so this listens to the window; state only
 * flips at the threshold, so scrolling doesn't re-render the screen.
 */
export function useWebTitleCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => {
      setCollapsed(globalThis.scrollY > COLLAPSE_OFFSET);
    };
    update();
    globalThis.addEventListener('scroll', update, { passive: true });
    return () => {
      globalThis.removeEventListener('scroll', update);
    };
  }, []);
  return collapsed;
}

/**
 * The collapsed navigation bar: a glass strip with a centered title that
 * fades in over the top of the window once the large title scrolls away.
 */
export function WebCompactTitleBar({
  title,
  visible,
}: Readonly<{
  title: string;
  visible: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  if (Platform.OS !== 'web') return null;
  return (
    <View
      pointerEvents="none"
      aria-hidden={!visible}
      style={[
        compactStyles.bar,
        { opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' } as ViewStyle,
      ]}
    >
      <GlassChrome
        style={[
          compactStyles.glass,
          { paddingTop: insets.top, borderBottomColor: withAlpha(c.ink, 0.12) },
        ]}
      >
        <View style={compactStyles.row}>
          <Text numberOfLines={1} style={[compactStyles.title, { color: c.ink }]}>
            {title}
          </Text>
        </View>
      </GlassChrome>
    </View>
  );
}

const compactStyles = StyleSheet.create({
  bar: {
    // Pinned to the window, which is what scrolls on web.
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  glass: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    height: COMPACT_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  title: {
    fontFamily: Fonts.city,
    fontWeight: FontWeightBlack,
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
  },
});

export function WebScreenTitle({ children }: Readonly<{ children: string }>) {
  const c = useWheelyColors();
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        color: c.ink,
        fontFamily: Fonts.city,
        fontWeight: FontWeightBlack,
        ...Type.subtitle,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}

function dismissScreen(router: ReturnType<typeof useRouter>) {
  // Always land on home: web renders one screen at a time, so there is no
  // stack to pop, and back() could return to another tab.
  router.navigate('/');
}

export function WebScreenHeader({
  title,
  variant = 'back',
  withScreenGutter = true,
}: Readonly<{
  title: ReactNode;
  variant?: 'back' | 'close' | 'title';
  withScreenGutter?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useWheelyColors();
  const isClose = variant === 'close';
  const isTitleOnly = variant === 'title';
  // minWidth 0 lets a long title shrink to its ellipsis instead of overflowing.
  const titleWrapStyle = {
    flex: 1,
    minWidth: 0,
    alignItems: isTitleOnly ? ('flex-start' as const) : ('center' as const),
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View
      style={{
        paddingTop: insets.top + Spacing.two,
        width: '100%',
        backgroundColor: TRANSPARENT,
        ...(withScreenGutter ? screenGutterStyle : {}),
      }}
    >
      <View
        style={[
          contentColumnStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'center',
            minHeight: HEADER_SIDE,
          },
        ]}
      >
        {!isTitleOnly && (
          <HapticPressable
            onPress={() => {
              dismissScreen(router);
            }}
            accessibilityRole="button"
            accessibilityLabel={isClose ? 'Close' : 'Back'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: HEADER_SIDE,
              height: HEADER_SIDE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isClose ? (
              <PlatformIcon icon={X} size={20} color={c.ink} strokeWidth={2.5} />
            ) : (
              <PlatformIcon icon={ChevronLeft} size={22} color={c.ink} strokeWidth={2.5} />
            )}
          </HapticPressable>
        )}
        <View style={titleWrapStyle}>{title}</View>
        {!isTitleOnly && <View style={{ width: HEADER_SIDE }} />}
      </View>
    </View>
  );
}

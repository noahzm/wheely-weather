import type { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBlack, Spacing, TRANSPARENT, Type } from '@/constants/theme';
import { contentColumnStyle, screenGutterStyle } from './content-column';
import { HapticPressable, PlatformIcon } from './primitives';

const HEADER_SIDE = 36;
export const WEB_TITLE_CONTENT_SPACING = Spacing.three;

export function webHeaderHeight(insetsTop: number) {
  return insetsTop + Spacing.two + HEADER_SIDE;
}

export function WebScreenTitle({ children }: Readonly<{ children: string }>) {
  const c = useWheelyColors();
  return (
    <Text
      numberOfLines={1}
      style={{
        color: c.ink,
        fontFamily: Fonts.city,
        // Web large-title analog: subtitle size with a tighter, header-like leading.
        fontSize: Type.subtitle.fontSize,
        lineHeight: 36,
        fontWeight: FontWeightBlack,
      }}
    >
      {children}
    </Text>
  );
}

function dismissScreen(router: ReturnType<typeof useRouter>) {
  // Always land on home: back() could return to another tab, and on the web
  // stack it can also strand duplicate screens (see bottom-nav-chrome).
  router.dismissTo('/');
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
  const titleWrapStyle = isTitleOnly
    ? { alignSelf: 'flex-start' as const, alignItems: 'flex-start' as const }
    : { flex: 1, alignItems: 'center' as const };

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

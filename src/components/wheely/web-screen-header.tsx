import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, TRANSPARENT } from '@/constants/theme';
import { contentColumnStyle, screenGutterStyle } from './content-column';
import { HapticPressable } from './primitives';

const HEADER_SIDE = 36;

export function webHeaderHeight(insetsTop: number) {
  return insetsTop + Spacing.two + HEADER_SIDE;
}

function dismissScreen(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export function WebScreenHeader({
  title,
  variant = 'back',
}: Readonly<{
  title: ReactNode;
  variant?: 'back' | 'close';
}>) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useWheelyColors();
  const isClose = variant === 'close';

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View
      style={{
        paddingTop: insets.top + Spacing.two,
        width: '100%',
        backgroundColor: TRANSPARENT,
        ...screenGutterStyle,
      }}
    >
      <View
        style={[
          contentColumnStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: HEADER_SIDE,
          },
        ]}
      >
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
            <X size={20} color={c.ink} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={22} color={c.ink} strokeWidth={2.5} />
          )}
        </HapticPressable>
        <View style={{ flex: 1, alignItems: 'center' }}>{title}</View>
        <View style={{ width: HEADER_SIDE }} />
      </View>
    </View>
  );
}

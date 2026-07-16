import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';

import { useColorSchemeName } from '@/hooks/use-theme';
import { WheelyTheme } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';

const WEB_GLASS_FILL = {
  light: withAlpha(WheelyTheme.light.paper, 0.72),
  dark: withAlpha(WheelyTheme.dark.paper, 0.72),
} as const;

const ANDROID_GLASS_FILL = {
  light: withAlpha(WheelyTheme.light.paper, 0.92),
  dark: withAlpha(WheelyTheme.dark.paper, 0.92),
} as const;

function useGlassChromeStyle(style?: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const scheme = useColorSchemeName();

  return useMemo((): StyleProp<ViewStyle> => {
    if (Platform.OS === 'web') {
      return StyleSheet.compose(style, {
        backgroundColor: WEB_GLASS_FILL[scheme],
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      } as ViewStyle);
    }

    if (Platform.OS === 'android') {
      return StyleSheet.compose(style, { backgroundColor: ANDROID_GLASS_FILL[scheme] });
    }

    return style;
  }, [scheme, style]);
}

export function GlassChrome({
  children,
  style,
}: Readonly<{
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}>) {
  const chromeStyle = useGlassChromeStyle(style);

  return (
    <GlassView glassEffectStyle="regular" style={chromeStyle}>
      {children}
    </GlassView>
  );
}

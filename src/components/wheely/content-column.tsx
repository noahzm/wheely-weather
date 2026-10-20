import { Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export const contentColumnStyle = {
  width: '100%' as const,
  maxWidth: MaxContentWidth,
};

/**
 * Web-only `position: 'fixed'`, for chrome pinned to the window (the document
 * scrolls on web, not a container). react-native-web supports it, but React
 * Native's style types only list `absolute`/`relative`/`static`, hence the cast.
 */
export const webFixedPosition = 'fixed' as unknown as 'absolute';

/** Single horizontal screen gutter shared by every tab screen. */
export const ScreenGutter = Spacing.three;

export const screenGutterStyle = {
  alignItems: 'center' as const,
  paddingHorizontal: ScreenGutter,
};

export function WebContentColumn({
  children,
  style,
  innerStyle,
}: Readonly<{
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}>) {
  if (Platform.OS !== 'web') {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <View style={[styles.gutter, style]}>
      <View style={[contentColumnStyle, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: {
    width: '100%',
    ...screenGutterStyle,
  },
});

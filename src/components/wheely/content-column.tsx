import { Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export const contentColumnStyle = {
  width: '100%' as const,
  maxWidth: MaxContentWidth,
};

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

import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Type } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const c = useWheelyColors();

  return (
    <Text
      style={[
        { color: c[themeColor ?? 'ink'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: c.link }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.body,
    ...Type.small,
    fontWeight: '400',
  },
  smallBold: {
    fontFamily: Fonts.heading,
    ...Type.small,
  },
  default: {
    fontFamily: Fonts.body,
    ...Type.body,
    fontWeight: '400',
  },
  title: {
    fontFamily: Fonts.display,
    ...Type.display,
  },
  subtitle: {
    fontFamily: Fonts.display,
    ...Type.subtitle,
  },
  link: {
    fontFamily: Fonts.body,
    ...Type.small,
    lineHeight: 30,
    fontWeight: '400',
  },
  linkPrimary: {
    fontFamily: Fonts.body,
    ...Type.small,
    lineHeight: 30,
    fontWeight: '400',
  },
  code: {
    fontFamily: Fonts.body,
    fontWeight: '400',
    ...Type.caption,
  },
});

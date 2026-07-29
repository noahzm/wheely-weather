import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontWeightBlack, Fonts, ThemeColor, Type } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'micro'
    | 'caption'
    | 'heading'
    | 'stat'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const c = useWheelyColors();

  return (
    <Text
      style={[
        { color: c[themeColor ?? 'ink'] },
        type === 'default' && styles.default,
        type === 'micro' && styles.micro,
        type === 'caption' && styles.caption,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'heading' && styles.heading,
        type === 'stat' && styles.stat,
        type === 'subtitle' && styles.subtitle,
        type === 'title' && styles.title,
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
  micro: {
    fontFamily: Fonts.body,
    ...Type.micro,
    fontWeight: '400',
  },
  caption: {
    fontFamily: Fonts.body,
    ...Type.caption,
    fontWeight: '400',
  },
  small: {
    fontFamily: Fonts.body,
    ...Type.small,
    fontWeight: '400',
  },
  smallBold: {
    fontFamily: Fonts.bold,
    ...Type.small,
    fontWeight: FontWeightBlack,
  },
  default: {
    fontFamily: Fonts.body,
    ...Type.body,
    fontWeight: '400',
  },
  heading: {
    fontFamily: Fonts.bold,
    ...Type.heading,
    fontWeight: FontWeightBlack,
  },
  stat: {
    fontFamily: Fonts.bold,
    ...Type.stat,
    fontWeight: FontWeightBlack,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    ...Type.subtitle,
    fontWeight: FontWeightBlack,
  },
  title: {
    fontFamily: Fonts.bold,
    ...Type.display,
    fontWeight: FontWeightBlack,
  },
  link: {
    fontFamily: Fonts.body,
    ...Type.small,
    fontWeight: '400',
  },
  linkPrimary: {
    fontFamily: Fonts.body,
    ...Type.small,
    fontWeight: '400',
  },
  code: {
    fontFamily: Fonts.body,
    fontWeight: '400',
    ...Type.caption,
  },
});

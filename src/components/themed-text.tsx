import { StyleSheet, Text, type TextProps } from 'react-native';

import {
  FontWeightBold,
  Fonts,
  ThemeColor,
  Type,
  FontWeightSemibold,
  TabularNumbers,
} from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallSemibold'
    | 'micro'
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
        type === 'small' && styles.small,
        type === 'smallSemibold' && styles.smallSemibold,
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
  small: {
    fontFamily: Fonts.body,
    ...Type.small,
    fontWeight: '400',
  },
  smallSemibold: {
    fontFamily: Fonts.bold,
    ...Type.small,
    fontWeight: FontWeightSemibold,
  },
  default: {
    fontFamily: Fonts.body,
    ...Type.body,
    fontWeight: '400',
  },
  heading: {
    fontFamily: Fonts.bold,
    ...Type.heading,
    fontWeight: FontWeightBold,
  },
  stat: {
    fontFamily: Fonts.bold,
    ...Type.stat,
    fontWeight: FontWeightSemibold,
    ...TabularNumbers,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    ...Type.subtitle,
    fontWeight: FontWeightBold,
  },
  title: {
    fontFamily: Fonts.bold,
    ...Type.display,
    fontWeight: FontWeightBold,
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
    ...Type.micro,
  },
});

import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

const LINK_BLUE = '#3c87f7';

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
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  smallBold: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  default: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 44,
    fontWeight: '700',
  },
  link: {
    fontFamily: Fonts.sans,
    lineHeight: 30,
    fontSize: 14,
    fontWeight: '400',
  },
  linkPrimary: {
    fontFamily: Fonts.sans,
    lineHeight: 30,
    fontSize: 14,
    fontWeight: '400',
    color: LINK_BLUE,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: '400',
    fontSize: 12,
  },
});

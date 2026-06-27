import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const c = useWheelyColors();

  return <View style={[{ backgroundColor: c[type ?? 'background'] }, style]} {...otherProps} />;
}

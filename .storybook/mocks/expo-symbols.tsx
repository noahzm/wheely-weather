import { Text, type TextStyle } from 'react-native';

type SymbolViewProps = {
  name?: string | Record<string, string>;
  size?: number;
  tintColor?: string;
  style?: TextStyle;
};

function symbolName(name: SymbolViewProps['name']) {
  if (typeof name === 'string') return name;
  return name?.web ?? name?.ios ?? name?.android ?? 'symbol';
}

export function SymbolView({ name, size = 16, tintColor, style }: SymbolViewProps) {
  return (
    <Text
      accessibilityLabel={symbolName(name)}
      style={[
        {
          color: tintColor,
          fontSize: size,
          lineHeight: size,
          fontWeight: '700',
        },
        style,
      ]}>
      ›
    </Text>
  );
}


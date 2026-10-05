import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import {
  CloudRain,
  Snowflake,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
  type IconComponent,
} from './icons';
import { KIT_ICON_PATHS } from './kit-icon-paths';
import { resolveKitIcon, type KitWeatherKey } from './kit-icon-keys';

interface KitGearIconProps {
  iconKey: string;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/** Weather tips: the app's icon set on web and Android, the matching SF Symbol on iOS. */
const WEATHER_GLYPHS: Record<KitWeatherKey, { icon: IconComponent; sf: SFSymbol }> = {
  Sun: { icon: Sun, sf: 'sun.max.fill' },
  CloudRain: { icon: CloudRain, sf: 'cloud.rain.fill' },
  Umbrella: { icon: Umbrella, sf: 'umbrella.fill' },
  Wind: { icon: Wind, sf: 'wind' },
  Thermometer: { icon: Thermometer, sf: 'thermometer.medium' },
  Snowflake: { icon: Snowflake, sf: 'snowflake' },
};

/**
 * Renders a kit tip's icon. Clothing uses the app's own SF-style kit glyphs on
 * every platform (Apple has symbols for only a few of these items, and mixing
 * the two in one grid looked patchy); weather tips use weather icons.
 */
export function KitGearIcon({ iconKey, size, color, style }: Readonly<KitGearIconProps>) {
  const resolved = resolveKitIcon(iconKey);
  if (resolved.kind === 'weather') {
    const { icon: WeatherIcon, sf } = WEATHER_GLYPHS[resolved.key];
    return Platform.OS === 'ios' ? (
      <SymbolView name={sf} size={size} tintColor={color} style={style} />
    ) : (
      <WeatherIcon size={size} color={color} fill={color} style={style} />
    );
  }
  const name = resolved.kind === 'kit' ? resolved.name : 'Shirt';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path d={KIT_ICON_PATHS[name]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

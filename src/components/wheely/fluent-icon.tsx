import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FLUENT_ICON_PATHS, type FluentIconName } from './fluent-icon-paths';

export interface IconProps {
  size?: number;
  color?: string;
  /**
   * A color draws the filled variant (the SF `.fill` look); omitted or "none"
   * draws the regular one. Kept as `fill` so call sites read like SVG.
   */
  fill?: string;
  /** Accepted for call-site compatibility; Fluent glyphs are solid shapes. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export type IconComponent = (props: IconProps) => ReactElement;

/**
 * Builds an icon component from Fluent UI System Icons, the web/Android
 * stand-in for SF Symbols (iOS draws SF Symbols natively; Apple's license
 * keeps them off other platforms). Fluent's squarer shapes and paired
 * regular/filled variants sit closer to SF than round-stroked sets.
 */
export function fluentIcon(name: FluentIconName): IconComponent {
  const { regular, filled } = FLUENT_ICON_PATHS[name];
  function FluentIcon({ size = 24, color = 'currentColor', fill, style }: Readonly<IconProps>) {
    const solid = fill != null && fill !== 'none' && fill !== 'transparent';
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path d={solid ? filled : regular} fill={color} />
      </Svg>
    );
  }
  FluentIcon.displayName = `FluentIcon(${name})`;
  return FluentIcon;
}

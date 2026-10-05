import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import {
  BOOTSTRAP_ICON_PATHS,
  type BootstrapIconName,
  type BootstrapPath,
} from './bootstrap-icon-paths';

interface IconProps {
  size?: number;
  color?: string;
  /**
   * A color draws the filled variant (the SF `.fill` look); omitted or "none"
   * draws the outline one. Kept as `fill` so call sites read like SVG.
   */
  fill?: string;
  /** Accepted for call-site compatibility; Bootstrap glyphs are solid shapes. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export type IconComponent = (props: IconProps) => ReactElement;

/** Bootstrap's cursor points up-left; SF's location arrow points up-right. */
const MIRRORED: ReadonlySet<BootstrapIconName> = new Set(['Navigation']);

/**
 * Builds an icon component from Bootstrap Icons, the web/Android stand-in for
 * SF Symbols (iOS draws SF Symbols natively; Apple's license keeps them off
 * other platforms). Of the free sets, its shapes and crisp corners sit
 * closest to SF, with paired outline/filled variants.
 */
export function bootstrapIcon(name: BootstrapIconName): IconComponent {
  const { regular, filled } = BOOTSTRAP_ICON_PATHS[name];
  const transform = MIRRORED.has(name) ? 'translate(16 0) scale(-1 1)' : undefined;
  function BootstrapIcon({ size = 24, color = 'currentColor', fill, style }: Readonly<IconProps>) {
    const solid = fill != null && fill !== 'none' && fill !== 'transparent';
    const paths: readonly BootstrapPath[] = solid && filled ? filled : regular;
    return (
      <Svg width={size} height={size} viewBox="0 0 16 16" style={style}>
        <G transform={transform}>
          {paths.map(({ d, evenOdd }) => (
            <Path key={d} d={d} fill={color} fillRule={evenOdd ? 'evenodd' : undefined} />
          ))}
        </G>
      </Svg>
    );
  }
  BootstrapIcon.displayName = `BootstrapIcon(${name})`;
  return BootstrapIcon;
}

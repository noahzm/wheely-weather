import type { ComponentType } from 'react';
import Svg, { Path } from 'react-native-svg';
import { CloudRain, Snowflake, Sun, Thermometer, Umbrella, Wind } from 'lucide-react-native';

export interface KitGearIconProps {
  iconKey: string;
  size: number;
  color: string;
  strokeWidth?: number;
  style?: object;
}

interface KitSvgProps {
  size: number;
  color: string;
  strokeWidth?: number;
  style?: object;
}

/** Solid filled cycling short-sleeve jersey. */
function ShirtIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </Svg>
  );
}

/** Solid filled cycling long-sleeve top. */
function LongSleeveShirtIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M8.5 2.5a3.5 3.5 0 0 0 7 0L18 3.5l4.5 10a1 1 0 0 1-.8 1.4l-2.5.5a1 1 0 0 1-1.1-.6L16 9v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9L5.9 14.8a1 1 0 0 1-1.1.6l-2.5-.5a1 1 0 0 1-.8-1.4L6 3.5l2.5-1z" />
    </Svg>
  );
}

/** Solid filled cycling jacket with subtle zipper split. */
function JacketIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 2.5h6l3.5 3 4 8.5a1 1 0 0 1-.8 1.4l-2.2.4a1 1 0 0 1-1.1-.6L16.5 9v10a2 2 0 0 1-2 2h-1.8v-18h-1.4v18H9.5a2 2 0 0 1-2-2V9l-1.9 6.2a1 1 0 0 1-1.1.6l-2.2-.4a1 1 0 0 1-.8-1.4l4-8.5L9 2.5z"
      />
    </Svg>
  );
}

/** Solid filled cycling wind vest / gilet with zipper split. */
function GiletIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 2.5h6l2 2c.7 1 1 2.5.7 4l-.9 1.5V19a2 2 0 0 1-2 2h-2v-18h-1.6v18h-2a2 2 0 0 1-2-2v-9l-.9-1.5c-.3-1.5 0-3 .7-4l2-2z"
      />
    </Svg>
  );
}

/** Solid filled cycling bib shorts. */
function BibShortsIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2.5h2.2v6.5H7V2.5zm7.8 0H17v6.5h-2.2V2.5zM5.5 9h13a.5.5 0 0 1 .5.5l-1 11a.5.5 0 0 1-.5.5H13a.5.5 0 0 1-.4-.3L12 16.5l-.6 4.2a.5.5 0 0 1-.4.3H6.5a.5.5 0 0 1-.5-.5l-1-11a.5.5 0 0 1 .5-.5z"
      />
    </Svg>
  );
}

/** Solid filled athletic shorts. */
function ShortsIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4.2a1 1 0 0 1-.9-.6L12 13l-1.9 3.4a1 1 0 0 1-.9.6H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** Solid filled cycling tights / long pants. */
function PantsIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M5 4h14a1 1 0 0 1 1 1v2l-2.5 14a1 1 0 0 1-1 .8h-2.5a1 1 0 0 1-1-.8L12 13l-1 8a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8L4 7V5a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** Solid filled arm / knee warmers. */
function ArmWarmersIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M5 4h5l-1.2 16H4.8L5 4zm9 0h5l.2 16h-4l-1.2-16z" />
    </Svg>
  );
}

/** Solid filled shoe covers. */
function ShoeCoversIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 2.5h5v5l3 4.5a2 2 0 0 1 .3 1V17a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3c0-2 1.5-3.5 3.5-4.5L11 7.5V2.5zm-3 14.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H8v1z"
      />
    </Svg>
  );
}

/** Solid filled wool cap / beanie. */
function WoolCapIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-7 11c0-4 3.1-7.5 7-7.5s7 3.5 7 7.5H5zm-.5 1.5A1.5 1.5 0 0 1 6 13h12a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-3.5z"
      />
    </Svg>
  );
}

/** Solid filled cycling glove. */
function GlovesIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M7 18V9a1.5 1.5 0 0 1 3 0v1h.5V7a1.5 1.5 0 0 1 3 0v3h.5V8a1.5 1.5 0 0 1 3 0v3h.5a1.5 1.5 0 0 1 3 0v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM4.5 15.5l2.5-1.5V17L5.5 18a1.5 1.5 0 0 1-1-2.5z" />
    </Svg>
  );
}

/** Solid filled sunscreen bottle with cutout sun emblem. */
function SunscreenIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 2h6v2.5H9V2zM7 4.5h10a2 2 0 0 1 2 2v11.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6.5a2 2 0 0 1 2-2zm5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
      />
    </Svg>
  );
}

/** Solid filled sunglasses. */
function GlassesIcon({ size, color, style }: Readonly<KitSvgProps>) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path d="M2 10.5C2 8.5 3.5 7 5.5 7h1.6c1.5 0 2.8.9 3.4 2.2.4.8 1.2 1.3 2.1 1.3s1.7-.5 2.1-1.3C15.3 7.9 16.6 7 18.1 7h.4c2 0 3.5 1.5 3.5 3.5v1c0 3-2.5 5.5-5.5 5.5s-5-2-5.5-4.5c-.5 2.5-2.5 4.5-5.5 4.5S2 14.5 2 11.5v-1z" />
    </Svg>
  );
}

const ICON_COMPONENT_MAP: Record<string, ComponentType<KitSvgProps>> = {
  Shirt: ShirtIcon,
  LongSleeveShirt: LongSleeveShirtIcon,
  Jacket: JacketIcon,
  Gilet: GiletIcon,
  Layers: GiletIcon,
  BibShorts: BibShortsIcon,
  CasualShorts: ShortsIcon,
  Shorts: ShortsIcon,
  Pants: PantsIcon,
  ArmWarmers: ArmWarmersIcon,
  ShoeCovers: ShoeCoversIcon,
  Footprints: ShoeCoversIcon,
  WoolCap: WoolCapIcon,
  Hand: GlovesIcon,
  Sunscreen: SunscreenIcon,
  Glasses: GlassesIcon,
  Sun,
  CloudRain,
  Umbrella,
  Wind,
  Thermometer,
  Snowflake,
};

/**
 * Calculates an optical stroke width scaling so on-screen line thickness
 * stays crisp and consistent (~1.8-2.0px) across different icon sizes.
 */
function getOpticalStrokeWidth(size: number, explicitStrokeWidth?: number): number {
  if (explicitStrokeWidth !== undefined) {
    return explicitStrokeWidth;
  }
  const targetOnScreen = 2;
  const computed = (targetOnScreen * 24) / size;
  return Math.max(1.2, Math.min(2, Number(computed.toFixed(2))));
}

/**
 * Renders a 24x24 stroke-based icon matching the Lucide design language for clothing and kit tips.
 */
export function KitGearIcon({
  iconKey,
  size,
  color,
  strokeWidth,
  style,
}: Readonly<KitGearIconProps>) {
  const IconComponent = ICON_COMPONENT_MAP[iconKey] ?? ShirtIcon;
  const resolvedStrokeWidth = getOpticalStrokeWidth(size, strokeWidth);
  return (
    <IconComponent size={size} color={color} strokeWidth={resolvedStrokeWidth} style={style} />
  );
}

/** Backward-compatible alias for KitGearIcon. */
export const GameGearIcon = KitGearIcon;

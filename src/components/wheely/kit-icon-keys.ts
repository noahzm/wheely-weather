import { KIT_ICON_PATHS, type KitIconName } from './kit-icon-paths';

/** Weather tips in the kit guide, drawn with the app's weather icons rather than kit glyphs. */
export type KitWeatherKey = 'Sun' | 'CloudRain' | 'Umbrella' | 'Wind' | 'Thermometer' | 'Snowflake';

const WEATHER_KEYS: ReadonlySet<string> = new Set<KitWeatherKey>([
  'Sun',
  'CloudRain',
  'Umbrella',
  'Wind',
  'Thermometer',
  'Snowflake',
]);

/** Gear-tip keys that share another item's drawing. */
const KIT_ALIASES: Readonly<Partial<Record<string, KitIconName>>> = {
  Layers: 'Gilet',
  Shorts: 'CasualShorts',
  Footprints: 'ShoeCovers',
};

export type ResolvedKitIcon =
  | { kind: 'kit'; name: KitIconName }
  | { kind: 'weather'; key: KitWeatherKey }
  | { kind: 'unknown' };

function isKitIconName(key: string): key is KitIconName {
  return Object.hasOwn(KIT_ICON_PATHS, key);
}

function isWeatherKey(key: string): key is KitWeatherKey {
  return WEATHER_KEYS.has(key);
}

/** Maps a gear tip's `icon` key to the glyph that draws it. */
export function resolveKitIcon(iconKey: string): ResolvedKitIcon {
  if (isWeatherKey(iconKey)) return { kind: 'weather', key: iconKey };
  if (isKitIconName(iconKey)) return { kind: 'kit', name: iconKey };
  const alias = Object.hasOwn(KIT_ALIASES, iconKey) ? KIT_ALIASES[iconKey] : undefined;
  return alias ? { kind: 'kit', name: alias } : { kind: 'unknown' };
}

import { useId, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, Pattern, Rect } from 'react-native-svg';

import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';

// Metro resolves image requires to a numeric asset id; the web path re-resolves
// it to a URL via AssetRegistry in getWebTartanTileUrl.
const TARTAN_TILE = require('@/assets/images/tartan-bg.jpg') as number;

/** Display size of one tartan repeat (source image is 750×750). */
const TARTAN_TILE_SIZE = 150;

const SCRIM = {
  dark: 'rgba(0, 0, 0, 0.12)',
  light: 'rgba(255, 255, 255, 0.28)',
} as const;

interface TartanBackgroundProps {
  children: ReactNode;
}

function getWebTartanTileUrl(): string {
  const asset = TARTAN_TILE as unknown;

  if (typeof asset === 'string') return asset;

  if (typeof asset === 'object' && asset !== null) {
    const record = asset as { uri?: string; default?: string | { uri?: string } };
    if (typeof record.uri === 'string') return record.uri;
    if (typeof record.default === 'string') return record.default;
    if (
      record.default &&
      typeof record.default === 'object' &&
      typeof record.default.uri === 'string'
    ) {
      return record.default.uri;
    }
  }

  if (typeof asset === 'number') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAssetByID } = require('react-native-web/dist/modules/AssetRegistry') as {
      getAssetByID: (
        assetId: number,
      ) => { httpServerLocation: string; name: string; type: string; scales: number[] } | undefined;
    };
    const meta = getAssetByID(asset);
    if (meta) {
      const scale = meta.scales[0] ?? 1;
      const scaleSuffix = scale === 1 ? '' : `@${scale}x`;
      return `${meta.httpServerLocation}/${meta.name}${scaleSuffix}.${meta.type}`;
    }
  }

  throw new Error('Unable to resolve tartan tile URL on web');
}

function TartanTile({ scrimColor }: Readonly<{ scrimColor: string }>) {
  if (Platform.OS === 'web') {
    const tileUrl = getWebTartanTileUrl();

    return (
      <View
        style={[
          styles.tile,
          {
            backgroundImage: `url("${tileUrl}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: `${TARTAN_TILE_SIZE}px ${TARTAN_TILE_SIZE}px`,
          },
        ]}
      >
        <View style={[styles.scrim, { backgroundColor: scrimColor }]} />
      </View>
    );
  }

  return <NativeTartanTile scrimColor={scrimColor} />;
}

function NativeTartanTile({ scrimColor }: Readonly<{ scrimColor: string }>) {
  const patternId = useId().replaceAll(':', '');
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  return (
    <View
      style={styles.tile}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ width, height });
        }
      }}
    >
      {layout.width > 0 && layout.height > 0 ? (
        <Svg width={layout.width} height={layout.height}>
          <Defs>
            <Pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width={TARTAN_TILE_SIZE}
              height={TARTAN_TILE_SIZE}
            >
              <SvgImage href={TARTAN_TILE} width={TARTAN_TILE_SIZE} height={TARTAN_TILE_SIZE} />
            </Pattern>
          </Defs>
          <Rect width={layout.width} height={layout.height} fill={`url(#${patternId})`} />
        </Svg>
      ) : null}
      <View style={[styles.scrim, { backgroundColor: scrimColor }]} />
    </View>
  );
}

function TartanBackdropLayer({ scrimColor }: Readonly<{ scrimColor: string }>) {
  return null; // tartan temporarily disabled for testing
  return (
    <View style={[styles.backdrop, { pointerEvents: 'none' }]}>
      <TartanTile scrimColor={scrimColor} />
    </View>
  );
}

/**
 * Root-level tartan wrapper for web layout and Storybook. Does not set an opaque
 * theme base — use {@link ScreenBackdrop} on native screens instead.
 */
export function TartanBackground({ children }: Readonly<TartanBackgroundProps>) {
  const scheme = useColorSchemeName();
  const scrimColor = SCRIM[scheme];

  return (
    <View style={styles.root}>
      <TartanBackdropLayer scrimColor={scrimColor} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/**
 * Per-screen backdrop: opaque theme base for native stack compositing, with a
 * full-bleed fixed tartan tile behind transparent scroll content.
 */
export function ScreenBackdrop({ children }: Readonly<TartanBackgroundProps>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();
  const scrimColor = SCRIM[scheme];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <TartanBackdropLayer scrimColor={scrimColor} />
      <View style={styles.content} collapsable={false}>
        {children}
      </View>
    </View>
  );
}

/** Applies {@link ScreenBackdrop} on native; web relies on root {@link TartanBackground}. */
export function ScreenShell({ children }: Readonly<TartanBackgroundProps>) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }
  return <ScreenBackdrop>{children}</ScreenBackdrop>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  tile: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    flex: 1,
  },
});

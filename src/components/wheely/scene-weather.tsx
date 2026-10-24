import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { css, type CSSKeyframesRule } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { SceneColors } from '@/constants/theme';

import { DRIFT_IN, entrance, loop, SWAY, type Motion } from './scene-motion';

// The home scene's weather: clouds, and what falls from or drifts across them.

// ─── Clouds ──────────────────────────────────────────────────────────────────

/** A cloud's drawing box, and the point it is placed by (the middle of its body). */
const CLOUD_W = 200;
const CLOUD_H = 100;
const CLOUD_ANCHOR_X = 100;
const CLOUD_ANCHOR_Y = 60;
/**
 * A cumulus drawn as lobes [cx, cy, r], back row first: a tall crown and its
 * shoulders behind a lower front row, all on a flat base.
 */
const LOBES = [
  [100, 44, 34],
  [66, 52, 26],
  [136, 52, 24],
  [44, 68, 20],
  [82, 66, 22],
  [120, 66, 22],
  [158, 70, 18],
] as const;
const CLOUD_BASE = 'M42,60 H160 A14,14 0 0 1 160,88 H42 A14,14 0 0 1 42,60 Z';
/**
 * The whole silhouette as one path: the base and every lobe wound the same
 * way (clockwise), so where they overlap they fill rather than cancel.
 */
const CLOUD_BODY = [
  CLOUD_BASE,
  ...LOBES.map(
    ([cx, cy, r]) => `M${cx - r},${cy} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0 Z`,
  ),
].join(' ');
/** The airbrushed softness of a cloud's edge, in drawing units. */
const CLOUD_SOFTNESS = 1.8;

export interface CloudLook {
  fill: string;
  /** Where each lobe turns away from the light, which outlines the billows. */
  rim: string;
  /** The underside's tint. */
  shade: string;
  shadeOpacity: number;
}

export const FAIR_CLOUD: CloudLook = {
  fill: SceneColors.cloud,
  rim: SceneColors.cloudRim,
  shade: SceneColors.cloudShade,
  shadeOpacity: 0.9,
};
export const RAIN_CLOUD: CloudLook = {
  fill: SceneColors.rainCloud,
  rim: SceneColors.rainCloudRim,
  shade: SceneColors.rainCloudShade,
  shadeOpacity: 1,
};
export const STORM_CLOUD: CloudLook = {
  fill: SceneColors.stormCloud,
  rim: SceneColors.stormCloudRim,
  shade: SceneColors.stormCloudShade,
  shadeOpacity: 1,
};
export const SNOW_CLOUD: CloudLook = {
  fill: SceneColors.snowCloud,
  rim: SceneColors.snowCloudRim,
  shade: SceneColors.snowCloudShade,
  shadeOpacity: 0.85,
};

/**
 * A painted cumulus, shaded as one body rather than lobe by lobe (per-lobe
 * shading drew rings where the lobes overlap): the silhouette is lit from the
 * upper left and turns to a tinted rim at its far edges, darkens along its
 * underside, and is softened like airbrush.
 */
function CloudShape({ look, scale }: Readonly<{ look: CloudLook; scale: number }>) {
  const id = useId();
  return (
    <Svg width={CLOUD_W * scale} height={CLOUD_H * scale} viewBox={`0 0 ${CLOUD_W} ${CLOUD_H}`}>
      <Defs>
        <RadialGradient
          id={`${id}light`}
          gradientUnits="userSpaceOnUse"
          cx={78}
          cy={22}
          fx={78}
          fy={22}
          r={128}
        >
          <Stop offset={0} stopColor={look.fill} />
          <Stop offset={0.5} stopColor={look.fill} />
          <Stop offset={1} stopColor={look.rim} />
        </RadialGradient>
        <LinearGradient
          id={`${id}belly`}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={54}
          x2={0}
          y2={88}
        >
          <Stop offset={0} stopColor={look.shade} stopOpacity={0} />
          <Stop offset={1} stopColor={look.shade} stopOpacity={look.shadeOpacity} />
        </LinearGradient>
        <Filter id={`${id}soft`} x="-10%" y="-15%" width="120%" height="130%">
          <FeGaussianBlur stdDeviation={CLOUD_SOFTNESS} />
        </Filter>
      </Defs>
      <G filter={`url(#${id}soft)`}>
        <Path d={CLOUD_BODY} fillRule="nonzero" fill={`url(#${id}light)`} />
        <Path d={CLOUD_BODY} fillRule="nonzero" fill={`url(#${id}belly)`} />
      </G>
    </Svg>
  );
}

interface CloudProps {
  /** Where the cloud's anchor sits, in scene coordinates. */
  cx: number;
  cy: number;
  motion: Motion;
  scale?: number;
  look?: CloudLook;
  sway?: CSSKeyframesRule;
  swayMs?: number;
  enterDelay?: number;
  /** Drawn behind the cloud and carried along with it (rain, snow, lightning). */
  children?: ReactNode;
}

export function Cloud({
  cx,
  cy,
  motion,
  scale = 1,
  look = FAIR_CLOUD,
  sway = SWAY,
  swayMs = 11_000,
  enterDelay = 200,
  children,
}: Readonly<CloudProps>) {
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cx - CLOUD_ANCHOR_X * scale,
          top: cy - CLOUD_ANCHOR_Y * scale,
          width: CLOUD_W * scale,
          height: CLOUD_H * scale,
        },
        entrance(motion, DRIFT_IN, enterDelay),
      ]}
    >
      <Animated.View style={loop(motion, sway, { duration: swayMs, alternate: true })}>
        {children}
        <CloudShape look={look} scale={scale} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Rain and snow ───────────────────────────────────────────────────────────
// Each is a sheet of streaks or flakes scattered over a tile that scrolls down
// one tile per loop, drawn twice over so the loop has no seam. The cloud
// covers where it starts and the hills and card where it ends.

const FALL_W = 150;
const FALL_TILE = 132;
/** Where the sheet sits in a full-size cloud's box: up inside its belly, so it falls out of it. */
const FALL_LEFT = CLOUD_ANCHOR_X - FALL_W / 2;
const FALL_TOP = CLOUD_ANCHOR_Y + 12;
/** How far the streaks lean, sideways per point of fall. */
const RAIN_SLANT = 0.18;
/** Keeps leaning streaks and drifting flakes inside the sheet's edges. */
const FALL_MARGIN = 10;

const FALL_LOOP = css.keyframes({
  from: { transform: [{ translateY: -FALL_TILE }] },
  to: { transform: [{ translateY: 0 }] },
});
/** Snow's sideways wander as it falls. */
const FLURRY = css.keyframes({
  from: { transform: [{ translateX: -5 }] },
  to: { transform: [{ translateX: 5 }] },
});

interface FallLayer {
  count: number;
  /** Streak lengths for rain, flake radii for snow. */
  min: number;
  max: number;
  opacity: number;
  /** How long the sheet takes to fall one tile. */
  fallMs: number;
  seed: number;
}

/** Fine, faint, slow rain behind (all drizzle has); longer, brighter, faster rain in front. */
const FINE_RAIN: FallLayer = { count: 15, min: 16, max: 24, opacity: 0.7, fallMs: 1700, seed: 3 };
const HEAVY_RAIN: FallLayer = { count: 9, min: 30, max: 44, opacity: 1, fallMs: 1000, seed: 11 };
/**
 * Faint far flakes behind, brighter near ones in front. Each flake is a soft
 * airbrushed glow that fades out at its edge, so its radius runs large.
 */
const FAR_SNOW: FallLayer = { count: 26, min: 1.3, max: 2.1, opacity: 0.6, fallMs: 8000, seed: 5 };
const NEAR_SNOW: FallLayer = { count: 16, min: 2.1, max: 3.2, opacity: 1, fallMs: 5200, seed: 17 };

/** A small seeded generator, so the weather is scattered the same way every time. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function fixed(n: number): string {
  return n.toFixed(1);
}

/**
 * One rain streak: a hair-thin tail from (x, y) widening to a rounded head
 * `length` below, leaning left as it falls. The head's radius grows with it.
 */
function streakPath(x: number, y: number, length: number): string {
  const head = length > 28 ? 2 : 1.2;
  const hx = x - RAIN_SLANT * (length - head);
  const hy = y + length - head;
  return (
    `M${fixed(x)},${fixed(y)} L${fixed(hx + head)},${fixed(hy)}` +
    ` A${head},${head} 0 0 1 ${fixed(hx - head)},${fixed(hy)} Z`
  );
}

/** A streak or flake: where it sits on the sheet and its length or radius. */
interface Piece {
  x: number;
  y: number;
  size: number;
}

/**
 * A layer's streaks or flakes, spread evenly across the sheet with some jitter
 * so they neither clump nor line up, each placed a tile above and below too,
 * so the sheet repeats seamlessly as it scrolls.
 */
function scatter(layer: FallLayer): Piece[] {
  const random = seededRandom(layer.seed);
  const span = (FALL_W - 2 * FALL_MARGIN) / layer.count;
  const pieces: Piece[] = [];
  for (let i = 0; i < layer.count; i++) {
    const x = FALL_MARGIN + (i + 0.5 + (random() - 0.5) * 0.8) * span;
    const y = random() * FALL_TILE;
    const size = layer.min + random() * (layer.max - layer.min);
    for (const copy of [-FALL_TILE, 0, FALL_TILE]) {
      pieces.push({ x, y: y + copy + FALL_TILE, size });
    }
  }
  return pieces;
}

const RAIN_PATHS = new Map(
  [FINE_RAIN, HEAVY_RAIN].map((layer) => [
    layer,
    scatter(layer)
      .map((p) => streakPath(p.x + RAIN_SLANT * p.size, p.y, p.size))
      .join(' '),
  ]),
);
const FLAKES = new Map([FAR_SNOW, NEAR_SNOW].map((layer) => [layer, scatter(layer)]));

/** Each streak fades in along its tail, like rain caught on a slow shutter. */
function RainSheet({ layer, motion }: Readonly<{ layer: FallLayer; motion: Motion }>) {
  const id = useId();
  return (
    <Animated.View style={[styles.sheet, loop(motion, FALL_LOOP, { duration: layer.fallMs })]}>
      <Svg width={FALL_W} height={2 * FALL_TILE}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={SceneColors.rain} stopOpacity={0} />
            <Stop offset={0.45} stopColor={SceneColors.rain} stopOpacity={layer.opacity * 0.45} />
            <Stop offset={1} stopColor={SceneColors.rain} stopOpacity={layer.opacity} />
          </LinearGradient>
        </Defs>
        <Path d={RAIN_PATHS.get(layer)} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Soft flakes falling slowly and wandering side to side. */
function SnowSheet({ layer, motion }: Readonly<{ layer: FallLayer; motion: Motion }>) {
  const id = useId();
  return (
    <Animated.View style={[styles.sheet, loop(motion, FALL_LOOP, { duration: layer.fallMs })]}>
      <Animated.View
        style={loop(motion, FLURRY, { duration: layer.fallMs / 2.5, alternate: true })}
      >
        <Svg width={FALL_W} height={2 * FALL_TILE}>
          <Defs>
            <RadialGradient id={id}>
              <Stop offset={0} stopColor={SceneColors.snow} stopOpacity={layer.opacity} />
              <Stop offset={0.4} stopColor={SceneColors.snow} stopOpacity={layer.opacity * 0.7} />
              <Stop offset={1} stopColor={SceneColors.snow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {FLAKES.get(layer)?.map((flake) => (
            <Circle
              key={`${fixed(flake.x)},${fixed(flake.y)}`}
              cx={flake.x}
              cy={flake.y}
              r={flake.size}
              fill={`url(#${id})`}
            />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** The gray veil a rain cloud trails, darkest under its belly; fainter in drizzle. */
function RainShaft({ strength }: Readonly<{ strength: number }>) {
  const id = useId();
  return (
    <Svg width={FALL_W} height={FALL_TILE} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}veil`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor={SceneColors.rainCloudShade} stopOpacity={0.5 * strength} />
          <Stop offset={1} stopColor={SceneColors.rainCloudShade} stopOpacity={0} />
        </LinearGradient>
        <Filter id={`${id}soft`} x="-20%" y="-10%" width="140%" height="120%">
          <FeGaussianBlur stdDeviation={8} />
        </Filter>
      </Defs>
      <Path
        d={`M28,0 H${FALL_W - 28} L${FALL_W - 40},${FALL_TILE} H22 Z`}
        fill={`url(#${id}veil)`}
        filter={`url(#${id}soft)`}
      />
    </Svg>
  );
}

/** What falls from a cloud. Sleet is light rain mixed with snow. */
export type Precip = 'drizzle' | 'rain' | 'snow' | 'sleet';

function rainLayers(precip: Precip): FallLayer[] {
  if (precip === 'rain') return [FINE_RAIN, HEAVY_RAIN];
  if (precip === 'snow') return [];
  return [FINE_RAIN];
}

function snowLayers(precip: Precip): FallLayer[] {
  if (precip === 'snow') return [FAR_SNOW, NEAR_SNOW];
  if (precip === 'sleet') return [NEAR_SNOW];
  return [];
}

/** Rain, drizzle, snow or sleet falling out of a full-size cloud; laid inside the cloud's box. */
export function Precipitation({ precip, motion }: Readonly<{ precip: Precip; motion: Motion }>) {
  const rain = rainLayers(precip);
  return (
    <View style={styles.fall}>
      {rain.length > 0 && <RainShaft strength={rain.length / 2} />}
      {rain.map((layer) => (
        <RainSheet key={layer.seed} layer={layer} motion={motion} />
      ))}
      {snowLayers(precip).map((layer) => (
        <SnowSheet key={layer.seed} layer={layer} motion={motion} />
      ))}
    </View>
  );
}

// ─── Lightning ───────────────────────────────────────────────────────────────

/** How far the flash's glow spreads around the cloud's anchor. */
const FLASH_W = 360;
const FLASH_H = 240;

/**
 * Two quick flickers every few seconds, then dark: well under the three
 * flashes a second that can trigger seizures. It stays dark under Reduce
 * Motion.
 */
const FLASH = css.keyframes({
  '0%': { opacity: 0 },
  '84%': { opacity: 0 },
  '86%': { opacity: 0.9 },
  '89%': { opacity: 0.1 },
  '92%': { opacity: 0.75 },
  '100%': { opacity: 0 },
});

/**
 * Sheet lightning: a soft flash lighting the clouds from behind, the way a
 * storm's lightning mostly shows, rather than a drawn bolt. Laid inside a
 * full-size cloud's box, behind the cloud.
 */
export function Lightning({ motion }: Readonly<{ motion: Motion }>) {
  const id = useId();
  return (
    <Animated.View style={[styles.flash, loop(motion, FLASH, { duration: 6400 })]}>
      <Svg width={FLASH_W} height={FLASH_H}>
        <Defs>
          <RadialGradient id={id}>
            <Stop offset={0} stopColor={SceneColors.lightningGlow} stopOpacity={1} />
            <Stop offset={0.45} stopColor={SceneColors.lightningGlow} stopOpacity={0.55} />
            <Stop offset={1} stopColor={SceneColors.lightningGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={FLASH_W / 2}
          cy={FLASH_H / 2}
          rx={FLASH_W / 2}
          ry={FLASH_H / 2}
          fill={`url(#${id})`}
        />
      </Svg>
    </Animated.View>
  );
}

// ─── Fog ─────────────────────────────────────────────────────────────────────

/** Fog's slow drift, wider and slower than a cloud's sway. */
const FOG_DRIFT = css.keyframes({
  from: { transform: [{ translateX: -18 }] },
  to: { transform: [{ translateX: 18 }] },
});

/** A long band of mist centered on (cx, cy), feathered to nothing at its edges. */
export function FogBand({
  cx,
  cy,
  width,
  height,
  opacity,
  driftMs,
  motion,
}: Readonly<{
  cx: number;
  cy: number;
  width: number;
  height: number;
  opacity: number;
  driftMs: number;
  motion: Motion;
}>) {
  const id = useId();
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: cx - width / 2, top: cy - height / 2, width, height },
        entrance(motion, DRIFT_IN, 150),
      ]}
    >
      <Animated.View style={loop(motion, FOG_DRIFT, { duration: driftMs, alternate: true })}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id={id}>
              <Stop offset={0} stopColor={SceneColors.fog} stopOpacity={opacity} />
              <Stop offset={0.55} stopColor={SceneColors.fog} stopOpacity={opacity * 0.7} />
              <Stop offset={1} stopColor={SceneColors.fog} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={`url(#${id})`}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fall: {
    position: 'absolute',
    left: FALL_LEFT,
    top: FALL_TOP,
    width: FALL_W,
    height: FALL_TILE,
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Transparent until a flash, and so under Reduce Motion too.
  flash: {
    position: 'absolute',
    left: CLOUD_ANCHOR_X - FLASH_W / 2,
    top: CLOUD_ANCHOR_Y - FLASH_H / 2,
    width: FLASH_W,
    height: FLASH_H,
    opacity: 0,
  },
});

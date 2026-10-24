import { useId, type ReactNode } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import grainTexture from '@/assets/images/scene-grain.png';
import { SceneColors } from '@/constants/theme';
import type { Sky } from '@/domain/weather-codes';
import { useWheelyColors } from '@/hooks/use-theme';

import { entrance, GLOW, loop, PEEK, RISE, useSceneMotion, type Motion } from './scene-motion';
import {
  Cloud,
  FogBand,
  Lightning,
  Precipitation,
  RAIN_CLOUD,
  SNOW_CLOUD,
  STORM_CLOUD,
  type CloudLook,
  type Precip,
} from './scene-weather';

export type SceneKind = Sky;

/**
 * How far the scene reaches above the scroll content: behind the large title
 * and status bar, with sky to spare however far the page is pulled down.
 */
const ABOVE = 900;
/** How far below the content's top it reaches, room for the fade under a lowered card. */
const BELOW = 360;
const HEIGHT = ABOVE + BELOW;
/** The hills' valley, below the content top. */
const HORIZON = 34;
/** The valley in scene coordinates; the sky's pieces are placed up from it. */
const SKY_LINE = ABOVE + HORIZON;
/** How high above the horizon the sky's gradient starts from its top color. */
const SKY_DEPTH = 240;
/** How strongly the film grain shows over the scene. */
const GRAIN_OPACITY = 0.32;

/** A square box of side `size` centered on (cx, cy) in scene coordinates. */
function boxAt(cx: number, cy: number, size: number) {
  return {
    position: 'absolute' as const,
    left: cx - size / 2,
    top: cy - size / 2,
    width: size,
    height: size,
  };
}

// ─── Sun ─────────────────────────────────────────────────────────────────────

/** How far the glow reaches, in sun radii. */
const GLOW_REACH = 3;

/** An airbrushed sun: a hot orb lit from its upper left, in a soft glow that breathes. */
function Sun({
  cx,
  cy,
  r,
  motion,
  glow = 1,
}: Readonly<{ cx: number; cy: number; r: number; motion: Motion; glow?: number }>) {
  const id = useId();
  const reach = r * GLOW_REACH;
  const size = 2 * reach;
  return (
    <Animated.View style={[boxAt(cx, cy, size), entrance(motion, RISE)]}>
      <View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, loop(motion, GLOW, { duration: 4200, alternate: true })]}
        >
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={`${id}glow`}>
                <Stop offset={0} stopColor={SceneColors.sunGlowCore} stopOpacity={0.95} />
                <Stop offset={0.38} stopColor={SceneColors.sunGlow} stopOpacity={0.5} />
                <Stop offset={1} stopColor={SceneColors.sunGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={reach} cy={reach} r={reach} fill={`url(#${id}glow)`} />
          </Svg>
        </Animated.View>
      </View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}orb`} cx="40%" cy="36%" fx="40%" fy="36%" r="70%">
            <Stop offset={0} stopColor={SceneColors.sunCore} />
            <Stop offset={0.35} stopColor={SceneColors.sun} />
            <Stop offset={1} stopColor={SceneColors.sunEdge} />
          </RadialGradient>
        </Defs>
        <Circle cx={reach} cy={reach} r={r} fill={`url(#${id}orb)`} />
      </Svg>
    </Animated.View>
  );
}

// ─── Scenes ──────────────────────────────────────────────────────────────────
// The sun sits beside the city name, clear of the star tag on the card below.
// Each scene also hides a cloud up high that only shows when the page is
// pulled down.

/** Clear skies: the sun out among a few fair clouds. */
function ClearSky({ width, motion }: Readonly<{ width: number; motion: Motion }>) {
  return (
    <>
      <Cloud cx={width * 0.72} cy={SKY_LINE - 280} scale={0.6} motion={motion} swayMs={15_000} />
      <Cloud cx={width * 0.26} cy={SKY_LINE - 158} scale={0.85} motion={motion} />
      <Sun cx={width - 80} cy={SKY_LINE - 84} r={38} motion={motion} />
      <Cloud
        cx={width * 0.7}
        cy={SKY_LINE - 38}
        scale={0.55}
        motion={motion}
        swayMs={9000}
        enterDelay={350}
      />
    </>
  );
}

/** Partly cloudy: the sun half hidden behind a cloud that drifts off it and back. */
function PartlySky({ width, motion }: Readonly<{ width: number; motion: Motion }>) {
  const sunX = width - 74;
  const sunY = SKY_LINE - 96;
  return (
    <>
      <Cloud cx={width * 0.72} cy={SKY_LINE - 280} scale={0.6} motion={motion} swayMs={15_000} />
      <Cloud cx={width * 0.24} cy={SKY_LINE - 160} scale={0.85} motion={motion} />
      <Sun cx={sunX} cy={sunY} r={36} motion={motion} glow={0.8} />
      <Cloud
        cx={sunX - 48}
        cy={sunY + 34}
        sway={PEEK}
        swayMs={7000}
        motion={motion}
        enterDelay={350}
      />
    </>
  );
}

/** Fog: mist drifting across the sky in long bands, the sun a pale disc behind it. */
function FogSky({ width, motion }: Readonly<{ width: number; motion: Motion }>) {
  return (
    <>
      <View style={styles.dimSun}>
        <Sun cx={width - 84} cy={SKY_LINE - 110} r={32} motion={motion} glow={0.5} />
      </View>
      <FogBand
        cx={width * 0.45}
        cy={SKY_LINE - 250}
        width={width * 1.3}
        height={70}
        opacity={0.7}
        driftMs={17_000}
        motion={motion}
      />
      <FogBand
        cx={width * 0.6}
        cy={SKY_LINE - 160}
        width={width * 1.2}
        height={80}
        opacity={0.85}
        driftMs={14_000}
        motion={motion}
      />
      <FogBand
        cx={width * 0.4}
        cy={SKY_LINE - 70}
        width={width * 1.4}
        height={90}
        opacity={0.9}
        driftMs={12_000}
        motion={motion}
      />
      <FogBand
        cx={width * 0.55}
        cy={SKY_LINE - 4}
        width={width * 1.5}
        height={70}
        opacity={1}
        driftMs={15_000}
        motion={motion}
      />
    </>
  );
}

/**
 * Overcast, rain, storms and snow: a bank of `look` clouds with a heavier one
 * where the sun would be, which lets fall `precip` and strikes `lightning`.
 */
function GraySky({
  width,
  motion,
  look,
  precip,
  lightning = false,
}: Readonly<{
  width: number;
  motion: Motion;
  look: CloudLook;
  precip?: Precip;
  lightning?: boolean;
}>) {
  return (
    <>
      <Cloud
        cx={width * 0.72}
        cy={SKY_LINE - 280}
        scale={0.6}
        look={look}
        motion={motion}
        swayMs={15_000}
      />
      <Cloud
        cx={width * 0.2}
        cy={SKY_LINE - 156}
        scale={1.1}
        look={look}
        motion={motion}
        swayMs={13_000}
      />
      <Cloud
        cx={width * 0.58}
        cy={SKY_LINE - 178}
        scale={0.8}
        look={look}
        motion={motion}
        swayMs={12_000}
        enterDelay={100}
      />
      <Cloud
        cx={width - 96}
        cy={SKY_LINE - 116}
        look={look}
        motion={motion}
        swayMs={9000}
        enterDelay={0}
      >
        {lightning && <Lightning motion={motion} />}
        {precip != null && <Precipitation precip={precip} motion={motion} />}
      </Cloud>
    </>
  );
}

function SceneSky({
  kind,
  width,
  motion,
}: Readonly<{ kind: SceneKind; width: number; motion: Motion }>) {
  switch (kind) {
    case 'clear': {
      return <ClearSky width={width} motion={motion} />;
    }
    case 'partly': {
      return <PartlySky width={width} motion={motion} />;
    }
    case 'fog': {
      return <FogSky width={width} motion={motion} />;
    }
    case 'overcast': {
      return <GraySky width={width} motion={motion} look={RAIN_CLOUD} />;
    }
    case 'drizzle':
    case 'rain': {
      return <GraySky width={width} motion={motion} look={RAIN_CLOUD} precip={kind} />;
    }
    case 'storm': {
      return <GraySky width={width} motion={motion} look={STORM_CLOUD} precip="rain" lightning />;
    }
    case 'snow':
    case 'sleet': {
      return <GraySky width={width} motion={motion} look={SNOW_CLOUD} precip={kind} />;
    }
  }
}

// ─── Sky, hills and grain ────────────────────────────────────────────────────

interface Palette {
  skyTop: string;
  sky: string;
  skyHorizon: string;
  hillsTop: string;
  hillsBottom: string;
}

const FAIR_PALETTE: Palette = {
  skyTop: SceneColors.skyTop,
  sky: SceneColors.sky,
  skyHorizon: SceneColors.skyHorizon,
  hillsTop: SceneColors.hillsTop,
  hillsBottom: SceneColors.hillsBottom,
};
const WET_PALETTE: Palette = {
  skyTop: SceneColors.rainSkyTop,
  sky: SceneColors.rainSky,
  skyHorizon: SceneColors.rainSkyHorizon,
  hillsTop: SceneColors.wetHillsTop,
  hillsBottom: SceneColors.wetHillsBottom,
};
const FOG_PALETTE: Palette = {
  skyTop: SceneColors.fogSkyTop,
  sky: SceneColors.fogSky,
  skyHorizon: SceneColors.fogSkyHorizon,
  hillsTop: SceneColors.fogHillsTop,
  hillsBottom: SceneColors.fogHillsBottom,
};
const STORM_PALETTE: Palette = {
  skyTop: SceneColors.stormSkyTop,
  sky: SceneColors.stormSky,
  skyHorizon: SceneColors.stormSkyHorizon,
  hillsTop: SceneColors.wetHillsTop,
  hillsBottom: SceneColors.wetHillsBottom,
};
const SNOW_PALETTE: Palette = {
  skyTop: SceneColors.snowSkyTop,
  sky: SceneColors.snowSky,
  skyHorizon: SceneColors.snowSkyHorizon,
  hillsTop: SceneColors.snowHillsTop,
  hillsBottom: SceneColors.snowHillsBottom,
};

/** Each sky's colors, daylight in both color schemes: see SceneColors. */
const PALETTES: Readonly<Record<SceneKind, Palette>> = {
  clear: FAIR_PALETTE,
  partly: FAIR_PALETTE,
  overcast: WET_PALETTE,
  fog: FOG_PALETTE,
  drizzle: WET_PALETTE,
  rain: WET_PALETTE,
  storm: STORM_PALETTE,
  snow: SNOW_PALETTE,
  sleet: SNOW_PALETTE,
};

/** The sky, airbrushed from overhead down to a pale glow at the horizon. */
function SkyGradient({ width, palette }: Readonly<{ width: number; palette: Palette }>) {
  const id = useId();
  return (
    <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={SKY_LINE - SKY_DEPTH}
          x2={0}
          y2={SKY_LINE}
        >
          <Stop offset={0} stopColor={palette.skyTop} />
          <Stop offset={0.5} stopColor={palette.sky} />
          <Stop offset={1} stopColor={palette.skyHorizon} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={HEIGHT} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Where the ground layers draw the top of the verdict card's block; they are
 * then moved down to wherever the card actually sits.
 */
const GROUND = ABOVE;

/** A height in the ground layers, `dy` below the card's top (negative is above it). */
function belowCardTop(dy: number): number {
  return GROUND + dy;
}

/**
 * Low rolling hills, lit along their tops and darkening downhill. They crest
 * just above the verdict card, under whatever sits above it, and roll on
 * beneath it.
 */
function Hills({ width, palette }: Readonly<{ width: number; palette: Palette }>) {
  const id = useId();
  const w = width;
  const y = belowCardTop;
  const hills =
    `M0,${y(-2)} C${0.174 * w},${y(-16)} ${0.348 * w},${y(-12)} ${0.5 * w},${y(4)}` +
    ` C${0.652 * w},${y(-12)} ${0.826 * w},${y(-16)} ${w},${y(-4)} V${HEIGHT} H0 Z`;
  return (
    <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={y(-16)}
          x2={0}
          y2={y(140)}
        >
          <Stop offset={0} stopColor={palette.hillsTop} />
          <Stop offset={1} stopColor={palette.hillsBottom} />
        </LinearGradient>
      </Defs>
      <Path d={hills} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Fades the scene into the page below the card's top. */
function PageFade({ width }: Readonly<{ width: number }>) {
  const c = useWheelyColors();
  const id = useId();
  return (
    <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={belowCardTop(24) / HEIGHT} stopColor={c.background} stopOpacity={0} />
          <Stop offset={belowCardTop(176) / HEIGHT} stopColor={c.background} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={HEIGHT} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Moves the ground layers (drawn with the card's top at GROUND) down to the
 * card, easing there when something above the card comes or goes.
 */
function Ground({
  shift,
  motion,
  children,
}: Readonly<{ shift: number; motion: Motion; children: ReactNode }>) {
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ translateY: shift }] },
        motion != null && styles.groundEase,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A painted landscape behind the top of the home screen, after old cel
 * backgrounds: an airbrushed sky behind the city name that follows the
 * weather (sun, cloud, fog, rain, storm or snow) and rolling hills under the
 * verdict card, all under film grain and fading into the page below. The sun
 * rises and the clouds drift in as it appears, then the glow breathes, clouds
 * sway, fog drifts, rain and snow fall and lightning flickers, all held
 * still under Reduce Motion. Decorative only; it sits behind the content and
 * takes no touches.
 */
export function HomeBackdrop({
  kind,
  offset = 0,
  groundTop,
}: Readonly<{
  kind: SceneKind;
  /**
   * How much lower the content column starts than on native, where the city
   * name sits in the large-title bar above the scroll content. The web page
   * draws its title inside the content, so the scene moves down under it.
   */
  offset?: number;
  /**
   * Where the verdict card's block starts in the scroll content, which the
   * hills crest just above; the scene waits until it is known.
   */
  groundTop: number | null;
}>) {
  const { width } = useWindowDimensions();
  const motion = useSceneMotion();
  const palette = PALETTES[kind];
  if (groundTop == null) return null;
  // The scene's top sits ABOVE over the content's (offset lower on web).
  const groundShift = groundTop - offset;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.backdrop, offset > 0 && { top: offset - ABOVE }]}
    >
      <SkyGradient width={width} palette={palette} />
      {/* Keyed so a change of weather brings its sky in fresh. */}
      <SceneSky key={kind} kind={kind} width={width} motion={motion} />
      <Ground shift={groundShift} motion={motion}>
        <Hills width={width} palette={palette} />
      </Ground>
      <Image source={grainTexture} resizeMode="repeat" style={styles.grain} />
      <Ground shift={groundShift} motion={motion}>
        <PageFade width={width} />
      </Ground>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -ABOVE,
    left: 0,
    right: 0,
    height: HEIGHT,
    // The sun's glow reaches past the screen edge; keep it from widening the page.
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  // Fog veils the sun, and the bands drift across it.
  dimSun: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
  },
  groundEase: {
    transitionProperty: 'transform',
    transitionDuration: 350,
    transitionTimingFunction: 'ease-out',
  },
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: GRAIN_OPACITY,
  },
});

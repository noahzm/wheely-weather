import SwiftUI

// The painted sky behind the widget: the home screen's backdrop
// (src/components/wheely/home-backdrop.tsx and scene-weather.tsx) held still
// and laid out for a widget. Airbrushed gradients, a glowing sun, one-body
// cumulus clouds, rolling hills and film grain, following the weather the
// verdict rates.

/// The home scene's sky (`Sky` in src/domain/weather-codes.ts).
enum SceneSky: String {
  case heat, clear, partly, overcast, fog, drizzle, rain, storm, snow, sleet

  /// The sky for a payload without one: the home screen's fallback by verdict.
  static func fallback(status: String) -> SceneSky {
    switch status {
    case "yes": return .clear
    case "maybe": return .partly
    default: return .rain
    }
  }
}

/// `SceneColors` in theme.ts.
private enum SceneColor {
  static let skyTop = Color(hex: 0xDE93E3)
  static let sky = Color(hex: 0xF1BDF2)
  static let skyHorizon = Color(hex: 0xFCE0EE)
  static let rainSkyTop = Color(hex: 0x7D7398)
  static let rainSky = Color(hex: 0x9A8FB5)
  static let rainSkyHorizon = Color(hex: 0xCBC3DA)
  static let heatSkyTop = Color(hex: 0xF3B1AD)
  static let heatSky = Color(hex: 0xF9CEB6)
  static let heatSkyHorizon = Color(hex: 0xFFF0C9)
  static let heatHillsTop = Color(hex: 0xA3A34D)
  static let heatHillsBottom = Color(hex: 0x6D7536)
  static let road = Color(hex: 0x34343E)
  static let roadMarking = Color(hex: 0xFFF8E3)
  static let wetRoad = Color(hex: 0x424653)
  static let roadReflection = Color(hex: 0xE4DFEF)
  static let sunCore = Color(hex: 0xFFFBE0)
  static let sun = Color(hex: 0xFFE14D)
  static let sunEdge = Color(hex: 0xFFB61C)
  static let sunGlowCore = Color(hex: 0xFFF8D2)
  static let sunGlow = Color(hex: 0xFFE68A)
  static let cloud = Color(hex: 0xFFFFFF)
  static let cloudRim = Color(hex: 0xF1E1F6)
  static let cloudShade = Color(hex: 0xDDBFEA)
  static let rainCloud = Color(hex: 0xE9E4F1)
  static let rainCloudRim = Color(hex: 0xC8BFDA)
  static let rainCloudShade = Color(hex: 0x8F84AD)
  static let rain = Color(hex: 0xF4FBFF)
  static let hillsTop = Color(hex: 0x4CC983)
  static let hillsBottom = Color(hex: 0x14773F)
  static let wetHillsTop = Color(hex: 0x6BA486)
  static let wetHillsBottom = Color(hex: 0x2C5B42)
  static let fogSkyTop = Color(hex: 0xB5ABC6)
  static let fogSky = Color(hex: 0xD1CADD)
  static let fogSkyHorizon = Color(hex: 0xEDE9F2)
  static let fog = Color(hex: 0xF7F4F9)
  static let fogHillsTop = Color(hex: 0x97C2A7)
  static let fogHillsBottom = Color(hex: 0x5F8C72)
  static let stormSkyTop = Color(hex: 0x5E567C)
  static let stormSky = Color(hex: 0x857BA2)
  static let stormSkyHorizon = Color(hex: 0xB8AFCC)
  static let stormCloud = Color(hex: 0xB7AFC9)
  static let stormCloudRim = Color(hex: 0x8A80A4)
  static let stormCloudShade = Color(hex: 0x4A4266)
  static let lightningGlow = Color(hex: 0xF2EEFF)
  static let snowSkyTop = Color(hex: 0x949EC6)
  static let snowSky = Color(hex: 0xB3BBDB)
  static let snowSkyHorizon = Color(hex: 0xDCE1F0)
  static let snowCloud = Color(hex: 0xF8F9FD)
  static let snowCloudRim = Color(hex: 0xD6DBEB)
  static let snowCloudShade = Color(hex: 0xA2AAC8)
  static let snow = Color(hex: 0xFFFFFF)
  static let snowHillsTop = Color(hex: 0xF4F6FB)
  static let snowHillsBottom = Color(hex: 0xB8C2DA)
}

/// Text on the sky: the light palette's inks in both color schemes, since the
/// scene stays in daylight.
enum SceneInk {
  static let ink = Palette.light.ink
  static let muted = Palette.light.mutedInk
}

private struct SkyPalette {
  let top: Color
  let middle: Color
  let horizon: Color
  let hillsTop: Color
  let hillsBottom: Color

  static let fair = SkyPalette(
    top: SceneColor.skyTop, middle: SceneColor.sky, horizon: SceneColor.skyHorizon,
    hillsTop: SceneColor.hillsTop, hillsBottom: SceneColor.hillsBottom)
  static let heat = SkyPalette(
    top: SceneColor.heatSkyTop, middle: SceneColor.heatSky, horizon: SceneColor.heatSkyHorizon,
    hillsTop: SceneColor.heatHillsTop, hillsBottom: SceneColor.heatHillsBottom)
  static let wet = SkyPalette(
    top: SceneColor.rainSkyTop, middle: SceneColor.rainSky, horizon: SceneColor.rainSkyHorizon,
    hillsTop: SceneColor.wetHillsTop, hillsBottom: SceneColor.wetHillsBottom)
  static let fog = SkyPalette(
    top: SceneColor.fogSkyTop, middle: SceneColor.fogSky, horizon: SceneColor.fogSkyHorizon,
    hillsTop: SceneColor.fogHillsTop, hillsBottom: SceneColor.fogHillsBottom)
  static let storm = SkyPalette(
    top: SceneColor.stormSkyTop, middle: SceneColor.stormSky,
    horizon: SceneColor.stormSkyHorizon,
    hillsTop: SceneColor.wetHillsTop, hillsBottom: SceneColor.wetHillsBottom)
  static let snow = SkyPalette(
    top: SceneColor.snowSkyTop, middle: SceneColor.snowSky, horizon: SceneColor.snowSkyHorizon,
    hillsTop: SceneColor.snowHillsTop, hillsBottom: SceneColor.snowHillsBottom)
}

private struct CloudLook {
  let fill: Color
  /// Where the billows turn from the light, outlining them.
  let rim: Color
  /// The underside's tint.
  let shade: Color
  let shadeOpacity: Double

  static let fair = CloudLook(
    fill: SceneColor.cloud, rim: SceneColor.cloudRim, shade: SceneColor.cloudShade,
    shadeOpacity: 0.9)
  static let rain = CloudLook(
    fill: SceneColor.rainCloud, rim: SceneColor.rainCloudRim, shade: SceneColor.rainCloudShade,
    shadeOpacity: 1)
  static let storm = CloudLook(
    fill: SceneColor.stormCloud, rim: SceneColor.stormCloudRim,
    shade: SceneColor.stormCloudShade, shadeOpacity: 1)
  static let snow = CloudLook(
    fill: SceneColor.snowCloud, rim: SceneColor.snowCloudRim, shade: SceneColor.snowCloudShade,
    shadeOpacity: 0.85)
}

private enum Precip { case drizzle, rain, snow, sleet }

extension SceneSky {
  fileprivate var palette: SkyPalette {
    switch self {
    case .heat: return .heat
    case .clear, .partly: return .fair
    case .overcast, .drizzle, .rain: return .wet
    case .fog: return .fog
    case .storm: return .storm
    case .snow, .sleet: return .snow
    }
  }

  fileprivate var cloudLook: CloudLook {
    switch self {
    case .heat, .clear, .partly, .fog: return .fair
    case .overcast, .drizzle, .rain: return .rain
    case .storm: return .storm
    case .snow, .sleet: return .snow
    }
  }

  fileprivate var precip: Precip? {
    switch self {
    case .drizzle: return .drizzle
    case .rain, .storm: return .rain
    case .snow: return .snow
    case .sleet: return .sleet
    default: return nil
    }
  }
}

// ─── Scene ───────────────────────────────────────────────────────────────────

/// How strongly the film grain shows (`GRAIN_OPACITY` in home-backdrop.tsx).
private let grainOpacity = 0.32

/// The widget's painted backdrop. `horizon` is where the hills crest, as a
/// fraction of the height; the verdict card sits on them.
struct SceneBackdrop: View {
  let sky: SceneSky
  var horizon: CGFloat = 0.56

  var body: some View {
    GeometryReader { geo in
      let size = geo.size
      let ground = size.height * horizon
      let palette = sky.palette
      ZStack(alignment: .topLeading) {
        LinearGradient(
          stops: [
            .init(color: palette.top, location: 0),
            .init(color: palette.middle, location: 0.5),
            .init(color: palette.horizon, location: 1),
          ],
          startPoint: .top,
          endPoint: UnitPoint(x: 0.5, y: horizon)
        )
        SkyArt(sky: sky, size: size, ground: ground)
        Hills(ground: ground)
          .fill(
            LinearGradient(
              colors: [palette.hillsTop, palette.hillsBottom],
              startPoint: UnitPoint(x: 0.5, y: (ground - 41) / size.height),
              endPoint: UnitPoint(x: 0.5, y: (ground + 72) / size.height)
            ))
        let wet = sky == .rain || sky == .drizzle || sky == .storm
        SceneRoad(ground: ground)
          .fill(wet ? SceneColor.wetRoad : SceneColor.road)
          .mask(alignment: .top) { Rectangle().frame(height: ground + 14) }
        Path { path in
          let w = size.width
          func point(_ x: CGFloat, _ dy: CGFloat) -> CGPoint {
            CGPoint(x: w * x, y: ground + dy * 0.6)
          }
          path.move(to: point(0.4825, -33))
          path.addLine(to: point(0.4905, -33))
          path.addLine(to: point(0.4745, -23.5))
          path.addLine(to: point(0.4615, -23.5))
          path.closeSubpath()
          path.move(to: point(0.434, -12.7))
          path.addLine(to: point(0.454, -12.7))
          path.addLine(to: point(0.426, 1.4))
          path.addLine(to: point(0.395, 1.4))
          path.closeSubpath()
        }
        .fill(SceneColor.roadMarking)
        .opacity(wet ? 0.8 : 1)
        if wet {
          Path { path in
            let w = size.width
            path.move(to: CGPoint(x: w * 0.492, y: ground - 19.2))
            path.addQuadCurve(
              to: CGPoint(x: w * 0.425, y: ground - 1.2),
              control: CGPoint(x: w * 0.465, y: ground - 10.8))
          }
          .stroke(SceneColor.roadReflection.opacity(0.2), lineWidth: 2)
        }
        Image("sceneGrain")
          .resizable(resizingMode: .tile)
          .opacity(grainOpacity)
      }
      .frame(width: size.width, height: size.height)
      .clipped()
    }
  }
}

/// Low rolling hills cresting at `ground`, two shallow humps meeting in a valley.
private struct Hills: Shape {
  let ground: CGFloat

  func path(in rect: CGRect) -> Path {
    let w = rect.width
    // The app's crest heights, flattened for the widget's smaller frame.
    func y(_ dy: CGFloat) -> CGFloat { ground + dy * 0.6 }
    var path = Path()
    path.move(to: CGPoint(x: 0, y: y(-48)))
    path.addCurve(
      to: CGPoint(x: 0.5 * w, y: y(-44)),
      control1: CGPoint(x: 0.14 * w, y: y(-68)),
      control2: CGPoint(x: 0.34 * w, y: y(-44)))
    path.addCurve(
      to: CGPoint(x: w, y: y(-50)),
      control1: CGPoint(x: 0.66 * w, y: y(-44)),
      control2: CGPoint(x: 0.86 * w, y: y(-68)))
    path.addLine(to: CGPoint(x: w, y: rect.maxY))
    path.addLine(to: CGPoint(x: 0, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

/// The same widening bend as the app, visible above the verdict's foreground card.
private struct SceneRoad: Shape {
  let ground: CGFloat

  func path(in rect: CGRect) -> Path {
    let w = rect.width
    func point(_ x: CGFloat, _ dy: CGFloat) -> CGPoint {
      CGPoint(x: w * x, y: ground + dy * 0.6)
    }
    var path = Path()
    path.move(to: point(0.488, -44))
    path.addCurve(to: point(0.23, 10), control1: point(0.445, -26), control2: point(0.345, -8))
    path.addLine(to: point(0.55, 10))
    path.addCurve(to: point(0.512, -44), control1: point(0.535, -8), control2: point(0.525, -26))
    path.closeSubpath()
    return path
  }
}

/// The sky's sun, clouds and weather. Sizes follow the widget's height, which
/// the small and medium sizes share; the medium spreads the same pieces wider.
private struct SkyArt: View {
  let sky: SceneSky
  let size: CGSize
  let ground: CGFloat

  var body: some View {
    let k = size.height / 170
    let w = size.width
    let wide = w > size.height * 1.5
    ZStack(alignment: .topLeading) {
      switch sky {
      case .heat:
        SceneSun(radius: 23 * k, glow: 1.25)
          .position(x: w - 42 * k, y: 38 * k)
      case .clear:
        SceneSun(radius: 21 * k)
          .position(x: w - 42 * k, y: 38 * k)
        SceneCloud(look: .fair, scale: 0.5 * k)
          .position(x: wide ? w * 0.5 : w * 0.12, y: 10 * k)
        SceneCloud(look: .fair, scale: 0.26 * k)
          .position(x: w - 18 * k, y: 66 * k)
      case .partly:
        SceneCloud(look: .fair, scale: 0.5 * k)
          .position(x: wide ? w * 0.5 : w * 0.12, y: 10 * k)
        SceneSun(radius: 15 * k, glow: 0.8)
          .position(x: w - 36 * k, y: 32 * k)
        SceneCloud(look: .fair, scale: 0.4 * k)
          .position(x: w - 54 * k, y: 24 * k)
      case .fog:
        SceneSun(radius: 14 * k, glow: 0.5)
          .position(x: w - 38 * k, y: 32 * k)
          .opacity(0.55)
        FogBand(width: w * 1.3, height: 30 * k, opacity: 0.7)
          .position(x: w * 0.45, y: 14 * k)
        FogBand(width: w * 1.2, height: 34 * k, opacity: 0.85)
          .position(x: w * 0.6, y: 30 * k)
        FogBand(width: w * 1.4, height: 36 * k, opacity: 0.9)
          .position(x: w * 0.4, y: 46 * k)
      default:
        let look = sky.cloudLook
        if sky == .rain {
          SceneSun(radius: 13 * k, glow: 0.45)
            .position(x: w - 32 * k, y: 28 * k)
        }
        SceneCloud(look: look, scale: 0.5 * k)
          .position(x: wide ? w * 0.42 : w * 0.1, y: 10 * k)
        SceneCloud(look: look, scale: 0.36 * k)
          .position(x: wide ? w * 0.64 : w * 0.52, y: 12 * k)
        StormCloud(look: look, precip: sky.precip, lightning: sky == .storm, scale: 0.46 * k)
          .position(x: w - 42 * k, y: 16 * k)
      }
    }
    .frame(width: size.width, height: size.height, alignment: .topLeading)
  }
}

// ─── Sun ─────────────────────────────────────────────────────────────────────

/// An airbrushed sun: a hot orb lit from its upper left, in a soft glow.
private struct SceneSun: View {
  let radius: CGFloat
  var glow: Double = 1

  var body: some View {
    let reach = radius * 3
    ZStack {
      Circle()
        .fill(
          RadialGradient(
            stops: [
              .init(color: SceneColor.sunGlowCore.opacity(0.95), location: 0),
              .init(color: SceneColor.sunGlow.opacity(0.5), location: 0.38),
              .init(color: SceneColor.sunGlow.opacity(0), location: 1),
            ],
            center: .center, startRadius: 0, endRadius: reach))
        .frame(width: 2 * reach, height: 2 * reach)
        .opacity(glow)
      Circle()
        .fill(
          RadialGradient(
            stops: [
              .init(color: SceneColor.sunCore, location: 0),
              .init(color: SceneColor.sun, location: 0.35),
              .init(color: SceneColor.sunEdge, location: 1),
            ],
            center: UnitPoint(x: 0.4, y: 0.36), startRadius: 0, endRadius: radius * 1.4))
        .frame(width: 2 * radius, height: 2 * radius)
    }
  }
}

// ─── Clouds ──────────────────────────────────────────────────────────────────

/// The app's cumulus drawing box; a cloud is placed by its body's middle.
private let cloudBox = CGSize(width: 200, height: 100)
private let cloudAnchor = CGPoint(x: 100, y: 60)

/// Sculpted, windblown cloud silhouette in 200x100 drawing units matching the app.
private struct CloudBody: Shape {
  func path(in rect: CGRect) -> Path {
    let sx = rect.width / cloudBox.width
    let sy = rect.height / cloudBox.height
    func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: x * sx, y: y * sy)
    }
    var path = Path()
    path.move(to: pt(22, 78))
    path.addCurve(to: pt(28, 58), control1: pt(14, 78), control2: pt(14, 62))
    path.addCurve(to: pt(64, 44), control1: pt(30, 44), control2: pt(48, 38))
    path.addCurve(to: pt(128, 36), control1: pt(74, 26), control2: pt(108, 20))
    path.addCurve(to: pt(166, 54), control1: pt(144, 32), control2: pt(162, 42))
    path.addCurve(to: pt(170, 78), control1: pt(184, 54), control2: pt(188, 78))
    path.closeSubpath()
    return path
  }
}

/// A painted cumulus lit from the upper left, turning to a tinted rim at its
/// far edges and darkening along its underside, softened like airbrush.
private struct SceneCloud: View {
  let look: CloudLook
  let scale: CGFloat

  var body: some View {
    let width = cloudBox.width * scale
    let height = cloudBox.height * scale
    ZStack {
      CloudBody()
        .fill(
          RadialGradient(
            stops: [
              .init(color: look.fill, location: 0),
              .init(color: look.fill, location: 0.5),
              .init(color: look.rim, location: 1),
            ],
            center: UnitPoint(x: 78 / cloudBox.width, y: 22 / cloudBox.height),
            startRadius: 0, endRadius: 128 * scale))
      CloudBody()
        .fill(
          LinearGradient(
            colors: [look.shade.opacity(0), look.shade.opacity(look.shadeOpacity)],
            startPoint: UnitPoint(x: 0.5, y: 54 / cloudBox.height),
            endPoint: UnitPoint(x: 0.5, y: 88 / cloudBox.height)))
    }
    .frame(width: width, height: height)
    .blur(radius: max(1.0, 3.0 * scale))
    // Placed by the body's middle rather than the box's.
    .offset(
      x: (cloudBox.width / 2 - cloudAnchor.x) * scale,
      y: (cloudBox.height / 2 - cloudAnchor.y) * scale)
  }
}

/// The heavy cloud where the sun would be, with what falls from it and, in a
/// storm, sheet lightning glowing behind it.
private struct StormCloud: View {
  let look: CloudLook
  let precip: Precip?
  let lightning: Bool
  let scale: CGFloat

  var body: some View {
    ZStack {
      if lightning {
        Ellipse()
          .fill(
            EllipticalGradient(stops: [
              .init(color: SceneColor.lightningGlow, location: 0),
              .init(color: SceneColor.lightningGlow.opacity(0.55), location: 0.45),
              .init(color: SceneColor.lightningGlow.opacity(0), location: 1),
            ])
          )
          .frame(width: 300 * scale, height: 200 * scale)
          .opacity(0.5)
      }
      if let precip {
        Precipitation(precip: precip, scale: scale)
          // Hung from inside the cloud's belly, so it falls out of it.
          .offset(y: (12 + fallTile / 2) * scale)
      }
      SceneCloud(look: look, scale: scale)
    }
  }
}

// ─── Rain and snow ───────────────────────────────────────────────────────────
// The app's falling sheets, caught in one frame.

private let fallWidth: CGFloat = 150
private let fallTile: CGFloat = 132
private let rainSlant: CGFloat = 0.18
private let fallMargin: CGFloat = 10

private struct FallLayer {
  let count: Int
  /// Streak lengths for rain, flake radii for snow.
  let min: CGFloat
  let max: CGFloat
  let opacity: Double
  let seed: UInt64

  static let fineRain = FallLayer(count: 15, min: 16, max: 24, opacity: 0.7, seed: 3)
  static let heavyRain = FallLayer(count: 9, min: 30, max: 44, opacity: 1, seed: 11)
  static let farSnow = FallLayer(count: 26, min: 1.3, max: 2.1, opacity: 0.6, seed: 5)
  static let nearSnow = FallLayer(count: 16, min: 2.1, max: 3.2, opacity: 1, seed: 17)

  /// The layer's streaks or flakes as (x, y, size) on one tile, spread evenly
  /// with seeded jitter, so they sit the same way every time.
  var pieces: [(x: CGFloat, y: CGFloat, size: CGFloat)] {
    var state = seed
    func random() -> CGFloat {
      state = (state &* 1_103_515_245 &+ 12_345) % 2_147_483_648
      return CGFloat(state) / 2_147_483_648
    }
    let span = (fallWidth - 2 * fallMargin) / CGFloat(count)
    return (0..<count).map { i in
      let x = fallMargin + (CGFloat(i) + 0.5 + (random() - 0.5) * 0.8) * span
      let y = random() * fallTile
      return (x, y, min + random() * (max - min))
    }
  }
}

/// Rain streaks: a hair-thin tail widening to a rounded head, leaning left.
private struct RainStreaks: Shape {
  let layer: FallLayer

  func path(in rect: CGRect) -> Path {
    let s = rect.width / fallWidth
    var path = Path()
    for piece in layer.pieces {
      let length = piece.size
      let head: CGFloat = length > 28 ? 2 : 1.2
      let x = piece.x + rainSlant * length
      let hx = x - rainSlant * (length - head)
      let hy = piece.y + length - head
      path.move(to: CGPoint(x: x * s, y: piece.y * s))
      path.addLine(to: CGPoint(x: (hx + head) * s, y: hy * s))
      path.addLine(to: CGPoint(x: (hx - head) * s, y: hy * s))
      path.closeSubpath()
      path.addEllipse(
        in: CGRect(x: (hx - head) * s, y: (hy - head) * s, width: 2 * head * s, height: 2 * head * s))
    }
    return path
  }
}

private struct Precipitation: View {
  let precip: Precip
  let scale: CGFloat

  var body: some View {
    let width = fallWidth * scale
    let height = fallTile * scale
    let rain: [FallLayer] =
      switch precip {
      case .rain: [.fineRain, .heavyRain]
      case .snow: []
      case .drizzle, .sleet: [.fineRain]
      }
    let snow: [FallLayer] =
      switch precip {
      case .snow: [.farSnow, .nearSnow]
      case .sleet: [.nearSnow]
      case .drizzle, .rain: []
      }
    ZStack(alignment: .topLeading) {
      if !rain.isEmpty {
        // The gray veil a rain cloud trails, darkest under its belly.
        RainShaft()
          .fill(
            LinearGradient(
              colors: [
                SceneColor.rainCloudShade.opacity(0.25 * Double(rain.count)),
                SceneColor.rainCloudShade.opacity(0),
              ],
              startPoint: .top, endPoint: .bottom)
          )
          .blur(radius: 8 * scale)
      }
      ForEach(Array(rain.enumerated()), id: \.offset) { _, layer in
        RainStreaks(layer: layer)
          .fill(
            LinearGradient(
              colors: [
                SceneColor.rain.opacity(layer.opacity * 0.2),
                SceneColor.rain.opacity(layer.opacity),
              ],
              startPoint: .top, endPoint: .bottom))
      }
      ForEach(Array(snow.enumerated()), id: \.offset) { _, layer in
        // Flakes keep a visible size at the widget's small scale.
        let flakeScale = Swift.max(scale, 0.7)
        ForEach(Array(layer.pieces.enumerated()), id: \.offset) { _, flake in
          let r = flake.size * flakeScale
          Circle()
            .fill(
              RadialGradient(
                stops: [
                  .init(color: SceneColor.snow.opacity(layer.opacity), location: 0),
                  .init(color: SceneColor.snow.opacity(layer.opacity * 0.7), location: 0.4),
                  .init(color: SceneColor.snow.opacity(0), location: 1),
                ],
                center: .center, startRadius: 0, endRadius: r))
            .frame(width: 2 * r, height: 2 * r)
            .position(x: flake.x * scale, y: flake.y * scale)
        }
      }
    }
    .frame(width: width, height: height, alignment: .topLeading)
    .clipped()
  }
}

/// The rain veil's outline: wide under the cloud, narrowing as it falls.
private struct RainShaft: Shape {
  func path(in rect: CGRect) -> Path {
    let s = rect.width / fallWidth
    var path = Path()
    path.move(to: CGPoint(x: 28 * s, y: 0))
    path.addLine(to: CGPoint(x: (fallWidth - 28) * s, y: 0))
    path.addLine(to: CGPoint(x: (fallWidth - 40) * s, y: rect.height))
    path.addLine(to: CGPoint(x: 22 * s, y: rect.height))
    path.closeSubpath()
    return path
  }
}

// ─── Fog ─────────────────────────────────────────────────────────────────────

/// A long band of mist, feathered to nothing at its edges.
private struct FogBand: View {
  let width: CGFloat
  let height: CGFloat
  let opacity: Double

  var body: some View {
    Ellipse()
      .fill(
        EllipticalGradient(stops: [
          .init(color: SceneColor.fog.opacity(opacity), location: 0),
          .init(color: SceneColor.fog.opacity(opacity * 0.7), location: 0.55),
          .init(color: SceneColor.fog.opacity(0), location: 1),
        ])
      )
      .frame(width: width, height: height)
  }
}

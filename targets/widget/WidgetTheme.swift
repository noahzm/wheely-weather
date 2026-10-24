import SwiftUI

// The app's colors and type (src/constants/theme.ts), so the widget reads as
// the home screen in miniature. Keep the values in step with theme.ts.

extension Color {
  /// An sRGB color from a 0xRRGGBB literal, matching the app's hex tokens.
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// `WheelyTheme`: native grouped surfaces, outlined and hard-shadowed in black
/// in light mode and in neutral grays in dark mode.
struct Palette {
  let background: Color
  let paper: Color
  let ink: Color
  let mutedInk: Color
  /// Card and sticker outlines.
  let border: Color
  /// Hairlines and empty strip blocks.
  let divider: Color
  /// The hard offset shadow under cards and stickers.
  let shadow: Color

  static let light = Palette(
    background: Color(hex: 0xF4F4F6),
    paper: .white,
    ink: .black,
    mutedInk: Color(hex: 0x3A3A3C),
    border: .black,
    divider: .black,
    shadow: .black
  )

  static let dark = Palette(
    background: .black,
    paper: Color(hex: 0x1C1C1E),
    ink: .white,
    mutedInk: Color(hex: 0xAEAEB2),
    border: Color(hex: 0x48484A),
    divider: Color(hex: 0x38383A),
    shadow: Color(hex: 0x3A3A3C)
  )

  static func of(_ scheme: ColorScheme) -> Palette { scheme == .dark ? dark : light }
}

/// The five ride ratings' colors (`condition` in theme.ts), the same in both
/// color schemes, each with black ink. The wait state uses the accent pink.
enum RideColor {
  static let good = Color(hex: 0x2ECC71)
  static let fair = Color(hex: 0x38BDF8)
  static let marginal = Color(hex: 0xFFD20A)
  static let poor = Color(hex: 0xFF9F0A)
  static let bad = Color(hex: 0xFF5252)
  static let wait = Color(hex: 0xF1BDF2)
  static let ink = Color.black

  /// A rating's color; nil for a rating this build doesn't know.
  static func of(_ condition: String?) -> Color? {
    switch condition {
    case "good": return good
    case "fair": return fair
    case "marginal": return marginal
    case "poor": return poor
    case "bad": return bad
    default: return nil
    }
  }

  /// How strongly a rating shows where the widget can't use color (Tinted and
  /// Clear home screens), so the hour strip still ranks the hours.
  static func strength(_ condition: String?) -> Double {
    switch condition {
    case "good": return 1
    case "fair": return 0.8
    case "marginal": return 0.6
    case "poor": return 0.4
    default: return 0.25
    }
  }
}

/// The ratings' words (`CONDITION_DISPLAY` in src/domain/constants.ts).
enum RideRating {
  static func word(_ condition: String?) -> String? {
    switch condition {
    case "good": return "Good"
    case "fair": return "Fair"
    case "marginal": return "Iffy"
    case "poor": return "Poor"
    case "bad": return "Bad"
    default: return nil
    }
  }
}

/// The app's type roles. The fonts ship in the widget bundle (UIAppFonts) and
/// keep a fixed size, since a widget's frame can't grow with Dynamic Type.
enum WidgetType {
  /// Oswald Bold (`PosterText`): the verdict headline, in capitals.
  static func poster(_ size: CGFloat) -> Font { .custom("Oswald-Bold", fixedSize: size) }
  /// Oswald Regular (`PosterLightText`): big numbers.
  static func posterLight(_ size: CGFloat) -> Font { .custom("Oswald-Regular", fixedSize: size) }
  /// The system font for body text: the verdict's reason, sticker text.
  static func body(_ size: CGFloat) -> Font { .system(size: size) }
}

extension Text {
  /// `LabelText`: small bold capitals, tracked out, for the place and hour ticks.
  func labelText(_ size: CGFloat) -> some View {
    font(.system(size: size, weight: .bold))
      .textCase(.uppercase)
      .tracking(size * 0.08)
  }
}

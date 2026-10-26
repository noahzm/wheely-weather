import SwiftUI
import WidgetKit

// The home screen widget's layouts: the home screen's top in miniature. The
// place and temperature sit on the painted sky, and the verdict on a card
// colored by its rating, outlined and hard-shadowed like the app's cards.

/// What a widget shows at one moment, worked out from the snapshot.
struct VerdictDisplay {
  enum PlaceLine {
    case place(String, isCurrentLocation: Bool)
    /// The forecast is hours old: when it's from.
    case asOf(Date)
    /// Past the last verdict: when the app last fetched.
    case updated(Date)
  }

  struct Hour {
    let at: Date
    /// The hour's own rating, which colors its strip block.
    let condition: String?
  }

  let headline: String
  let detail: String
  let temperature: String
  /// Says which way the verdict leans where the widget can't use color.
  let statusSymbol: String
  let place: PlaceLine
  /// The card's rating color; nil once stale, which shows a plain card.
  let fill: Color?
  /// The painted sky; nil for the plain page (waiting or stale), as at home.
  let sky: SceneSky?
  /// The next hours, for the medium widget.
  let hours: [Hour]
}

/// How the widget is drawn, from WidgetKit's environment.
struct WidgetLook {
  /// Full color; false on Tinted and Clear home screens.
  let fullColor: Bool
  /// The sky shows; false where the system drops the background (StandBy).
  let showsBackground: Bool
  let scheme: ColorScheme

  var palette: Palette { .of(scheme) }

  func onSky(_ display: VerdictDisplay) -> Bool {
    display.sky != nil && fullColor && showsBackground
  }

  /// The look over `sky`, the widget's backdrop (nil for the plain page). The
  /// painted sky is daylight in both color schemes, so the card on it keeps
  /// light mode's paper, black outline and black shadow; dark mode's grays
  /// looked muddy against it. The plain page follows the system scheme.
  func over(_ sky: SceneSky?) -> WidgetLook {
    let skyShows = sky != nil && fullColor && showsBackground
    return WidgetLook(
      fullColor: fullColor, showsBackground: showsBackground, scheme: skyShows ? .light : scheme)
  }
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

/// The gap between a card and the widget's edges; the card's corners stay
/// concentric with the widget's.
private let cardInset: CGFloat = 10

struct SmallVerdictView: View {
  let display: VerdictDisplay
  let look: WidgetLook

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      SkyHeader(display: display, look: look)
        .padding(.horizontal, cardInset + 4)
        .padding(.top, 10)
        // Full size however much the card holds; the card's reason gives way.
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 4)
      VerdictCard(display: display, look: look)
        .padding([.horizontal, .bottom], cardInset)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct MediumVerdictView: View {
  let display: VerdictDisplay
  let look: WidgetLook

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      SkyHeader(display: display, look: look)
        .padding(.horizontal, cardInset + 4)
        .padding(.top, 10)
        // Full size however much the card holds; the card's reason gives way.
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 4)
      Group {
        // Past the last verdict there are no hours left to show.
        if display.hours.isEmpty {
          VerdictCard(display: display, look: look)
        } else {
          TicketCard(display: display, look: look)
        }
      }
      .padding([.horizontal, .bottom], cardInset)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

/// Shown before the app has written a verdict.
struct EmptyVerdictView: View {
  let look: WidgetLook

  var body: some View {
    let palette = look.palette
    let onSky = look.fullColor && look.showsBackground
    VStack(alignment: .leading, spacing: 0) {
      Image(systemName: "bicycle")
        .font(.system(size: 26, weight: .semibold))
        .foregroundStyle(onSky ? SceneInk.ink : palette.ink)
        .padding(.horizontal, cardInset + 4)
        .padding(.top, 14)
      Spacer(minLength: 4)
      VStack(alignment: .leading, spacing: 2) {
        Text("Wheely Weather")
          .font(WidgetType.poster(18))
          .textCase(.uppercase)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text("Open the app to load today’s ride verdict.")
          .font(WidgetType.body(12))
          .lineLimit(2)
      }
      .foregroundStyle(palette.ink)
      .cardPadding()
      .background(CardSurface(fill: palette.paper, look: look))
      .padding([.horizontal, .bottom], cardInset)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/// The temperature and the place, as the home screen's title sits on its sky.
private struct SkyHeader: View {
  let display: VerdictDisplay
  let look: WidgetLook

  var body: some View {
    let onSky = look.onSky(display)
    VStack(alignment: .leading, spacing: 0) {
      Text(display.temperature)
        .font(WidgetType.posterLight(36))
        .foregroundStyle(onSky ? SceneInk.ink : look.palette.ink)
        // Oswald's line box runs tall; this keeps the place tucked under it.
        .padding(.vertical, -6)
      PlaceLabel(place: display.place)
        .foregroundStyle(onSky ? SceneInk.muted : look.palette.mutedInk)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
  }
}

/// The place line: the place (with the location arrow when it follows the
/// device), or how old the forecast is.
struct PlaceLabel: View {
  let place: VerdictDisplay.PlaceLine
  /// Plain text in the surrounding font, for the Lock Screen.
  var plain = false

  var body: some View {
    switch place {
    case let .place(name, isCurrentLocation):
      HStack(spacing: 3) {
        if isCurrentLocation {
          Image(systemName: "location.fill")
            .font(plain ? nil : .system(size: 9, weight: .bold))
            .imageScale(plain ? .small : .medium)
            .accessibilityLabel("Current location")
        }
        styled(Text(name))
      }
    case let .asOf(date):
      styled(Text("As of \(date, style: .time)"))
    case let .updated(date):
      styled(Text("Updated \(date, style: .relative) ago"))
    }
  }

  @ViewBuilder
  private func styled(_ text: Text) -> some View {
    if plain { text } else { text.labelText(10) }
  }
}

/// The verdict: the rating's color behind the headline in poster capitals and
/// the one line of reasoning a widget has room for.
private struct VerdictCard: View {
  let display: VerdictDisplay
  let look: WidgetLook

  var body: some View {
    VerdictText(display: display, look: look)
      .cardPadding()
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(CardSurface(fill: display.fill ?? look.palette.paper, look: look))
      .accessibilityElement(children: .combine)
  }
}

/// The medium widget's verdict: a wide card with a paper stub below an ink
/// rule, holding the next hours as a strip like the week list's.
private struct TicketCard: View {
  let display: VerdictDisplay
  let look: WidgetLook

  var body: some View {
    let palette = look.palette
    VStack(alignment: .leading, spacing: 0) {
      VerdictText(display: display, look: look, oneLine: true)
        .padding(.horizontal, 11)
        .padding(.top, 7)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Plain rectangles: a bare color background would round itself to the
        // widget's shape.
        .background(Rectangle().fill(look.fullColor ? display.fill ?? palette.paper : .clear))
        .accessibilityElement(children: .combine)
      Rectangle()
        .fill(look.fullColor ? palette.border : .white.opacity(0.3))
        .frame(height: 2)
      HourStrip(hours: display.hours, look: look)
        .padding(.horizontal, 11)
        .padding(.top, 6)
        .padding(.bottom, 9)
        .background(Rectangle().fill(look.fullColor ? palette.paper : .clear))
    }
    .clipShape(ContainerRelativeShape())
    // The surface's shadow behind, and its outline over the clipped halves.
    .background(CardSurface(fill: .clear, look: look))
    .overlay {
      if look.fullColor {
        ContainerRelativeShape().strokeBorder(palette.border, lineWidth: 2)
      }
    }
  }
}

/// The headline and the reason beneath it, in the rating's ink.
private struct VerdictText: View {
  let display: VerdictDisplay
  let look: WidgetLook
  /// One line each, for the medium widget's wide card.
  var oneLine = false

  var body: some View {
    let ink = display.fill == nil ? look.palette.mutedInk : RideColor.ink
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        // Without the color, a symbol says which way the playful headline
        // leans ("Your call" alone doesn't).
        if !look.fullColor {
          Image(systemName: display.statusSymbol)
            .font(.system(size: 14, weight: .bold))
            .accessibilityHidden(true)
        }
        Text(display.headline)
          .font(WidgetType.poster(headlineSize))
          .textCase(.uppercase)
          .posterLeading(headlineSize)
          .lineLimit(oneLine ? 1 : 2)
          .minimumScaleFactor(0.7)
          .allowsTightening(true)
      }
      .widgetAccentable()
      // The headline keeps its lines; the reason gives way first.
      .layoutPriority(1)
      Text(display.detail)
        .font(WidgetType.body(12))
        .lineLimit(oneLine ? 1 : 2)
        .minimumScaleFactor(0.9)
    }
    .foregroundStyle(look.fullColor ? ink : .primary)
  }
}

/// The next hours as blocks in each hour's own rating color under its time,
/// like the week list's daylight strip.
private struct HourStrip: View {
  let hours: [VerdictDisplay.Hour]
  let look: WidgetLook

  var body: some View {
    let palette = look.palette
    HStack(spacing: 2) {
      ForEach(Array(hours.enumerated()), id: \.offset) { _, hour in
        VStack(spacing: 3) {
          Text(hour.at, format: .dateTime.hour())
            .labelText(8)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(look.fullColor ? palette.mutedInk : .secondary)
          Rectangle()
            .fill(blockColor(hour.condition, palette: palette))
            .frame(height: 8)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenHours)
  }

  /// "Next hours: 11 AM good, 12 PM fair, …"
  private var spokenHours: String {
    let each = hours.map { hour in
      [hour.at.formatted(.dateTime.hour()), RideRating.word(hour.condition)?.lowercased()]
        .compactMap { $0 }
        .joined(separator: " ")
    }
    return "Next hours: " + each.joined(separator: ", ")
  }

  /// A rating's color; an unrated hour gets the divider, as the app's strip
  /// does. Tinted and Clear home screens rank the hours by strength instead.
  private func blockColor(_ condition: String?, palette: Palette) -> Color {
    guard look.fullColor else { return .white.opacity(RideColor.strength(condition)) }
    return RideColor.of(condition) ?? palette.divider
  }
}

/// A card's surface: the fill, a 2pt outline and a hard offset shadow, with
/// corners concentric to the widget's. Tinted and Clear home screens get a
/// faint panel instead, since they'd flatten the fill into the text's color.
private struct CardSurface: View {
  let fill: Color
  let look: WidgetLook

  var body: some View {
    let shape = ContainerRelativeShape()
    if look.fullColor {
      ZStack {
        shape.fill(look.palette.shadow).offset(x: 3, y: 3)
        shape.fill(fill)
        shape.strokeBorder(look.palette.border, lineWidth: 2)
      }
    } else {
      shape.fill(.white.opacity(0.14))
    }
  }
}

private let headlineSize: CGFloat = 21

extension View {
  /// Oswald's capitals sit well below its tall ascender, so the top padding is
  /// slimmer than the sides to look even.
  fileprivate func cardPadding() -> some View {
    padding(.horizontal, 11).padding(.top, 7).padding(.bottom, 10)
  }
}

extension View {
  /// The app's poster leading (about 1.14 times the size, as `Type.headline`
  /// sets it) in place of Oswald's own 1.48, where iOS can set it.
  @ViewBuilder
  fileprivate func posterLeading(_ size: CGFloat) -> some View {
    if #available(iOS 26.0, macOS 26.0, *) {
      lineHeight(.exact(points: (size * 1.14).rounded()))
    } else {
      self
    }
  }
}

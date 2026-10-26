import SwiftUI
import WidgetKit

// The widget can't run the app's TypeScript scoring, so the app rates the
// forecast and writes display-ready strings into the shared App Group
// (src/services/widgetStorage.ios.ts). Field names match `WidgetSnapshot` in
// src/services/widgetSnapshot.ts. The layouts live in WidgetViews.swift, the
// painted sky in WidgetScene.swift and the app's colors and type in
// WidgetTheme.swift.
struct Verdict: Decodable {
  let status: String
  // The five-level rating (good…bad) behind `status`, so the widget's color
  // matches the app's card. Optional so older payloads still decode.
  let condition: String?
  let headline: String
  let detail: String
  let temperature: String
  let symbol: String
  // Bad now, good later today: shown in the accent pink. Optional like above.
  let waiting: Bool?
  // The home screen's sky (`SceneSky`); null while waiting. Optional like above.
  let sky: String?
}

/// A verdict the app rated ahead of time, shown from `at` on.
struct UpcomingVerdict: Decodable {
  let at: Date
  let verdict: Verdict
  // The hour rated on its own, for the medium widget's hour strip. Optional
  // so older payloads still decode.
  let hourCondition: String?

  private enum CodingKeys: String, CodingKey { case at, hourCondition }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    at = try container.decode(Date.self, forKey: .at)
    hourCondition = try container.decodeIfPresent(String.self, forKey: .hourCondition)
    verdict = try Verdict(from: decoder)
  }
}

struct WidgetSnapshot: Decodable {
  /// The verdict when the forecast was fetched; its fields sit at the top level.
  let verdict: Verdict
  let location: String
  // Optional so a payload written by an older app build still decodes.
  let isCurrentLocation: Bool?
  let updatedAt: Date
  // The next hours' verdicts, rated from the same forecast, since the widget
  // only updates when the app runs. Optional like above.
  let upcoming: [UpcomingVerdict]?

  private enum CodingKeys: String, CodingKey {
    case location, isCurrentLocation, updatedAt, upcoming
  }

  init(from decoder: Decoder) throws {
    verdict = try Verdict(from: decoder)
    let container = try decoder.container(keyedBy: CodingKeys.self)
    location = try container.decode(String.self, forKey: .location)
    isCurrentLocation = try container.decodeIfPresent(Bool.self, forKey: .isCurrentLocation)
    updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    upcoming = try container.decodeIfPresent([UpcomingVerdict].self, forKey: .upcoming)
  }

  /// The verdict for `date`: the latest upcoming one that has begun.
  func verdict(at date: Date) -> Verdict {
    upcoming?.last(where: { $0.at <= date })?.verdict ?? verdict
  }

  /// Future hourly verdicts after `date`, for the medium widget's strip.
  func upcoming(after date: Date, limit: Int) -> [UpcomingVerdict] {
    Array((upcoming ?? []).filter { $0.at > date }.prefix(limit))
  }

  /// When the verdicts run out: an hour after the last upcoming one begins, or
  /// `staleAfter` past the fetch for a payload without them.
  var coveredUntil: Date {
    if let last = upcoming?.last { return last.at.addingTimeInterval(60 * 60) }
    return updatedAt.addingTimeInterval(VerdictProvider.staleAfter)
  }
}

enum SnapshotStore {
  static let appGroup = "group.app.wheelyweather"
  static let key = "widgetSnapshot"

  static func load() -> WidgetSnapshot? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: key),
      let data = json.data(using: .utf8)
    else { return nil }
    let decoder = JSONDecoder()
    // JS `toISOString()` includes milliseconds, which `.iso8601` rejects.
    decoder.dateDecodingStrategy = .custom { decoder in
      let value = try decoder.singleValueContainer().decode(String.self)
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      guard let date = formatter.date(from: value) else {
        throw DecodingError.dataCorrupted(
          .init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(value)"))
      }
      return date
    }
    return try? decoder.decode(WidgetSnapshot.self, from: data)
  }
}

struct VerdictEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
  /// Past the last verdict: shown gray, with the fetch time instead.
  let isStale: Bool
  /// The forecast is a while old: the footer says when it's from.
  let isOldForecast: Bool
}

struct VerdictProvider: TimelineProvider {
  // A fetch-time verdict describes conditions then; past this, a payload with
  // no upcoming verdicts stops presenting it as current, and one with them
  // says the forecast is from earlier.
  static let staleAfter: TimeInterval = 3 * 60 * 60

  func placeholder(in context: Context) -> VerdictEntry {
    VerdictEntry(date: .now, snapshot: nil, isStale: false, isOldForecast: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (VerdictEntry) -> Void) {
    completion(entry(at: .now, snapshot: SnapshotStore.load()))
  }

  // The app reloads the timeline whenever it writes a new verdict, so the only
  // scheduled changes are the upcoming verdicts, the forecast aging, and the
  // stale look once the verdicts run out.
  func getTimeline(in context: Context, completion: @escaping (Timeline<VerdictEntry>) -> Void) {
    let snapshot = SnapshotStore.load()
    var entries = [entry(at: .now, snapshot: snapshot)]
    if let snapshot {
      let changes =
        (snapshot.upcoming ?? []).map(\.at) + [
          snapshot.updatedAt.addingTimeInterval(Self.staleAfter),
          snapshot.coveredUntil,
        ]
      for date in Set(changes).filter({ $0 > .now }).sorted() {
        entries.append(entry(at: date, snapshot: snapshot))
      }
    }
    completion(Timeline(entries: entries, policy: .never))
  }

  private func entry(at date: Date, snapshot: WidgetSnapshot?) -> VerdictEntry {
    VerdictEntry(
      date: date,
      snapshot: snapshot,
      isStale: snapshot.map { date >= $0.coveredUntil } ?? false,
      isOldForecast: snapshot.map { date.timeIntervalSince($0.updatedAt) >= Self.staleAfter }
        ?? false
    )
  }
}

struct WheelyWidgetView: View {
  let entry: VerdictEntry
  @Environment(\.widgetFamily) private var family
  // Tinted and Clear home screens drop the colored background, and with it the
  // verdict's color; `fullColor` is the default and Dark home screens.
  @Environment(\.widgetRenderingMode) private var renderingMode
  // False where the system removes the background, as in StandBy.
  @Environment(\.showsWidgetContainerBackground) private var showsBackground
  @Environment(\.colorScheme) private var colorScheme
  // The margins the system would have given; the home screen sizes set their
  // own, so their sky can run to the edges.
  @Environment(\.widgetContentMargins) private var margins

  private var look: WidgetLook {
    WidgetLook(
      fullColor: renderingMode == .fullColor,
      showsBackground: showsBackground,
      scheme: colorScheme
    )
  }

  var body: some View {
    switch family {
    case .accessoryCircular:
      circularContent
        .padding(margins)
        .containerBackground(.fill.tertiary, for: .widget)
    case .accessoryRectangular:
      rectangularContent
        .padding(margins)
        .containerBackground(.fill.tertiary, for: .widget)
    default:
      homeScreenContent
    }
  }

  @ViewBuilder
  private var homeScreenContent: some View {
    if let snapshot = entry.snapshot {
      let display = display(for: snapshot)
      let look = self.look.over(display.sky)
      Group {
        if family == .systemMedium {
          MediumVerdictView(display: display, look: look)
        } else {
          SmallVerdictView(display: display, look: look)
        }
      }
      .containerBackground(for: .widget) { background(display.sky) }
    } else {
      EmptyVerdictView(look: look.over(.clear))
        .containerBackground(for: .widget) { background(.clear) }
    }
  }

  /// The painted sky, or the plain page where the home screen shows none.
  @ViewBuilder
  private func background(_ sky: SceneSky?) -> some View {
    if let sky {
      SceneBackdrop(sky: sky)
    } else {
      look.palette.background
    }
  }

  // ─── Lock Screen ───────────────────────────────────────────────────────────

  @ViewBuilder
  private var rectangularContent: some View {
    if let snapshot = entry.snapshot {
      let verdict = snapshot.verdict(at: entry.date)
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Image(systemName: statusSymbol(verdict))
            .font(.system(size: 13, weight: .bold))
            .accessibilityHidden(true)
          Text(keepTogether(verdict.headline))
            .font(WidgetType.poster(17))
            .textCase(.uppercase)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          Spacer(minLength: 4)
          Text(verdict.temperature)
            .font(WidgetType.posterLight(17))
        }
        .widgetAccentable()
        Text(keepTogether(verdict.detail))
          .font(.caption)
          .lineLimit(1)
        PlaceLabel(place: placeLine(snapshot), plain: true)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
      VStack(alignment: .leading, spacing: 2) {
        Label("Wheely Weather", systemImage: "bicycle")
          .font(WidgetType.poster(17))
          .textCase(.uppercase)
        Text("Open app to load ride verdict")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var circularContent: some View {
    ZStack {
      AccessoryWidgetBackground()
      if let snapshot = entry.snapshot {
        let verdict = snapshot.verdict(at: entry.date)
        VStack(spacing: 0) {
          Image(systemName: statusSymbol(verdict))
            .font(.caption.weight(.bold))
            .widgetAccentable()
          Text(verdict.temperature)
            .font(WidgetType.posterLight(20))
            .minimumScaleFactor(0.7)
          Image(systemName: verdict.symbol)
            .font(.caption2)
        }
      } else {
        Image(systemName: "bicycle")
          .font(.title3)
      }
    }
  }

  // ─── Display ───────────────────────────────────────────────────────────────

  private func display(for snapshot: WidgetSnapshot) -> VerdictDisplay {
    let verdict = snapshot.verdict(at: entry.date)
    let waiting = verdict.waiting == true
    // A payload from before skies were sent paints the home screen's fallback.
    let sky = verdict.sky.flatMap(SceneSky.init(rawValue:)) ?? .fallback(status: verdict.status)
    return VerdictDisplay(
      headline: keepTogether(verdict.headline),
      detail: keepTogether(verdict.detail),
      temperature: verdict.temperature,
      statusSymbol: statusSymbol(verdict),
      place: placeLine(snapshot),
      fill: entry.isStale ? nil : statusColor(verdict),
      sky: entry.isStale || waiting ? nil : sky,
      hours: snapshot.upcoming(after: entry.date, limit: 6).map { item in
        VerdictDisplay.Hour(at: item.at, condition: item.hourCondition)
      }
    )
  }

  private func placeLine(_ snapshot: WidgetSnapshot) -> VerdictDisplay.PlaceLine {
    if entry.isStale { return .updated(snapshot.updatedAt) }
    // Hours on, the verdicts are still the morning's forecast; say so.
    if entry.isOldForecast { return .asOf(snapshot.updatedAt) }
    return .place(snapshot.location, isCurrentLocation: snapshot.isCurrentLocation == true)
  }

  private func statusSymbol(_ verdict: Verdict) -> String {
    if verdict.waiting == true { return "clock.fill" }
    switch verdict.status {
    case "yes": return "checkmark.circle.fill"
    case "maybe": return "questionmark.circle.fill"
    default: return "xmark.circle.fill"
    }
  }

  /// The verdict card's color, as the app's card picks it.
  private func statusColor(_ verdict: Verdict) -> Color {
    if verdict.waiting == true { return RideColor.wait }
    if let color = RideColor.of(verdict.condition) { return color }
    switch verdict.status {
    case "yes": return RideColor.good
    case "maybe": return RideColor.marginal
    default: return RideColor.bad
    }
  }

  /// Keeps times and units on the line with their numbers, as the app's card
  /// does (`preventOrphans` in ride-verdict.tsx).
  private func keepTogether(_ text: String) -> String {
    [" AM", " PM", " mph", " km/h"].reduce(text) { result, unit in
      result.replacingOccurrences(of: unit, with: "\u{00A0}" + unit.dropFirst())
    }
  }
}

struct WheelyWidget: Widget {
  let kind = "WheelyWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: VerdictProvider()) { entry in
      WheelyWidgetView(entry: entry)
    }
    .configurationDisplayName("Ride Verdict")
    // The home screen sizes set their own margins, so the sky reaches the edges.
    .contentMarginsDisabled()
    .description("Today’s ride verdict for the place you’re viewing in the app.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryRectangular,
      .accessoryCircular,
    ])
  }
}

@main
struct WheelyWidgetBundle: WidgetBundle {
  var body: some Widget {
    WheelyWidget()
  }
}

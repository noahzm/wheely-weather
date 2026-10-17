import SwiftUI
import WidgetKit

// The widget can't run the app's TypeScript scoring, so the app rates the
// forecast and writes display-ready strings into the shared App Group
// (src/services/widgetStorage.ios.ts). Field names match `WidgetSnapshot` in
// src/utils/widgetSnapshot.ts.
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
}

/// A verdict the app rated ahead of time, shown from `at` on.
struct UpcomingVerdict: Decodable {
  let at: Date
  let verdict: Verdict

  private enum CodingKeys: String, CodingKey { case at }

  init(from decoder: Decoder) throws {
    at = try decoder.container(keyedBy: CodingKeys.self).decode(Date.self, forKey: .at)
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
  func upcoming(after date: Date, limit: Int = 4) -> [UpcomingVerdict] {
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

  var body: some View {
    if let snapshot = entry.snapshot {
      let verdict = snapshot.verdict(at: entry.date)
      switch family {
      case .accessoryCircular:
        circularContent(verdict)
      case .accessoryRectangular:
        rectangularContent(snapshot, verdict)
      case .systemMedium:
        mediumContent(snapshot, verdict)
      default:
        smallContent(snapshot, verdict)
      }
    } else {
      emptyView
    }
  }

  @ViewBuilder
  private var emptyView: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "bicycle")
          .font(.title3)
      }
      .containerBackground(.fill.tertiary, for: .widget)
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Label("Wheely Weather", systemImage: "bicycle")
          .font(.headline)
        Text("Open app to load ride verdict")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(.fill.tertiary, for: .widget)
    default:
      VStack(alignment: .leading, spacing: 6) {
        Image(systemName: "bicycle")
          .font(.title2)
        Spacer(minLength: 0)
        Text("Open Wheely Weather to load today’s ride verdict.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(.fill.tertiary, for: .widget)
    }
  }

  private func smallContent(_ snapshot: WidgetSnapshot, _ verdict: Verdict) -> some View {
    verdictColumn(snapshot, verdict)
      .frame(maxWidth: .infinity, alignment: .leading)
      .foregroundStyle(entry.isStale ? Color.primary : Color.black)
      .containerBackground(for: .widget) {
        cardBackground(verdict)
      }
  }

  private func mediumContent(_ snapshot: WidgetSnapshot, _ verdict: Verdict) -> some View {
    let nextHours = snapshot.upcoming(after: entry.date, limit: 4)
    return HStack(spacing: 12) {
      verdictColumn(snapshot, verdict)
        .frame(maxWidth: .infinity, alignment: .leading)
      if !nextHours.isEmpty {
        HStack(spacing: 4) {
          ForEach(Array(nextHours.enumerated()), id: \.offset) { _, item in
            VStack(spacing: 6) {
              Text(item.at, format: .dateTime.hour())
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(Color.black.opacity(0.65))

              Image(systemName: item.verdict.symbol)
                .font(.system(size: 20, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .frame(height: 24)

              Text(item.verdict.temperature)
                .font(.system(size: 14, weight: .black, design: .rounded))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
          }
        }
        .padding(4)
        .background(Color.black.opacity(0.04))
        .overlay(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .stroke(Color.black.opacity(0.12), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .frame(width: 154)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .foregroundStyle(entry.isStale ? Color.primary : Color.black)
    .containerBackground(for: .widget) {
      cardBackground(verdict)
    }
  }

  private func verdictColumn(_ snapshot: WidgetSnapshot, _ verdict: Verdict) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline) {
        Image(systemName: verdict.symbol)
          .font(.system(size: 24, weight: .bold))
          .symbolRenderingMode(.hierarchical)
        Spacer(minLength: 4)
        Text(verdict.temperature)
          .font(.system(size: 26, weight: .black, design: .rounded))
      }
      Spacer(minLength: 0)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        // Without the color, a symbol says which way the playful headline
        // leans ("Your call" alone doesn't). The headline still says it in words.
        if renderingMode != .fullColor {
          Image(systemName: statusSymbol(verdict))
            .accessibilityHidden(true)
        }
        Text(verdict.headline)
          .lineLimit(2)
          .minimumScaleFactor(0.8)
      }
      .font(.system(size: 19, weight: .black, design: .rounded))
      .widgetAccentable()

      Text(verdict.detail)
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .lineLimit(1)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Color.black.opacity(0.88))
        .foregroundStyle(.white)
        .clipShape(Capsule())
        .padding(.top, 1)

      footer(snapshot)
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .opacity(0.75)
        .lineLimit(1)
        .padding(.top, 1)
    }
  }

  private func rectangularContent(_ snapshot: WidgetSnapshot, _ verdict: Verdict) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Image(systemName: statusSymbol(verdict))
          .accessibilityHidden(true)
        Text(verdict.headline)
          .font(.system(size: 15, weight: .black, design: .rounded))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 4)
        Text(verdict.temperature)
          .font(.system(size: 14, weight: .bold, design: .rounded))
      }
      .widgetAccentable()
      Text(verdict.detail)
        .font(.caption)
        .lineLimit(1)
      footer(snapshot)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .containerBackground(.fill.tertiary, for: .widget)
  }

  private func circularContent(_ verdict: Verdict) -> some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Image(systemName: statusSymbol(verdict))
          .font(.caption.weight(.bold))
          .widgetAccentable()
        Text(verdict.temperature)
          .font(.system(.callout, design: .rounded).weight(.bold))
          .minimumScaleFactor(0.7)
        Image(systemName: verdict.symbol)
          .font(.caption2)
      }
    }
    .containerBackground(.fill.tertiary, for: .widget)
  }

  @ViewBuilder
  private func cardBackground(_ verdict: Verdict) -> some View {
    if entry.isStale {
      Color.clear.background(.fill.tertiary)
    } else {
      statusColor(verdict)
    }
  }

  @ViewBuilder
  private func footer(_ snapshot: WidgetSnapshot) -> some View {
    if entry.isStale {
      Text("Updated \(snapshot.updatedAt, style: .relative) ago")
    } else if entry.isOldForecast {
      // Hours on, the verdicts are still the morning's forecast; say so.
      Text("Forecast from \(snapshot.updatedAt, style: .time)")
    } else {
      HStack(spacing: 3) {
        if snapshot.isCurrentLocation == true {
          Image(systemName: "location.fill")
            .imageScale(.small)
            .accessibilityLabel("Current location")
        }
        Text(snapshot.location)
      }
    }
  }

  private func statusSymbol(_ verdict: Verdict) -> String {
    if verdict.waiting == true { return "clock.fill" }
    switch verdict.status {
    case "yes": return "checkmark.circle.fill"
    case "maybe": return "questionmark.circle.fill"
    default: return "xmark.circle.fill"
    }
  }

  // Colorsets from expo-target.config.js, matching the verdict card.
  private func statusColor(_ verdict: Verdict) -> Color {
    if verdict.waiting == true { return Color("rideWait") }
    switch verdict.condition {
    case "good": return Color("rideYes")
    case "fair": return Color("rideFair")
    case "marginal": return Color("rideMaybe")
    case "poor": return Color("ridePoor")
    case "bad": return Color("rideNo")
    default: break
    }
    switch verdict.status {
    case "yes": return Color("rideYes")
    case "maybe": return Color("rideMaybe")
    default: return Color("rideNo")
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

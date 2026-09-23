import SwiftUI
import WidgetKit

// The widget can't run the app's TypeScript scoring, so the app rates the
// forecast and writes display-ready strings into the shared App Group
// (src/services/widgetStorage.ios.ts). Field names match `WidgetSnapshot` in
// src/utils/widgetSnapshot.ts.
struct WidgetSnapshot: Decodable {
  let status: String
  let headline: String
  let detail: String
  let temperature: String
  let symbol: String
  let location: String
  // Optional so a payload written by an older app build still decodes.
  let isCurrentLocation: Bool?
  let updatedAt: Date
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
  let isStale: Bool
}

struct VerdictProvider: TimelineProvider {
  // A verdict describes conditions when it was fetched; past this, stop
  // presenting it as current.
  static let staleAfter: TimeInterval = 3 * 60 * 60

  func placeholder(in context: Context) -> VerdictEntry {
    VerdictEntry(date: .now, snapshot: nil, isStale: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (VerdictEntry) -> Void) {
    completion(entry(at: .now, snapshot: SnapshotStore.load()))
  }

  // The app reloads the timeline whenever it writes a new verdict, so the only
  // scheduled change is the switch to the stale look.
  func getTimeline(in context: Context, completion: @escaping (Timeline<VerdictEntry>) -> Void) {
    let snapshot = SnapshotStore.load()
    var entries = [entry(at: .now, snapshot: snapshot)]
    if let snapshot {
      let staleAt = snapshot.updatedAt.addingTimeInterval(Self.staleAfter)
      if staleAt > .now {
        entries.append(entry(at: staleAt, snapshot: snapshot))
      }
    }
    completion(Timeline(entries: entries, policy: .never))
  }

  private func entry(at date: Date, snapshot: WidgetSnapshot?) -> VerdictEntry {
    let isStale = snapshot.map { date.timeIntervalSince($0.updatedAt) >= Self.staleAfter } ?? false
    return VerdictEntry(date: date, snapshot: snapshot, isStale: isStale)
  }
}

struct WheelyWidgetView: View {
  let entry: VerdictEntry

  var body: some View {
    if let snapshot = entry.snapshot {
      verdict(snapshot)
    } else {
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

  private func verdict(_ snapshot: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline) {
        Image(systemName: snapshot.symbol)
          .font(.title2)
        Spacer(minLength: 4)
        Text(snapshot.temperature)
          .font(.title2.weight(.bold))
      }
      Spacer(minLength: 0)
      Text(snapshot.headline)
        .font(.headline.weight(.heavy))
        .lineLimit(2)
        .minimumScaleFactor(0.8)
      Text(snapshot.detail)
        .font(.caption)
        .lineLimit(2)
      footer(snapshot)
        .font(.caption2)
        .opacity(0.7)
        .lineLimit(1)
        .padding(.top, 2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .foregroundStyle(entry.isStale ? Color.primary : Color.black)
    .containerBackground(for: .widget) {
      if entry.isStale {
        Color.clear.background(.fill.tertiary)
      } else {
        statusColor(snapshot.status)
      }
    }
  }

  @ViewBuilder
  private func footer(_ snapshot: WidgetSnapshot) -> some View {
    if entry.isStale {
      Text("Updated \(snapshot.updatedAt, style: .relative) ago")
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

  // Colorsets from expo-target.config.js, matching the verdict card.
  private func statusColor(_ status: String) -> Color {
    switch status {
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
    .supportedFamilies([.systemSmall])
  }
}

@main
struct WheelyWidgetBundle: WidgetBundle {
  var body: some Widget {
    WheelyWidget()
  }
}

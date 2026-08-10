import ExpoModulesCore
import MapKit

/// Wraps a completer so the delegate callbacks become a single closure call.
private final class CityCompleter: NSObject, MKLocalSearchCompleterDelegate {
  private let completer = MKLocalSearchCompleter()
  private var handler: (([MKLocalSearchCompletion], Error?) -> Void)?

  override init() {
    super.init()
    completer.delegate = self
    completer.resultTypes = .address
    // Cities, not house numbers: unfiltered address completions offer things
    // like "Rua do Campo da Bola 1" for "portl".
    if #available(iOS 18.0, *) {
      completer.addressFilter = MKAddressFilter(
        including: [.locality, .subLocality, .administrativeArea])
    }
  }

  func search(_ query: String, handler: @escaping ([MKLocalSearchCompletion], Error?) -> Void) {
    // A superseded query still has to settle, or its JS promise never returns.
    finish([], nil)
    self.handler = handler
    completer.queryFragment = query
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    finish(completer.results, nil)
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    finish([], error)
  }

  private func finish(_ results: [MKLocalSearchCompletion], _ error: Error?) {
    let pending = handler
    handler = nil
    pending?(results, error)
  }
}

/// City search in two stages. MKLocalSearch collapses a query to a single best
/// match — one "Springfield" out of the dozens — so suggestions come from
/// MKLocalSearchCompleter instead. Completions carry no coordinates and cannot
/// cross the bridge, so each is held here under an opaque id and resolved only
/// when the user picks one: one MapKit search per selection, not per keystroke.
public class AppleLocationSearchModule: Module {
  private let completer = CityCompleter()
  private var completions: [String: MKLocalSearchCompletion] = [:]
  private var completionIds: [String] = []
  private static let maxCachedCompletions = 100

  public func definition() -> ModuleDefinition {
    Name("AppleLocationSearch")

    AsyncFunction("search") { (query: String, promise: Promise) in
      let trimmed = query.trimmingCharacters(in: .whitespaces)
      guard !trimmed.isEmpty else {
        promise.resolve([])
        return
      }
      // MKLocalSearchCompleter is main-thread only.
      DispatchQueue.main.async {
        self.completer.search(trimmed) { completions, error in
          if let error = error as NSError?, error.code == MKError.Code.loadingThrottled.rawValue {
            promise.reject("SEARCH_THROTTLED", "Search rate limited, try again.")
            return
          }
          promise.resolve(self.cache(Array(completions.prefix(8))))
        }
      }
    }

    AsyncFunction("resolve") { (id: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let completion = self.completions[id] else {
          promise.reject("UNKNOWN_SUGGESTION", "That result is no longer available.")
          return
        }
        let search = MKLocalSearch(request: MKLocalSearch.Request(completion: completion))
        search.start { response, error in
          if let error = error as NSError?, error.code == MKError.Code.loadingThrottled.rawValue {
            promise.reject("SEARCH_THROTTLED", "Search rate limited, try again.")
            return
          }
          guard let placemark = response?.mapItems.first?.placemark else {
            promise.resolve(nil)
            return
          }
          let coordinate = placemark.coordinate
          guard coordinate.latitude != 0 || coordinate.longitude != 0 else {
            promise.resolve(nil)
            return
          }
          promise.resolve(["lat": coordinate.latitude, "lon": coordinate.longitude])
        }
      }
    }
  }

  /// Holds completions retrievable by id, bounded so a long session cannot grow
  /// the map without limit.
  private func cache(_ results: [MKLocalSearchCompletion]) -> [[String: Any]] {
    return results.map { completion in
      let id = UUID().uuidString
      completions[id] = completion
      completionIds.append(id)
      if completionIds.count > Self.maxCachedCompletions {
        let stale = completionIds.removeFirst()
        completions.removeValue(forKey: stale)
      }
      return [
        "id": id,
        "label": completion.title,
        "displayName": completion.subtitle,
      ]
    }
  }
}

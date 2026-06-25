import ExpoModulesCore
import MapKit

public class AppleLocationSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleLocationSearch")

    AsyncFunction("search") { (query: String, promise: Promise) in
      guard !query.trimmingCharacters(in: .whitespaces).isEmpty else {
        promise.resolve([])
        return
      }

      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.resultTypes = [.address, .pointOfInterest]

      let search = MKLocalSearch(request: request)
      search.start { response, error in
        if let error = error as NSError?, error.code == MKError.Code.loadingThrottled.rawValue {
          // Surface throttle so JS can show "try again" messaging
          promise.reject("SEARCH_THROTTLED", "Search rate limited, try again.")
          return
        }
        guard let items = response?.mapItems else {
          promise.resolve([])
          return
        }

        let results: [[String: Any]] = items.prefix(8).compactMap { item in
          let placemark = item.placemark
          let lat = placemark.coordinate.latitude
          let lon = placemark.coordinate.longitude
          guard lat != 0 || lon != 0 else { return nil }

          // Build a concise label: "Name, City, State" or "City, State"
          let poiName = item.name ?? ""
          let locality = placemark.locality ?? ""
          let adminArea = placemark.administrativeArea ?? ""
          let country = placemark.country ?? ""

          var labelParts: [String] = []
          // Only prepend the POI name if it's meaningfully different from the city
          if !poiName.isEmpty && poiName != locality {
            labelParts.append(poiName)
          }
          if !locality.isEmpty {
            labelParts.append(locality)
          }
          // Prefer short region code (NC) over country name when admin area present
          if !adminArea.isEmpty {
            labelParts.append(adminArea)
          } else if !country.isEmpty {
            labelParts.append(country)
          }
          let label = labelParts.isEmpty ? (item.name ?? "") : labelParts.joined(separator: ", ")

          // Full display name from the placemark's formatted address
          let displayName = placemark.title ?? label

          return [
            "lat": lat,
            "lon": lon,
            "label": label,
            "displayName": displayName,
          ]
        }
        promise.resolve(results)
      }
    }
  }
}

import ExpoModulesCore
import WeatherKit
import CoreLocation

// Bridges Apple WeatherKit into the app's Open-Meteo-shaped wire format
// (src/services/weatherService.ts's `OpenMeteoData`), so the existing
// normalization pipeline runs unchanged for iOS. Condition is bridged as
// WeatherKit's raw `WeatherCondition.rawValue` string (e.g. "heavyRain"),
// not a WMO code — the WMO translation is a pure, unit-tested TS function
// (src/domain/weatherkit-codes.ts) applied in weatherService.ios.ts, not here.
public class AppleWeatherKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleWeatherKit")

    AsyncFunction("forecast") { (lat: Double, lon: Double, promise: Promise) in
      Task {
        do {
          let location = CLLocation(latitude: lat, longitude: lon)
          let timeZone = await Self.resolveTimeZone(for: location)
          let dateTimeFormatter = Self.makeFormatter(timeZone: timeZone, dateOnly: false)
          let dateFormatter = Self.makeFormatter(timeZone: timeZone, dateOnly: true)

          let (current, hourlyForecast, dailyForecast) = try await WeatherService.shared.weather(
            for: location,
            including: .current, .hourly, .daily
          )

          let currentDict: [String: Any?] = [
            "time": dateTimeFormatter.string(from: current.date),
            "temperature_2m": Self.fahrenheit(current.temperature),
            "apparent_temperature": Self.fahrenheit(current.apparentTemperature),
            "wind_speed_10m": Self.mph(current.wind.speed),
            "wind_gusts_10m": current.wind.gust.map(Self.mph),
            "dewpoint_2m": Self.fahrenheit(current.dewPoint),
            "condition": current.condition.rawValue,
            "wind_direction_10m": current.wind.direction.converted(to: .degrees).value,
          ]

          var hourlyTime: [String] = []
          var hourlyTemp: [Double] = []
          var hourlyApparent: [Double] = []
          var hourlyWind: [Double] = []
          var hourlyGust: [Double?] = []
          var hourlyPrecip: [Double] = []
          var hourlyCondition: [String] = []
          var hourlyDewpoint: [Double] = []
          var hourlyUv: [Int] = []

          // .hourly returns 25 contiguous hours starting at the current hour —
          // plenty for parseHourly's 24-forward-hour window; no clipping needed.
          for hour in hourlyForecast {
            hourlyTime.append(dateTimeFormatter.string(from: hour.date))
            hourlyTemp.append(Self.fahrenheit(hour.temperature))
            hourlyApparent.append(Self.fahrenheit(hour.apparentTemperature))
            hourlyWind.append(Self.mph(hour.wind.speed))
            hourlyGust.append(hour.wind.gust.map(Self.mph))
            hourlyPrecip.append(hour.precipitationChance * 100)
            hourlyCondition.append(hour.condition.rawValue)
            hourlyDewpoint.append(Self.fahrenheit(hour.dewPoint))
            hourlyUv.append(hour.uvIndex.value)
          }

          var dailyTime: [String] = []
          var dailySunrise: [String] = []
          var dailySunset: [String] = []
          var dailyApparentMax: [Double] = []
          var dailyTempMax: [Double] = []
          var dailyTempMin: [Double] = []
          var dailyWindMax: [Double] = []
          var dailyGustMax: [Double?] = []
          var dailyPrecipMax: [Double] = []
          var dailyCondition: [String] = []
          var dailyUvMax: [Int] = []

          // .daily returns 10 contiguous days; clip to 8 to match Open-Meteo's
          // forecast_days=8 so the daily forecast list is the same length cross-platform.
          for day in dailyForecast.prefix(8) {
            dailyTime.append(dateFormatter.string(from: day.date))
            dailySunrise.append(day.sun.sunrise.map { dateTimeFormatter.string(from: $0) } ?? "")
            dailySunset.append(day.sun.sunset.map { dateTimeFormatter.string(from: $0) } ?? "")
            // DayWeather has no daily "feels like" high (no apparentTemperature
            // property) — fall back to the actual high rather than omitting the field.
            dailyApparentMax.append(Self.fahrenheit(day.highTemperature))
            dailyTempMax.append(Self.fahrenheit(day.highTemperature))
            dailyTempMin.append(Self.fahrenheit(day.lowTemperature))
            let windMax: Measurement<UnitSpeed>
            if #available(iOS 18.0, *) {
              windMax = day.highWindSpeed ?? day.wind.speed
            } else {
              windMax = day.wind.speed
            }
            dailyWindMax.append(Self.mph(windMax))
            dailyGustMax.append(day.wind.gust.map(Self.mph))
            dailyPrecipMax.append(day.precipitationChance * 100)
            dailyCondition.append(day.condition.rawValue)
            dailyUvMax.append(day.uvIndex.value)
          }

          let result: [String: Any] = [
            "utc_offset_seconds": timeZone.secondsFromGMT(),
            "current": currentDict,
            "hourly": [
              "time": hourlyTime,
              "temperature_2m": hourlyTemp,
              "apparent_temperature": hourlyApparent,
              "wind_speed_10m": hourlyWind,
              "wind_gusts_10m": hourlyGust,
              "precipitation_probability": hourlyPrecip,
              "condition": hourlyCondition,
              "dewpoint_2m": hourlyDewpoint,
              "uv_index": hourlyUv,
            ],
            "daily": [
              "time": dailyTime,
              "sunrise": dailySunrise,
              "sunset": dailySunset,
              "apparent_temperature_max": dailyApparentMax,
              "temperature_2m_max": dailyTempMax,
              "temperature_2m_min": dailyTempMin,
              "wind_speed_10m_max": dailyWindMax,
              "wind_gusts_10m_max": dailyGustMax,
              "precipitation_probability_max": dailyPrecipMax,
              "condition": dailyCondition,
              "uv_index_max": dailyUvMax,
            ],
          ]
          promise.resolve(result)
        } catch {
          promise.reject("WEATHERKIT_ERROR", error.localizedDescription)
        }
      }
    }

    AsyncFunction("alerts") { (lat: Double, lon: Double, promise: Promise) in
      Task {
        do {
          let location = CLLocation(latitude: lat, longitude: lon)
          let alerts = try await WeatherService.shared.weather(for: location, including: .alerts)
          let results: [[String: Any?]] = (alerts ?? []).map { alert in
            [
              "summary": alert.summary,
              "severity": Self.severityString(alert.severity),
              "source": alert.source,
              "region": alert.region,
              "detailsURL": alert.detailsURL.absoluteString,
              "expirationDate": ISO8601DateFormatter().string(from: alert.metadata.expirationDate),
            ]
          }
          promise.resolve(results)
        } catch {
          promise.reject("WEATHERKIT_ERROR", error.localizedDescription)
        }
      }
    }

    AsyncFunction("attribution") { (promise: Promise) in
      Task {
        do {
          let attribution = try await WeatherService.shared.attribution
          promise.resolve([
            "logoLightURL": attribution.combinedMarkLightURL.absoluteString,
            "logoDarkURL": attribution.combinedMarkDarkURL.absoluteString,
            "legalPageURL": attribution.legalPageURL.absoluteString,
          ])
        } catch {
          promise.reject("WEATHERKIT_ERROR", error.localizedDescription)
        }
      }
    }
  }

  private static func fahrenheit(_ measurement: Measurement<UnitTemperature>) -> Double {
    measurement.converted(to: .fahrenheit).value
  }

  private static func mph(_ measurement: Measurement<UnitSpeed>) -> Double {
    measurement.converted(to: .milesPerHour).value
  }

  // WeatherSeverity isn't RawRepresentable — its `description` is a localized
  // sentence, not a stable identifier, so map explicitly instead.
  private static func severityString(_ severity: WeatherSeverity) -> String {
    switch severity {
    case .minor: return "minor"
    case .moderate: return "moderate"
    case .severe: return "severe"
    case .extreme: return "extreme"
    case .unknown: return "unknown"
    @unknown default: return "unknown"
    }
  }

  // Open-Meteo's `timezone=auto` returns naive local-time strings, which the
  // existing parser (weatherService.ts) relies on for hour/date matching.
  // WeatherKit has no timezone-aware string output, so resolve one via
  // reverse geocoding and format Dates into the same naive convention.
  private static func resolveTimeZone(for location: CLLocation) async -> TimeZone {
    let geocoder = CLGeocoder()
    if let placemarks = try? await geocoder.reverseGeocodeLocation(location),
      let timeZone = placemarks.first?.timeZone {
      return timeZone
    }
    return TimeZone.current
  }

  private static func makeFormatter(timeZone: TimeZone, dateOnly: Bool) -> DateFormatter {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = timeZone
    formatter.dateFormat = dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"
    return formatter
  }
}

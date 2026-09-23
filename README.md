# Wheely Weather

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://github.com/noahzm/wheely-weather/actions/workflows/ci.yml/badge.svg)](https://github.com/noahzm/wheely-weather/actions)
[![Built with Expo](https://img.shields.io/badge/Built_with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev/)

A cyclist-first weather app for iOS, Android, and the web. Live at [wheelyweather.app](https://wheelyweather.app).

<p>
  <img src="./assets/images/screenshot-ideal.png" alt="Home screen, ideal ride conditions" width="45%" />
  <img src="./assets/images/screenshot-poor.png" alt="Home screen, poor ride conditions" width="45%" />
</p>

## Features

- **Ride verdict**: a 0–5 star score and a go / maybe / skip call from temperature, wind and gusts, rain, dew point, AQI, UV, and daylight
- **Hourly and 8-day ratings**: every hour and day rated Good to Bad, with a one-line reason and the week's best ride day
- **Kit picks**: what to wear, for Casual or Roadie riders
- **Heat acclimatization**: heat limits rise if you live somewhere hot and ride outdoors a lot
- **Locations**: search, pinned places, and a current-location mode that follows you
- **Alerts**: severe weather and air quality warnings

## Tech stack

|                 | iOS              | Web & Android                                 |
| --------------- | ---------------- | --------------------------------------------- |
| **Weather**     | Apple WeatherKit | Open-Meteo                                    |
| **Search**      | Apple MapKit     | Nominatim (web via a Cloudflare Worker proxy) |
| **Alerts**      | WeatherKit       | US National Weather Service                   |
| **Air quality** | Open-Meteo       | Open-Meteo                                    |

Built with Expo SDK 57, Expo Router, React Native 0.86, and React 19 (React Compiler on). Hosted on Cloudflare, errors reported to Sentry.

## Getting started

Requires Node 24+. iOS needs Xcode, since WeatherKit and MapKit don't run in Expo Go.

```bash
npm install
cp .env.example .env   # optional: Sentry DSN
npm run web            # or: npm run ios / npm run android
```

## Commands

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run check`         | Everything CI runs: format, lint, types, tests, build |
| `npm test`              | Unit tests                                            |
| `npm run test:coverage` | Unit tests with coverage floors                       |
| `npm run ios:clean`     | Regenerate the native iOS project and run             |

## Project structure

```
src/
├── app/         # Screens (Expo Router)
├── components/  # UI
├── domain/      # Scoring, acclimatization, gear logic
├── hooks/       # Forecast, location, and theme state
├── services/    # Weather and geocoding, per platform
└── utils/       # Formatters and chart math
modules/         # Native iOS modules (WeatherKit, MapKit)
workers/         # Cloudflare Worker (geocoding proxy)
```

## Deployment

- **Web**: every push to `main` deploys to Cloudflare.
- **iOS**: built and submitted with EAS (`npm run eas:build:ios-prod`).

## More

[`AGENTS.md`](./AGENTS.md) (architecture and conventions) · [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`SECURITY.md`](./SECURITY.md) · [MIT License](./LICENSE)

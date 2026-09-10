# Wheely Weather

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://github.com/noahzm/wheely-weather/actions/workflows/ci.yml/badge.svg)](https://github.com/noahzm/wheely-weather/actions)
[![Built with Expo](https://img.shields.io/badge/Built_with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev/)

Wheely Weather is an opinionated, cyclist-first weather forecasting application live at [wheelyweather.app](https://wheelyweather.app). Built with [Expo Router](https://docs.expo.dev/router/introduction) for iOS, Android, and the web, it pairs rigorous cycling-specific meteorology with a liquid-glass, neobrutalist interface.

## Overview

General-purpose weather apps focus on rain umbrellas and raw temperatures. Wheely Weather evaluates atmospheric conditions from the perspective of someone on two wheels: assessing wind gusts against sustained headwinds, dew point against perceived cooling, daylight margins, and temperature swings across an upcoming ride window.

## Key Features

- **Intelligent Ride Scoring**: Evaluates air temperature, feels-like temperature, sustained wind and gusts, precipitation probability, dew point, air quality (AQI), UV index, and sunset timing to produce a 0 to 5 star rating and actionable verdict (Ideal, Good, Fair, Poor, or Don't Ride).
- **Home Climate Acclimatization**: Contextualizes temperature comfort bounds against a configurable home climate baseline, ensuring early-season cool rides and late-summer heat waves are scored according to seasonal adaptation.
- **Dynamic Kit Recommendations**: Delivers gear suggestions tailored to ride discipline (Casual or Roadie). Recommends tops, bottoms, and packable accessories (wind vests, arm warmers, shoe covers, rain capes) using a shared-grid layout and custom silhouette iconography.
- **Hour-by-Hour Ride Window Finder**: An interactive timeline highlights condition shifts and pinpoints the optimal departure window, complete with condition stickers for sudden rain or heavy gusts.
- **Seven-Day Outlook**: Multi-day outlook with tabular temperature spreads, condition badges, and automated detection of the week's best ride day.
- **Fast Geocoding & Pinned Locations**: Instant location search with quick-switch pinned bar and automatic fallback to device GPS.
- **Severe Weather & Atmospheric Alerts**: Directly integrates active meteorological advisories, air quality warnings, and hazardous condition banners.
- **Platform-Native Architecture**: Uses native Apple WeatherKit and Apple MapKit on iOS; uses Open-Meteo APIs proxied through Cloudflare Workers on web and Android.

## Screenshots

![Wheely Weather Home Screen - Ideal Ride Conditions](./assets/images/screenshot-ideal.png)
![Wheely Weather Detail Screen - Poor Ride Conditions](./assets/images/screenshot-poor.png)

## Tech Stack

- **Framework**: [Expo SDK 57](https://expo.dev/) and [Expo Router](https://docs.expo.dev/router/introduction) (React Native 0.86, React 19 with React Compiler enabled)
- **Design System**: Neobrutalist liquid-glass design system with custom palette tokens (`useWheelyColors`), `expo-glass-effect`, and vector iconography
- **Meteorology & Geocoding**:
  - **iOS**: Apple WeatherKit (`modules/apple-weatherkit`) and Apple MapKit (`modules/apple-location-search`)
  - **Web & Android**: Open-Meteo API suite and Nominatim reverse geocoding proxied through a Cloudflare Worker (`workers/index.mjs`)
- **State & Architecture**: Centralized `ForecastProvider` pipeline with asynchronous secondary data hydration (alerts, air quality) and cached snapshot hydration
- **Testing & Quality Assurance**: Vitest (unit testing with strict domain coverage thresholds), Playwright (E2E browser tests), ESLint 9 (type-aware), Prettier, and TypeScript

## Project Structure

```
wheely-weather/
├── assets/             # Fonts, application icons, and static graphics
├── modules/            # Native iOS Swift modules (Apple WeatherKit & MapKit)
├── src/
│   ├── app/            # Expo Router filesystem routing (tabs, screens, modals)
│   ├── components/     # UI primitives and themed Wheely components
│   ├── constants/      # Design system tokens, typography, and palettes
│   ├── domain/         # Framework-agnostic scoring, acclimatization, and gear algorithms
│   ├── hooks/          # React hooks for forecast state, location, and theme
│   ├── services/       # Platform-specific weather and geocoding services
│   ├── types/          # TypeScript domain and application interfaces
│   └── utils/          # Pure helper utilities, formatters, and chart math
└── workers/            # Cloudflare Worker for web geocoding proxy and headers
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Node 24 LTS recommended)
- npm

### Installation

```bash
npm install
```

### Development Commands

| Command             | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| `npm run web`       | Start the local Metro web development server                                            |
| `npm run ios`       | Build, install, and run the native iOS development build                                |
| `npm run ios:clean` | Regenerate native iOS project and run development client                                |
| `npm run android`   | Run Android development build                                                           |
| `npm run build:web` | Export the static web production build (`expo export --platform web`)                   |
| `npm run check`     | Run the full validation suite locally (format, lint, typecheck, unit tests, web export) |

## Quality Gates

The continuous integration pipeline (`.github/workflows/ci.yml`) validates pull requests against these gates in order:

```bash
npm run format:check   # Prettier code formatting check
npm run lint           # ESLint with zero warnings allowed (--max-warnings 0)
npm run typecheck      # TypeScript compilation check (tsc --noEmit)
npm test               # Vitest unit test suite
npm run build:web      # Static web bundle export verification
```

- **Coverage**: Run `npm run test:coverage` to verify unit test coverage across domain logic (enforces 90% repository-wide, 95% across `src/domain`).
- **End-to-End**: Run `npm run test:e2e:app` for Playwright browser testing against the exported production web build (`dist/`).

## Architecture & Contributing

- **Architecture & Task Playbooks**: Detailed system design, platform resolution rules, and agent conventions are documented in [`AGENTS.md`](./AGENTS.md).
- **Contributing**: Review [`CONTRIBUTING.md`](./CONTRIBUTING.md) for pull request workflows and branch standards.
- **Security**: Security vulnerability disclosure policies are outlined in [`SECURITY.md`](./SECURITY.md).

## License

This project is licensed under the [MIT License](./LICENSE).

# Wheely Weather

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://github.com/noahzm/wheely-weather/actions/workflows/ci.yml/badge.svg)](https://github.com/noahzm/wheely-weather/actions)
[![Built with Expo](https://img.shields.io/badge/Built_with-Expo-000020.svg?logo=expo&logoColor=white)](https://expo.dev/)

Wheely Weather scores how good conditions are for a bike ride, live at [wheelyweather.app](https://wheelyweather.app). It's an [Expo Router](https://docs.expo.dev/router/introduction) app for iOS, Android, and web with a liquid-glass, neobrutalist look.

## Features

- 🚴 **Ride scoring** that weighs temperature, wind and gusts, rain, weather conditions, dewpoint, AQI, and UV
- 👕 **Dynamic kit recommendations** based on temperature and wind
- 📈 **Hourly micro-forecasts** and interactive charting
- 📱 **Cross-platform** support for iOS, Android, and Web

## Screenshots

![Wheely Weather Home Screen - Ideal Ride Conditions](./assets/images/screenshot-ideal.png)
![Wheely Weather Detail Screen - Poor Ride Conditions](./assets/images/screenshot-poor.png)

## Getting started

### Prerequisites

- Node.js (LTS recommended)
- npm or yarn

### Installation

```bash
npm install
```

| Command                                           | Description                                               |
| ------------------------------------------------- | --------------------------------------------------------- |
| `npm run web` / `npm run ios` / `npm run android` | Run the app (`ios` builds/installs and starts dev server via Expo) |
| `npm run ios:install`                             | Build/install the iOS development app without starting Metro |
| `npm run ios:start`                               | Launch an already installed iOS development build (default LAN host) |
| `npm run ios:start:localhost`                     | Relaunch dev build with localhost host mode |
| `npm run ios:start:tunnel`                        | Relaunch dev build with tunnel host mode |
| `npm run ios:clean`                               | Clean native iOS regeneration + build/install + launch |
| `npm run storybook:web`                           | Component workshop at http://localhost:6006               |
| `npm run build:web`                               | Export the web build (`expo export --platform web`)       |
| `npm run deploy:web`                              | Build then deploy the web build via Wrangler (Cloudflare) |

## Quality gates

Mirrors CI (`.github/workflows/ci.yml`), run in this order:

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test
npm run build:web
```

`npm run test:e2e` (Playwright against Storybook) and `npm run test:e2e:app` (Playwright against the exported web app) aren't part of CI and are run manually.

If iOS dev client cannot connect to Metro, retry with:

```bash
npm run ios:start:localhost
# or
npm run ios:start:tunnel
```

## Architecture

For architecture, conventions, and toolchain constraints used in this repo, see [`.github/copilot-instructions.md`](./.github/copilot-instructions.md).

## Contributing and security

- Contribution guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)

## Using GitHub Copilot in this repo

- Start with [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for architecture, conventions, and task playbooks.
- Copilot cloud agent sessions should use [`.github/copilot-setup-steps.yml`](./.github/copilot-setup-steps.yml) to install dependencies and pre-run baseline checks.
- Keep edits narrow and scoped, then run quality gates in CI order:
  `npm run format:check` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build:web`.

## License

MIT — see [`LICENSE`](./LICENSE).

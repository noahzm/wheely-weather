# Copilot Instructions for Wheely Weather

## Build, test, and lint commands

Run from the repository root.

| Command                                                          | Purpose                                          |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `npm run format:check`                                           | Prettier check (CI gate)                         |
| `npm run lint`                                                   | ESLint with `--max-warnings 0` (CI gate)         |
| `npx tsc --noEmit`                                               | TypeScript typecheck (CI gate)                   |
| `npm test`                                                       | Unit tests (`vitest run --project unit`)         |
| `npx vitest run --project unit src/domain/weather-codes.test.ts` | Run one unit test file                           |
| `npm run build:web`                                              | Expo web export (CI gate)                        |
| `npm run test:e2e`                                               | Playwright E2E against Storybook (manual)        |
| `npm run test:e2e:app`                                           | Playwright E2E against exported web app (manual) |

CI order in `.github/workflows/ci.yml`: `npm ci` → `npm run format:check` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build:web`.

## High-level architecture

- The app is Expo Router with platform-specific tab layout behavior:
  - `src/app/_layout.tsx` is the root composition: `SettingsProvider` → themed root (`ThemeProvider` + appearance override) → `ForecastProvider` → router stack.
  - Web adds a fixed `BottomNavBar` in root layout; native uses `expo-router/unstable-native-tabs` in `src/app/(tabs)/_layout.tsx`, while web tabs use `src/app/(tabs)/_layout.web.tsx`.
- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`) and consumed via `useForecast()`.
  - `useWeatherForecast` (`src/hooks/use-weather-forecast.ts`) orchestrates loading, refresh, location actions, snapshot cache hydration/persistence, and stale refresh behavior.
  - `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) builds the UI snapshot by fetching weather data, home-climate baseline, and location label, then returning slower extras (AQI/alerts) separately for post-first-paint merge.
- Services split by platform:
  - Default weather/geocoding use Open-Meteo + Nominatim paths.
  - iOS shadows these with `weatherService.ios.ts` (WeatherKit) and `locationSearch.ios.ts` (MapKit native module).
  - `workers/index.mjs` is the Cloudflare Worker backing web geocode proxying.
- Domain logic is framework-agnostic in `src/domain` and powers ride scoring and copy used by UI layers.

## Key conventions

- Import shared Wheely UI primitives from `@/components/wheely/primitives`, not `@/components/wheely` barrel.
- Theme rules are strict: no inline style color literals; use `useWheelyColors()` and theme tokens from `src/constants/theme.ts`.
- React Compiler is enabled (`app.json`), so do not add manual `useMemo`/`useCallback` for performance-only reasons.
- Path aliases are standard: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Mock scenarios (`?mock=ride|maybe|rest|alert`) are intentionally latched in `ForecastProvider` so tab navigation does not clear them.
- iOS weather/location modules do not fall back to web APIs when native modules are unavailable; they fail with rebuild-required errors.
- In `weatherService.ios.ts`, shared parsing must be imported from `weatherParsing.ts` (not `weatherService.ts`) to avoid iOS platform-resolution recursion.
- Sentry initialization is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`), and native builds may require `SENTRY_DISABLE_AUTO_UPLOAD=true` when upload credentials are not configured.
- If making structural or logic changes to `src/domain/scoring.ts`, get user approval first.
- When adding a new pure function in `src/utils` or `src/domain`, add a colocated unit test.
- After modifying files in `src/domain`, run `npm test`.

## Copilot task playbooks

Use these task flows to keep prompts concrete and keep validation tight.

### 1) UI change in `src/components` or `src/app`

1. Ask Copilot to locate the exact component/screen and adjacent primitives first.
2. Require theme-token usage (`useWheelyColors`, `src/constants/theme.ts`) and no inline color literals.
3. Ask Copilot to list touched files before editing, then apply surgical edits only.
4. Validate with `npm run lint` and run the smallest relevant tests.

### 2) Domain or utility logic change

1. Ask Copilot to identify all call sites for the function or constant before editing.
2. Keep logic framework-agnostic in `src/domain`/`src/utils`.
3. Add/update colocated unit tests for new pure functions.
4. After domain edits, run `npm test`.

### 3) Platform-specific service change (iOS/web/native differences)

1. Ask Copilot to inspect both default and platform-specific files (`*.ios.ts*`, `*.web.ts*`, shared file).
2. Preserve the no-fallback rule for iOS weather/location native modules.
3. For `weatherService.ios.ts`, import shared parsing from `weatherParsing.ts`, never `weatherService.ts`.
4. Validate with `npx tsc --noEmit` plus targeted tests.

### 4) Safe completion checklist for generated changes

1. `npm run format:check`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build:web`

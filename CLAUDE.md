# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For the full architecture, conventions, and toolchain reference, see [`.agents/AGENTS.md`](./.agents/AGENTS.md) — this file summarizes it plus Claude Code-specific notes. Keep both in sync when either changes.

## What this is

Wheely Weather is an Expo Router + React Native app (iOS, Android, web) that scores how good conditions are for a bike ride, live at wheelyweather.app. The look is a layered system: a flat theme background, **liquid-glass** chrome (`expo-glass-effect`), neobrutalist **`BrutalCard`** content surfaces, and the **National Park** typeface. When something looks "off," compare against this design intent.

This app runs **Expo 57**. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code that touches Expo APIs — behavior drifts fast between major versions.

## Agent behavioral constraints

- When adding a new pure function to `src/utils` or `src/domain`, write a corresponding unit test.
- After modifying any file in `src/domain`, run `npm test` to verify no regressions.
- Never use inline styles or raw hex codes; use the `useWheelyColors()` palette (`react-native/no-color-literals` is an ESLint error).
- If making structural or logic changes to `src/domain/scoring.ts`, ask for user approval first.

## Commands

- `npm run web` / `npm run ios` / `npm run android` — run the app (Expo).
- `npm run storybook:web` — component workshop at http://localhost:6006 (the primary surface for reviewing UI).
- `npm run storybook:ios` / `npm run storybook:android` — Storybook on device/simulator.
- `npm run build-storybook` — build the static Storybook; verifies web bundling (lucide, `@fontsource`, `react-native-svg`).
- `npm run lint` — ESLint via `expo lint -- --max-warnings 0`.
- `npm run format` / `npm run format:check` — Prettier.
- `npm test` — unit tests (`vitest run --project unit`).
- `npx vitest run --project unit src/domain/weather-codes.test.ts` — run a single test file.
- `npx tsc --noEmit` — typecheck.
- `npm run build:web` — `expo export --platform web`; the CI "web export" gate.
- `npm run deploy:web` — `npm run build:web && wrangler deploy` (Cloudflare Workers + static assets).
- `npm run test:e2e` / `npm run test:e2e:app` — Playwright against Storybook / the exported web app. Not part of CI, run manually.

CI (`.github/workflows/ci.yml`, single job, `ubuntu-latest`, Node 24) runs in order: `npm ci` → `npm run format:check` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build:web`. It stops at the first failing gate — use the `run-checks` skill to mirror this locally before pushing.

### Testing notes

- `npm test` runs only the `unit` Vitest project (Node env): `src/**/*.{test,spec}.{js,ts,tsx}`, excluding `src/stories/**`/`*.stories.*`. Pure domain/utils logic lives here, colocated as `*.test.ts` next to its source.
- A second Vitest project, `storybook`, runs stories in a real browser via Playwright (chromium). Needs `npx playwright install`; not run by `npm test` or CI. In restricted/sandboxed environments it fails to launch Chromium — prefer `--project unit` there.

## Toolchain constraints

- **Path aliases**: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`.
- **React Compiler** enabled (`app.json` `experiments.reactCompiler: true`) — don't add manual `useMemo`/`useCallback` for performance.
- **TypeScript strict** (extends `expo/tsconfig.base`): `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. Index access returns `T | undefined`. Type-aware ESLint rules run against `tsconfig.eslint.json`, which additionally includes test files.
- **ESLint** (flat config): `eslint-config-expo/flat`, `typescript-eslint` (`strictTypeChecked` + `stylisticTypeChecked`), `eslint-plugin-unicorn`, `eslint-plugin-sonarjs`, `eslint-plugin-react-native`. `--max-warnings 0` in CI means every rule is a hard error. Complexity caps: `complexity: 20`, `max-depth: 4`, `max-params: 5`, `max-lines: 700`, `max-lines-per-function: 120` (test files exempt from the last two).

## Architecture

- **`src/app/`** — Expo Router routes under a `(tabs)` group: `(home)`, `location`, `settings`. Root `_layout.tsx` wraps everything in `SettingsProvider`, resolves the active scheme (`ThemedRoot`), and nests `ForecastProvider`. Web additionally renders a fixed `BottomNavBar`; native uses `expo-router/unstable-native-tabs`.
- **`src/components/wheely/`** — Presentational components. `primitives.tsx` has shared primitives (`BrutalCard`, `brutalShadow`, `HapticPressable`, etc.) — **import from `@/components/wheely/primitives`, not the barrel**. Screen sections: `weather-header`, `ride-verdict`, `weather-alerts`, `hourly-forecast`, `kit-guide`, `ride-specs`, `daily-forecast`, `status`. Chrome: `glass-chrome`, `home-nav-chrome`, `bottom-nav-chrome`, `web-screen-header`, `content-column`.
- **`src/domain/`** — Weather scoring + copy (framework-agnostic TypeScript). `acclimatization.ts` shifts comfort thresholds based on home climate baseline.
- **`src/services/`** — `homeClimate.ts` (30-day Open-Meteo baseline), `weatherService.ts`/`weatherService.ios.ts` (live API, platform-split — see below), `forecastSnapshot.ts` (load/normalize entry point), `forecastCache.ts`/`forecastCacheCodec.ts` (AsyncStorage last-known-good forecast), `locationSearch.ts`/`locationSearch.ios.ts` (geocoding, platform-split), `mockWeather.ts` (fixtures for `?mock=`), `locationStorage.ts`/`settingsCodec.ts` (AsyncStorage), `telemetry.ts` (Sentry).
- **`workers/index.mjs`** — Cloudflare Worker backing the web build; proxies `/api/geocode` to Nominatim.
- **`modules/apple-location-search`** / **`modules/apple-weatherkit`** — Custom Expo native modules wrapping Apple's `MKLocalSearch` and WeatherKit on iOS.
- **`src/hooks/`** — `use-weather-forecast.ts` (core forecast-loading hook), `settings-context.tsx` (`SettingsProvider`), `use-theme.ts`.
- **`src/constants/theme.ts`** — Palette + typography source of truth.
- **`src/types/`** — `weather.ts`, `settings.ts`: shared domain/settings types imported as `@/types/weather`, `@/types/settings`.

### Data flow

`useWeatherForecast(mockScenario)` manages fetch + location state, exposed app-wide via `ForecastProvider`/`useForecast()` (`src/hooks/forecast-context.tsx`). `getForecastSnapshot()` resolves acclimatization context via `homeClimate.ts` before the weather fetch and bakes adjusted thresholds into the snapshot; mock scenarios bypass acclimatization.

App-wide **settings** (gear mode, appearance preference, home location, temperature unit) flow through `SettingsProvider`, the outermost provider in `_layout`. Don't create standalone store hooks with their own `useState` for these — isolated state means a Settings toggle never reaches the theme or kit guide.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of the live API. `ForecastProvider` reads `useGlobalSearchParams().mock`, validates it, and **latches** the last-seen value in state (RN tab navigation drops query params on switch). Flows: latched value → `useWeatherForecast` → `loadForecastData` → `getForecastSnapshot`, which delegates to `mockWeather.ts`.

### iOS native data sources

On iOS, `weatherService.ios.ts` and `locationSearch.ios.ts` shadow the default Open-Meteo/Nominatim implementations with native WeatherKit/MapKit calls (`modules/apple-weatherkit`, `modules/apple-location-search`). Both return `null`/throw until a native rebuild links the module — there's no automatic fallback to the web APIs. **Gotcha:** `weatherService.ios.ts` must import shared parsing helpers from `weatherParsing.ts`, never from `weatherService.ts` — Metro's platform resolution would resolve `./weatherService` back to `weatherService.ios.ts` itself on iOS, causing infinite recursion.

### Observability (Sentry)

`src/services/telemetry.ts` wraps `@sentry/react-native`. `initSentry()` runs once at root-layout module load and is a no-op without `EXPO_PUBLIC_SENTRY_DSN` set (see `.env.example`); `sentryEnabled` gates `Sentry.wrap(RootLayout)` so the app isn't wrapped with an uninitialized client (avoids a spurious warning on every dev launch). Use `captureError(error, context?)` to surface failures from paths that intentionally swallow errors (AsyncStorage, forecast cache, settings) without changing their fallback behavior. Native builds also run Sentry's Xcode/Gradle source-map upload phase — set `SENTRY_DISABLE_AUTO_UPLOAD` (a real env var, not just `.env.sentry-build-plugin`) to skip it locally without an auth token.

## Conventions

### Theming (light/dark)

- Colors live in `WheelyTheme.{light,dark}` (`src/constants/theme.ts`), typed as `WheelyPalette`. Get colors via `useWheelyColors()`, build styles with `makeStyles(c: WheelyPalette)`, memoized via `useStyles()`.
- Active scheme resolves through `useColorSchemeName()` (`ColorSchemeOverrideContext` → OS scheme). Storybook drives it from the "Theme" toolbar.
- In-app **appearance preference** (`useAppearance()`: `'light'|'dark'|'system'`) overrides the OS scheme app-wide. On native, `ThemedRoot` also calls `Appearance.setColorScheme(...)` so native views (glass, nav-bar blur, SwiftUI pickers) follow. On web, `use-web-document-theme.ts` syncs `<html>`/`<body>`.
- Chrome uses `GlassView` from `expo-glass-effect` (`glass-chrome.tsx`) — `glassEffectStyle="regular"` on iOS, `backdropFilter: blur(20px) saturate(180%)` on web, flat translucent fill on Android.

### Typography

Single typeface, **National Park**, across all `Fonts` roles except `serif` (system serif). Native embeds fonts at build time via the `expo-font` config plugin (`app.json`); `fontWeight` selects the variant. Web loads `--font-*` CSS vars via `useFonts` in `_layout.tsx`. Storybook loads web font files via `@fontsource/national-park`. When adding a weight, update both the config plugin and the `@fontsource` import.

### Icons

`lucide-react-native` and SF Symbols (`expo-symbols`' `SymbolView`) are a **deliberate parallel mapping**, not a fallback chain: `primitives.tsx` defines `weatherIconFor(code)`/`weatherSfSymbol(code)` and `GEAR_ICONS`/`GEAR_SF_SYMBOLS`; call sites branch on `Platform.OS === 'ios'`.

### Accessibility & polish

- Add `accessibilityRole`/`accessibilityLabel`/`accessibilityState` and live regions to interactive and status elements.
- `brutalShadow(color, width, height?)` (`primitives.tsx`) produces the neobrutalist offset shadow, used by `BrutalCard` and buttons for the pressed effect.
- `HapticPressable` (`primitives.tsx`) wraps `Pressable` with a selection haptic on press.
- Home sections fade/rise in with staggered `react-native-reanimated` `FadeInDown`/`FadeIn` entrances.

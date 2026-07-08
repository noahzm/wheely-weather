# AGENTS.md

This file guides Antigravity (and other AI coding assistants) when working in this repository.

## Agent Behavioral Constraints

- **Testing Requirements**: When adding a new pure function to `src/utils` or `src/domain`, you MUST write a corresponding unit test.
- **Test Execution**: After modifying any file in `src/domain`, you must run `npm test` to verify no regressions were introduced.
- **Styling Strictness**: Never use inline styles or raw hex codes; strictly use the `useWheelyColors()` palette.
- **Architectural Changes**: If you need to make structural or logic changes to `src/domain/scoring.ts`, always ask for user approval first.

## Expo has changed a lot recently

This app runs Expo 57. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code that touches Expo APIs — behavior and APIs drift fast between major versions.

## What this is

Wheely Weather is an Expo Router + React Native app (iOS, Android, web) that scores how good conditions are for a bike ride, live at wheelyweather.app. MIT-licensed. The look is a layered system: a flat theme background, **liquid-glass** chrome (`expo-glass-effect`), neobrutalist **`BrutalCard`** content surfaces, and the **National Park** typeface. When something looks "off," compare against this design intent.

## Commands

- `npm run web` / `npm run ios` / `npm run android` — run the app (Expo).
- `npm run storybook:web` — component workshop at http://localhost:6006 (the primary surface for reviewing UI).
- `npm run storybook:ios` / `npm run storybook:android` — Storybook on device/simulator (sets `STORYBOOK_ENABLED`/`EXPO_PUBLIC_STORYBOOK_ENABLED` via `cross-env`, then starts Expo).
- `npm run build-storybook` — build the static Storybook; use to verify web bundling (lucide, `@fontsource`, `react-native-svg`).
- `npm run lint` — ESLint via `expo lint -- --max-warnings 0`.
- `npm run format` / `npm run format:check` — Prettier.
- `npm test` — unit tests (`vitest run --project unit`).
- `npm run test:e2e` — Playwright against Storybook.
- `npm run test:e2e:app` — Playwright against the exported web app (`playwright.app.config.ts`).
- `npx vitest run --project unit src/domain/weather-codes.test.ts` — run a single test file.
- `npx tsc --noEmit` — typecheck.
- `npm run build:web` — `expo export --platform web`; the CI "web export" gate, also run before `npm run deploy:web`.
- `npm run deploy:web` — `npm run build:web && wrangler deploy` (Cloudflare Workers + static assets).

### Testing notes

- `npm test` runs only the `unit` Vitest project (Node env): `src/**/*.{test,spec}.{js,ts,tsx}`, excluding `src/stories/**` and `*.stories.*`. Pure domain/utils logic lives here, colocated as `*.test.ts` next to its source.
- A second Vitest project, `storybook`, runs stories in a real browser via Playwright (`@vitest/browser-playwright`, chromium). It needs `npx playwright install` first and isn't run by `npm test` or CI — invoke explicitly with `vitest run --project storybook` if needed. In restricted/sandboxed environments it will fail to launch Chromium, so prefer `--project unit` there.
- `npm run test:e2e` and `npm run test:e2e:app` are both Playwright but target different builds (Storybook vs. the exported web app) and aren't part of CI — run manually.
- CI (`.github/workflows/ci.yml`, single job on `ubuntu-latest`, Node 24) runs, in order: `npm ci` → `npm run format:check` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build:web`. It's a plain sequential job with no `continue-on-error`/`if: always()`, so it stops at the first failing gate.

## Toolchain constraints

- **Path aliases**: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`. Use these in imports.
- **React Compiler** enabled (`app.json` `experiments.reactCompiler: true`) — don't add manual `useMemo`/`useCallback` for performance.
- **TypeScript strict** (`tsconfig.json`, extends `expo/tsconfig.base`): `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters` all on. Index access returns `T | undefined`. Type-aware ESLint rules run against `tsconfig.eslint.json` instead, which additionally includes test files (the main `tsconfig.json` excludes `**/*.test.*`/`**/*.spec.*`).
- **ESLint** (`eslint.config.js`, flat config): `eslint-config-expo/flat` base, `typescript-eslint` (`strictTypeChecked` + `stylisticTypeChecked` for `.ts`/`.tsx`), `eslint-plugin-unicorn` (`flat/recommended`), `eslint-plugin-sonarjs` (`recommended`), `eslint-plugin-react-native`, with `eslint-config-prettier` applied last. `--max-warnings 0` in CI means every configured rule is effectively a hard error.
  - Complexity/length caps: `complexity: 20`, `max-depth: 4`, `max-params: 5`, `max-lines: 700`, `max-lines-per-function: 120` (all skip blank lines/comments). Test files are exempt from `max-lines`/`max-lines-per-function`.
  - Notable type-aware error rules: `no-explicit-any`, `no-unsafe-assignment`/`no-unsafe-call`/`no-unsafe-member-access`/`no-unsafe-return`/`no-unsafe-argument`, `prefer-nullish-coalescing`, `no-deprecated`, `no-unnecessary-condition`, `restrict-template-expressions` (numbers allowed).
  - Naming convention (error): variables `camelCase|PascalCase|UPPER_CASE`, functions `camelCase|PascalCase`, types `PascalCase`.
  - `unicorn/no-array-reduce`, `no-array-callback-reference`, `consistent-function-scoping`: error. `filename-case`, `prevent-abbreviations`, `no-null`, `prefer-module`: off.
  - `sonarjs/cognitive-complexity: 20`, `prefer-read-only-props`, `no-nested-conditional`: error.
  - **`react-native/no-color-literals: 'error'`** — no hardcoded color strings in RN style objects; use the theme palette. `no-unused-styles` is off.

## Architecture

- **`src/app/`** — Expo Router routes under a `(tabs)` group with three children: `(home)`, `location`, `settings`.
  - The root `_layout.tsx` loads National Park fonts (web only; native embeds them at build time), wraps everything in `SettingsProvider`, resolves the active scheme (`ThemedRoot`, honoring the in-app appearance override), and nests `ForecastProvider` around a single-screen `Stack`.
  - On web it also renders a fixed `BottomNavBar` outside the `Stack`. Tabs use `expo-router/unstable-native-tabs` `NativeTabs` on iOS/Android. `(tabs)/_layout.web.tsx` replaces this with a plain `Stack` on web. `+html.tsx` is the web HTML template.
- **`src/components/wheely/`** — The presentational components.
  - `primitives.tsx`: Shared primitives (`BrutalCard`, `brutalShadow`, `HapticPressable`, `SectionTitle`, `Chip`, `makeButtonStyles`, small helpers). **Import from `@/components/wheely/primitives`, not the barrel.**
  - **Screen sections**: `weather-header`, `ride-verdict`, `weather-alerts`, `hourly-forecast` (+ siblings `hourly-chart-dot`, `hourly-chart-graphic`, `hourly-note-stickers`), `kit-guide`, `ride-specs`, `daily-forecast`, `status` (`ErrorState`/`LoadingState`/`LocationPromptState`).
  - **Chrome**: `glass-chrome`, `home-nav-chrome`, `bottom-nav-chrome`, `web-screen-header`, `content-column`.
  - **Platform-split** (not barrel-exported): `settings-form`, `settings-home-section`, `location-search-list`.
- **`src/components/`** (top level) — Generic, app-agnostic primitives (`themed-text.tsx`, `themed-view.tsx`, `external-link.tsx`, `animated-icon.tsx`).
- **`src/domain/`** — Weather scoring + copy (framework-agnostic TypeScript).
  - `index.ts`: The true top-level barrel.
  - `weather.ts`: Re-export barrel flattening scoring rules.
  - `acclimatization.ts`: Shifts temperature/dewpoint comfort thresholds based on home climate baseline.
- **`src/services/`**
  - `homeClimate.ts`: Fetches 30 days of Open-Meteo temps to create an acclimatization baseline.
  - `weatherService.ts` / `weatherService.ios.ts`: Live API fetching, platform-split — Open-Meteo by default, native Apple WeatherKit on iOS (see "Platform-split native data sources (iOS)" below). `weatherParsing.ts` holds the shared parsing both call into; `http.ts` holds the shared timeout helpers.
  - `forecastSnapshot.ts`: Load and normalize forecast entry point.
  - `forecastCache.ts` / `forecastCacheCodec.ts`: AsyncStorage-backed last-known-good forecast, keyed to the saved location; best-effort, any failure reads as a cache miss.
  - `locationSearch.ts` / `locationSearch.ios.ts`: Geocoding, platform-split — Nominatim (via `locationGeocoding.ts`) by default, native Apple MapKit (`MKLocalSearch`) on iOS.
  - `mockWeather.ts`: Fixture data for `?mock=`.
  - `locationStorage.ts` / `settingsCodec.ts`: AsyncStorage persistence; `settingsCodec.ts` is pure parse/validate logic kept free of AsyncStorage so it runs under the unit test project.
  - `telemetry.ts`: Sentry init and `captureError` (see "Observability (Sentry)" below).
- **`workers/index.mjs`** — Cloudflare Worker backing the web build. Proxies `/api/geocode` to Nominatim.
- **`modules/apple-location-search`** — Custom Expo native module wrapping Apple's `MKLocalSearch` on iOS.
- **`modules/apple-weatherkit`** — Custom Expo native module wrapping Apple's WeatherKit on iOS; backs `weatherService.ios.ts`.
- **`src/hooks/`**
  - `use-weather-forecast.ts`: Core forecast-loading hook.
  - `settings-context.tsx`: `SettingsProvider`.
  - `use-theme.ts`: Theme and color resolution.
- **`src/constants/theme.ts`** — Palette + typography source of truth.
- **`src/types/`** — Shared types: `weather.ts`, `settings.ts` (imported as `@/types/weather`, `@/types/settings`).
- **`src/utils/`** — Helpers like `hourlyChart`, `timeFormat`, `temperature`, `haptics.ts`.

### Data flow

`useWeatherForecast(mockScenario)` manages all fetch + location state and is exposed app-wide via `ForecastProvider`/`useForecast()` (`src/hooks/forecast-context.tsx`). The root `_layout.tsx` wraps the navigator in `ForecastProvider`; screens call `useForecast()`.

Before the weather fetch, `getForecastSnapshot()` resolves acclimatization context by calling `homeClimate.ts` and baking adjusted thresholds into the snapshot. Mock scenarios bypass acclimatization and use base thresholds directly.

App-wide **settings** (gear mode, appearance preference, home location, temperature unit) flow through `SettingsProvider`, the outermost provider in `_layout`. Do not create standalone store hooks holding their own `useState` for these — isolated state means a toggle in Settings never reaches the theme or kit guide.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of hitting the live API. `ForecastProvider` reads `useGlobalSearchParams().mock`, validates it against the known set, and **latches** the last-seen value in state — RN tab navigation drops query params on switch, so without latching the mock scenario would disappear the moment you leave the tab it was set on. The latched value flows into `useWeatherForecast` → `loadForecastData` → `getForecastSnapshot`, the sole owner of the mock branch, which delegates to `mockWeather.ts`.

### Platform-split native data sources (iOS)

On iOS, `weatherService.ios.ts` and `locationSearch.ios.ts` shadow the default Open-Meteo/Nominatim implementations with native calls into `modules/apple-weatherkit` and `modules/apple-location-search` respectively (Apple WeatherKit and `MKLocalSearch`). Both native modules return `null`/throw until a native rebuild links them — there is no automatic fallback to the web APIs in that state, matching each other's behavior intentionally.

**Gotcha:** `weatherService.ios.ts` must import shared parsing helpers (`buildWeatherFromData`, `fetchAqi`, etc.) from `weatherParsing.ts`, never from `weatherService.ts`. Metro's platform resolution would resolve a `./weatherService` import back to `weatherService.ios.ts` itself when building for iOS, causing infinite recursion. AQI stays on Open-Meteo even in the WeatherKit path — WeatherKit has no AQI data. `weatherkit-codes.ts` translates WeatherKit condition codes to the WMO codes the rest of the app expects.

### Observability (Sentry)

`src/services/telemetry.ts` wraps `@sentry/react-native`:

- `initSentry()` runs once at root-layout module load (before first render) and is a no-op unless `EXPO_PUBLIC_SENTRY_DSN` is set (see `.env.example`) — the app runs fine with Sentry entirely disabled.
- `sentryEnabled` (`Boolean(dsn)`) gates whether `_layout.tsx` applies `Sentry.wrap(RootLayout)`. Wrapping without an initialized client leaves the app-start profiler with nothing to report to and logs a spurious "Sentry.wrap was called before Sentry.init" warning on every launch, so it's skipped entirely when disabled.
- `captureError(error, context?)` routes otherwise-swallowed errors to Sentry. Several persistence/enrichment paths (AsyncStorage reads/writes, forecast cache, settings) intentionally never reject — a flaky disk or network call shouldn't break the UI — but that previously made real bugs (storage corruption, a parsing regression) invisible. Call it from those paths without changing their existing fallback behavior; it's safe to call even when Sentry is disabled.
- Native builds also run Sentry's Xcode/Gradle build phases, which try to upload source maps/debug symbols via `sentry-cli`. Without a configured Sentry org/project/auth token this upload fails and aborts the build — set `SENTRY_DISABLE_AUTO_UPLOAD` as a real process env var (in `.env` for local dev, an EAS env var for cloud builds) to skip it. `sentry-xcode.sh` only checks the process environment, so setting it in `.env.sentry-build-plugin` alone has no effect. A root-level `.env.sentry-build-plugin` (gitignored) is read separately by `sentry-cli` for `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`, only needed if you actually want symbols uploaded.

## Conventions

### Theming (light/dark)

- Colors live in `WheelyTheme.{light,dark}` (`src/constants/theme.ts`), typed as `WheelyPalette`.
- Components are theme-aware: get colors via `useWheelyColors()` and build styles with a `makeStyles(c: WheelyPalette)` function, memoized per palette via a `useStyles()` wrapper. Do not hardcode hex values (`react-native/no-color-literals` is an error).
- Active scheme resolves through `useColorSchemeName()`, which honors `ColorSchemeOverrideContext` before falling back to the OS scheme. Storybook drives that context from its "Theme" toolbar (`.storybook/preview.tsx`), so new components automatically respond to the toggle.
- An in-app **appearance preference** (`useAppearance()`: `'light'|'dark'|'system'`) overrides the OS scheme app-wide. On native, `_layout`'s `ThemedRoot` also calls `Appearance.setColorScheme(...)` in a `useEffect` so native views (glass, nav-bar blur, SwiftUI pickers) follow — repainting JS colors alone leaves them stale. On web, `use-web-document-theme.ts` syncs the `<html>`/`<body>` background and `color-scheme`.
- Chrome (headers, nav buttons, settings/location title pills) uses `GlassView` from `expo-glass-effect` (`glass-chrome.tsx`) over the flat theme background — `glassEffectStyle="regular"` on iOS, a translucent fill with `backdropFilter: blur(20px) saturate(180%)` on web, flat translucent fill on Android.

### Typography

- The app uses a single typeface, **National Park**, across all `Fonts` roles (`sans`, `display`, `rounded`, `mono`, `monoBold`) except `serif`, which intentionally falls back to the system serif. On native every role resolves to the weighted family embedded at build time by the `expo-font` config plugin (`app.json`), so `fontWeight` (`FontWeightBold` = `'700'` on native) selects the bold variant. On web the roles resolve to `--font-*` CSS vars (`src/global.css`) backed by `@font-face` families loaded via `useFonts` in `_layout.tsx` (web-only; native skips the runtime load since fonts are build-time embedded).
- Storybook loads the actual web font files via `@fontsource/national-park` imports in `.storybook/preview.css`. Update both surfaces (the `expo-font` config plugin in `app.json` + `@expo-google-fonts/national-park` TTF paths, and the `@fontsource` import) when adding a weight.

### Icons

- `lucide-react-native` (`^1.22.0`, renders via `react-native-svg`, works on web) and SF Symbols via `expo-symbols`' `SymbolView` are used as a **deliberate parallel mapping**, not lucide-with-SF-Symbol-fallback: `primitives.tsx` defines `weatherIconFor(code)`/`weatherSfSymbol(code)` and `GEAR_ICONS`/`GEAR_SF_SYMBOLS`, and call sites branch on `Platform.OS === 'ios'` to pick `SymbolView` vs. the Lucide component.

### Accessibility & polish

- Add `accessibilityRole`/`accessibilityLabel`/`accessibilityState` and live regions to interactive and status elements.
- `brutalShadow(color, width, height?)` (`primitives.tsx`) produces the neobrutalist offset shadow — a `boxShadow` on web, `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` natively — used by `BrutalCard` and buttons for the pressed-effect (translate + shadow shift).
- `HapticPressable` (`primitives.tsx`) wraps `Pressable` with a selection haptic on press.
- Home sections fade/rise in with staggered `react-native-reanimated` `FadeInDown`/`FadeIn` entrances.

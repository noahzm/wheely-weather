# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

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

- `src/app/` — Expo Router routes under a `(tabs)` group with three children: `(home)`, `location`, `settings`. The root `_layout.tsx` loads National Park fonts (web only; native embeds them at build time), wraps everything in `SettingsProvider`, resolves the active scheme (`ThemedRoot`, honoring the in-app appearance override — see Conventions below), and nests `ForecastProvider` around a single-screen `Stack`. On web it also renders a fixed `BottomNavBar` outside the `Stack`. Tabs use `expo-router/unstable-native-tabs` `NativeTabs` on iOS/Android (SF Symbols on iOS, Material icons on Android); `(tabs)/_layout.web.tsx` replaces this with a plain `Stack` on web, since the root layout's `BottomNavBar` fills the tab-bar role there. `+html.tsx` is the Expo Router web HTML template.
- `src/components/wheely/` — the presentational components. `primitives.tsx` (a single file, not a directory) is the general shared-primitives grab bag: `BrutalCard`, `brutalShadow`, `HapticPressable`, `SectionTitle`/`SectionHeading`, `Chip`, `BurstChip`/`BurstConditionChip`, `makeButtonStyles`/`ButtonRadius`, small helpers (`asCondition`, `formatTime`), and the icon maps described under Icons below — import from `@/components/wheely/primitives`, not the barrel. Screen sections: `weather-header`, `ride-verdict`, `weather-alerts`, `hourly-forecast` (+ siblings `hourly-chart-dot`, `hourly-chart-graphic`, `hourly-note-stickers`, and colocated hooks `use-hourly-forecast-chart`/`use-hourly-scroll-picker`), `kit-guide`, `ride-specs`, `daily-forecast`, `status` (`ErrorState`/`LoadingState`/`LocationPromptState`). Chrome: `glass-chrome`, `home-nav-chrome`, `bottom-nav-chrome` (exports `bottomNavBarHeight(insetsBottom)`), `web-screen-header`, `content-column`. Platform-split, not barrel-exported: `settings-form.tsx`/`.ios.tsx`/`.types.ts` (barrel exports the platform-resolved `SettingsForm`), `settings-home-section.tsx`/`.ios.tsx` (default uses `@expo/ui` `Host`/`Switch`; iOS uses `@expo/ui/swift-ui` `Toggle`), `location-search-list.tsx`/`.ios.tsx`/`.types.ts` (default is Nominatim-backed; iOS renders a native SwiftUI `List` via `@expo/ui/swift-ui`) — these are imported directly by call sites, not through the barrel. Animation helpers `animated-condition-chip`, `animated-expand` are also internal, not barrel-exported. Import screen-level components from `@/components/wheely` (barrel at `src/components/wheely/index.ts`).
- `src/components/` (top level, outside `wheely/`) — generic, app-agnostic primitives: `themed-text.tsx`/`themed-view.tsx` (theme-aware `Text`/`View` wrappers), `external-link.tsx`, `hint-row.tsx`, `web-badge.tsx`, `animated-icon.tsx`/`.web.tsx` (exports `AnimatedSplashOverlay`, used by the root layout for the launch animation, and `AnimatedIcon`), `ui/collapsible.tsx`.
- `src/domain/` — weather scoring + copy (framework-agnostic TypeScript). `index.ts` is the true top-level barrel, re-exporting `constants.ts`, `acclimatization.ts`, `copy.ts`, and `weather.ts`. `weather.ts` is itself a re-export barrel flattening `scoring.ts` (`evaluateCondition`, `evaluateWind`, `getDailyCondition`, `getHourlyCondition`, `getOverallStatus`), `weather-codes.ts`, `ride-factors.ts`, `gear.ts`, `alerts.ts`, and `../utils/weatherLabels`. `acclimatization.ts` shifts the hot-side of TEMPERATURE and DEWPOINT comfort thresholds based on a rider's home climate baseline: derived shift is `clamp((home - REF) * 0.5, 0, MAX)` off reference anchors of 80°F/60°F, capped at 6°F (temp) / 7°F (dewpoint), and only ever warms the comfort dials — hard hazard ceilings (`BAD_MAX`) never move, so dangerous days still score "bad" regardless of acclimatization. `getAcclimatizationNote()` returns the contextual note shown in `RideVerdict`.
- `src/services/homeClimate.ts` — `getHomeBaseline()` fetches 30 days of Open-Meteo daily-max-temp/hourly-dewpoint for the home location and takes the 75th percentile of each as `{ warmTemp, warmDewpoint }`. Caches per ~11 km-rounded location for 7 days in AsyncStorage; returns `null` on any failure (best-effort, 4-second timeout) so callers fall back to unadjusted thresholds.
- `src/services/` (rest) — `weatherService.ts` (live Open-Meteo/AQI/NWS-alerts fetching), `forecastSnapshot.ts` (`getForecastSnapshot`, the "load and normalize a forecast" entry point, resolving acclimatization and — when a mock scenario is set — delegating to `mockWeather.ts` instead), `mockWeather.ts` (fixture data for `?mock=`), `locationGeocoding.ts` (Nominatim-backed search/reverse-geocode), `locationSearch.ts`/`locationSearch.ios.ts` (platform split: default delegates to `locationGeocoding`; iOS uses the native module below), `locationStorage.ts` (AsyncStorage persistence for locations and settings), `http.ts` (`fetchWithTimeout`).
- `workers/index.mjs` — the Cloudflare Worker (deployed via `wrangler.jsonc`) backing the web build. Proxies `/api/geocode/search` and `/api/geocode/reverse` to Nominatim (adds a `User-Agent`, CORS headers, cache-control — 1h for search, 24h for reverse — and passes 429s through as a JSON rate-limit error); everything else falls through to static asset serving (`./dist`, SPA fallback).
- `modules/apple-location-search` — custom Expo native module wrapping Apple's `MKLocalSearch` on iOS, with Android/web stub implementations; consumed by `locationSearch.ios.ts`.
- `src/hooks/use-weather-forecast.ts` — the core forecast-loading hook, backed by `src/hooks/forecast/`: `device-location.ts` (wraps `expo-location`, handles denial/insecure-context messaging), `load-forecast-data.ts` (orchestrates fetch + pinned/recent locations via `locationStorage`), `use-stale-refresh.ts` (refreshes after 15 min stale via `AppState`).
- `src/hooks/settings-context.tsx` — `SettingsProvider` plus `useGearMode`/`useAppearance`/`useHomeLocation`/`useTempUnit`/`useResolvedTempUnit`, each backed by one `usePersistedSetting` call persisting through `locationStorage.ts`.
- `src/hooks/use-theme.ts` — `ColorSchemeOverrideContext`, `useColorSchemeName()`, `useWheelyColors()` (see Conventions).
- `src/hooks/use-color-scheme.ts`/`.web.ts` — platform split: native re-exports RN's `useColorScheme`; web uses `useSyncExternalStore` with a static post-hydration value.
- `src/hooks/use-temperature-display.ts`, `use-location-search-screen.ts`, `use-web-document-theme.ts` — screen-level formatting/sync hooks.
- `src/constants/theme.ts` — palette + typography source of truth: `WheelyPalette` (background/paper/ink/mutedInk/border/shadow/primary/primaryInk/secondary/accent/success/warning/error/condition — the last typed `WheelyConditionColors`, the good/fair/marginal/poor/bad ramp), `WheelyTheme.{light,dark}`, `Fonts`, `FontWeightBold`, `Spacing`, `MaxContentWidth`, `TRANSPARENT`, `BottomTabInset`.
- `src/types/settings.ts` — `GearMode`, `Appearance`, `TempUnitPreference` and their paired label/value option arrays. `src/types/weather.ts` — `Condition`, `RideStatus`, `MetricType`, `HourlyWeather`, `DailyWeather`, etc.
- `src/utils/` — `forecastHelpers`, `weatherLabels` (backs the label helpers re-exported through `domain/weather.ts`), `hourlyChart`, `timeFormat`, `temperature`, `haptics.ts` (`verdictFeedback(status)` — tone-matched notification haptics, no-op on web), `large-title-stack-options.ts` (shared by all three tab `_layout.tsx` files).
- `src/stories/` + `.storybook/` (web) + `.rnstorybook/` (on-device) — Storybook setup and fixtures.

### Data flow

`useWeatherForecast(mockScenario)` manages all fetch + location state and is exposed app-wide via `ForecastProvider`/`useForecast()` (`src/hooks/forecast-context.tsx`). The root `_layout.tsx` wraps the navigator in `ForecastProvider`; screens call `useForecast()`.

Before the weather fetch, `getForecastSnapshot()` resolves acclimatization context by calling `homeClimate.ts` and baking adjusted thresholds into the snapshot. Mock scenarios bypass acclimatization and use base thresholds directly.

App-wide **settings** (gear mode, appearance preference, home location, temperature unit) flow through `SettingsProvider`, the outermost provider in `_layout`. Do not create standalone store hooks holding their own `useState` for these — isolated state means a toggle in Settings never reaches the theme or kit guide.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of hitting the live API. `ForecastProvider` reads `useGlobalSearchParams().mock`, validates it against the known set, and **latches** the last-seen value in state — RN tab navigation drops query params on switch, so without latching the mock scenario would disappear the moment you leave the tab it was set on. The latched value flows into `useWeatherForecast` → `loadForecastData` → `getForecastSnapshot`, the sole owner of the mock branch, which delegates to `mockWeather.ts`.

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

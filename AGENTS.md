# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Wheely Weather

Expo Router + React Native app (iOS, Android, web) that scores how good conditions are for a bike ride. It's a port of an Astro/Tailwind/DaisyUI site. The look has since evolved into a layered system: a repeating **tartan** backdrop, **liquid-glass** chrome (`expo-glass-effect`), neobrutalist **`BrutalCard`** content surfaces, and the **National Park** typeface. When something looks "off," compare against this current design intent.

## Commands

- `npm run web` / `npm run ios` / `npm run android` — run the app (Expo).
- `npm run storybook:web` — component workshop at http://localhost:6006 (this is the primary surface for reviewing UI).
- `npm run storybook:ios` / `npm run storybook:android` — Storybook on device/simulator (sets `STORYBOOK_ENABLED=true` via `cross-env`, then starts Expo).
- `npm run build-storybook` — build the static Storybook; use this to verify web bundling (lucide, `@fontsource`, `react-native-svg`).
- `npm run lint` — ESLint via `expo lint` (`eslint-config-expo`, `--max-warnings 0`).
- `npm run format` / `npm run format:check` — Prettier.
- `npm test` — unit tests (`vitest run --project unit`).
- `npm run test:e2e` — Playwright e2e (`e2e/`).
- `npx vitest run --project unit src/domain/weather.test.ts` — run a single test file.
- `npx tsc --noEmit` — typecheck.
- `npm run build:web` — `expo export --platform web`; the CI "Web export" gate, also run before `npm run deploy:web` (wrangler, see `wheely-web-cloudflare-launch` memory).

### Testing notes

- `npm test` runs only the `unit` Vitest project (Node env): `src/**/*.{test,spec}.*`, excluding stories. Pure domain/utils logic lives here.
- The `storybook` Vitest project runs stories in a real browser via Playwright. It needs `npx playwright install` first; in restricted/sandboxed environments it will fail to launch Chromium, so prefer `--project unit` there.
- Domain and utility logic (`src/domain`, `src/utils`) is TypeScript with colocated `*.test.{ts}` — keep domain framework-free and unit-tested.
- `npm run test:e2e` runs Playwright against Storybook (not the app), so Storybook must build successfully first.
- CI runs all four gates (format, lint, typecheck, test) regardless of earlier failures.

## Toolchain constraints

- **Path aliases**: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`. Use these in imports.
- **React Compiler** enabled (`app.json` `experiments.reactCompiler: true`) — don't add manual `useMemo`/`useCallback` for performance.
- **TypeScript strict**: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` — all enforced. Index access returns `T | undefined`.
- **ESLint caps**: `complexity` 20, `max-depth` 4, `max-params` 5, `max-lines-per-function` 120 (skip blank/comments).
- **ESLint uses flat config** (`eslint.config.js`): plugins are `typescript-eslint` (strict + stylistic, type-aware), `eslint-plugin-unicorn`, and `eslint-plugin-sonarjs` (`cognitive-complexity: 20`). Type-aware rules run against `tsconfig.eslint.json`, which includes test files — the main `tsconfig.json` excludes them. Notable error-level rules: `no-explicit-any`, `no-array-reduce`, naming conventions (`camelCase|PascalCase|UPPER_CASE` for variables/functions, `PascalCase` for types).
- **`react-native/no-color-literals: 'error'`** — no hardcoded color strings in RN style objects; use theme palette.

## Architecture

- `src/app/` — Expo Router routes under a `(tabs)` group with three children: `(home)`, `(location)`, `(settings)`. The root `_layout.tsx` is wrapped in `SettingsProvider` (outermost), loads National Park, sets the status bar, and nests `ForecastProvider` + `TartanBackground` around a transparent navigator. Tabs use `expo-router/unstable-native-tabs` `NativeTabs` on iOS/Android — SF Symbols (`sf="house.fill"`, `sf="gearshape.fill"`) on iOS, Material icons on Android. `_layout.web.tsx` provides a platform-split web tab treatment.
- `src/components/wheely/` — the presentational components, split one-per-file (representative, not exhaustive): `primitives` (`SectionTitle`, `Chip`, `BurstChip`, `BrutalCard`, `brutalShadow`, icon maps, helpers — import from `@/components/wheely/primitives`, not the barrel), `weather-header`, `ride-verdict`, `weather-alerts`, `hourly-forecast` (+ siblings `hourly-chart-dot`, `hourly-chart-graphic`, `hourly-note-stickers`), `kit-guide`, `ride-specs`, `daily-forecast`, `status` (`ErrorState`/`LoadingState`/`LocationPromptState`); chrome (`glass-chrome`, `home-nav-chrome`, `bottom-nav-chrome` (exports `bottomNavBarHeight(insetsBottom)` for clearing the nav bar inset), `web-screen-header`, `content-column`); `settings-form` (+ `.ios`/`.types`), `settings-home-section`; animation helpers (`animated-condition-chip`, `animated-expand`); and colocated chart hooks (`use-hourly-forecast-chart`, `use-hourly-scroll-picker`). Import screen-level components from `@/components/wheely` (barrel at `src/components/wheely/index.ts`).
- `src/components/tartan-background.tsx` — full-screen repeating tartan tile rendered via a `react-native-svg` `Pattern` (web re-resolves the asset URL), with a light/dark scrim.
- `src/domain/` — weather scoring + copy (framework-agnostic TypeScript). `weather.ts` is a re-export barrel; implementation lives in `scoring.ts`, `weather-codes.ts`, `ride-factors.ts`, `gear.ts`, and `alerts.ts`. `acclimatization.ts` shifts the hot-side of TEMPERATURE and DEWPOINT comfort thresholds based on a rider's home climate baseline (dampened 0.5×, capped at 6 °F / 7 °F). Hard hazard ceilings (`BAD_MAX`) never move, so dangerous days still score "bad" regardless of acclimatization. `getAcclimatizationNote()` returns the contextual note shown in `RideVerdict`.
- `src/services/homeClimate.ts` — fetches 30 days of weather from Open-Meteo and computes the 75th-percentile of daily highs/dews to derive `HomeBaseline { warmTemp, warmDewpoint }`. Caches per ~11 km-rounded location for 7 days in AsyncStorage. Returns null on failure (best-effort; 4-second timeout).
- `src/utils/haptics.ts` — `verdictFeedback(status)` fires tone-matched notification haptics (`'yes'` → Success, `'maybe'` → Warning, `'no'` → Error). Rejections are swallowed (no-op on web).
- `src/utils/` — formatting/label helpers (`forecastHelpers`, `weatherLabels`, `hourlyChart`, `timeFormat`, `temperature`).
- `src/services/` — data fetching, storage, snapshots (all TypeScript). `locationSearch.ios.ts` uses Apple's native geocoder (via `modules/apple-location-search`); `locationSearch.ts` is the non-iOS fallback. Mock scenarios are resolved only in `forecastSnapshot.ts` — services do not sniff `?mock=` globally.
- `src/constants/theme.ts` — palette + typography source of truth (also `Spacing`, `MaxContentWidth`, `TRANSPARENT`).
- `src/hooks/use-theme.ts` — theme resolution and color hooks.
- `src/hooks/use-temperature-display.ts` — `useTemperatureDisplay()` wraps resolved temp unit + `formatTemperature` for screen-level call sites.
- `src/hooks/forecast/` — `device-location.ts`, `load-forecast-data.ts`, `use-stale-refresh.ts`; consumed by `use-weather-forecast.ts`.
- `src/stories/` — Storybook stories and fixtures.
- `modules/apple-location-search` — custom Expo native module wrapping Apple's `MKLocalSearch`.

### Data flow

`useWeatherForecast(mockScenario)` (in `src/hooks/use-weather-forecast.ts`) manages all fetch + location state and is exposed app-wide via `ForecastProvider` / `useForecast()` (in `src/hooks/forecast-context.tsx`). The root `app/_layout.tsx` wraps the navigator in `ForecastProvider`; screens call `useForecast()`.

Before the weather fetch, `getForecastSnapshot()` (`src/services/forecastSnapshot.ts`) resolves acclimatization context by calling `homeClimate.ts` and baking adjusted thresholds into the snapshot. Mock scenarios bypass acclimatization and use base `THRESHOLDS` directly.

App-wide **settings** (gear mode + appearance preference + home location + temperature unit) flow through a separate `SettingsProvider` / `settings-context.tsx`, the outermost provider in `_layout`. State + persistence live directly in the provider (one `usePersistedSetting` helper per setting); consume `useGearMode` / `useAppearance` / `useHomeLocation` / `useTempUnit` / `useResolvedTempUnit` from `@/hooks/settings-context`. Do not create standalone store hooks holding their own `useState` for these — isolated state means a toggle in Settings never reaches the theme or kit guide. The preference types (`GearMode`, `Appearance`, `TempUnitPreference`) and their label/value option arrays live in `src/types/settings.ts`.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of hitting the live API. The `ForecastProvider` reads `useGlobalSearchParams().mock` and passes it to `useWeatherForecast`, which forwards `mockScenario` to `getForecastSnapshot` — the sole mock branch owner.

## Conventions

### Theming (light/dark)

- Colors live in `WheelyTheme.{light,dark}` (`src/constants/theme.ts`), typed as `WheelyPalette`.
- Components are theme-aware: get colors via `useWheelyColors()` and build styles with a `makeStyles(c: WheelyPalette)` function memoized per palette. Do not hardcode hex values.
- Active scheme resolves through `useColorSchemeName()`, which honors `ColorSchemeOverrideContext`. Storybook drives that context from its "Theme" toolbar (`.storybook/preview.tsx`), so new components automatically respond to the toggle.
- An in-app **appearance preference** (`useAppearance()`: `light`/`dark`/`system`) overrides the OS scheme app-wide. On native, `_layout` also calls `Appearance.setColorScheme(...)` so native views (glass, nav-bar blur, SwiftUI pickers) follow — repainting JS colors alone leaves them stale.
- Chrome (headers, nav buttons, settings/location title pills) uses `GlassView` from `expo-glass-effect` over the tartan backdrop; screens and the `Stack` run with transparent backgrounds so the tartan shows through.

### Typography

- The app uses a single typeface, **National Park**, mapped to all roles in `Fonts` (`theme.ts`). On native every role resolves to the weighted `National Park` family embedded at build time by the `expo-font` config plugin (`app.json`), so `fontWeight` (`FontWeightBold` = 700 on native) selects the bold variant — Android needs this (a runtime-registered single-weight family + `fontWeight: 700` falls back to Roboto). On web the roles resolve to `--font-*` CSS vars (`src/global.css`) backed by `@font-face` families from `useFonts` in `app/_layout.tsx` (web-only; native skips the runtime load since fonts are build-time embedded).
- Storybook loads the actual web font files via `@fontsource/national-park` `@import`s in `.storybook/preview.css`. Update both surfaces (config plugin in `app.json` + `@expo-google-fonts/national-park` TTF paths, and `@fontsource` import in `.storybook/preview.css`) when adding a weight.

### Icons

- Use `lucide-react-native` (renders via `react-native-svg`, works on web). Pinned to `^1.22.0` — earlier `1.x` releases shipped a broken `LucideProvider` barrel export (see lucide-icons/lucide#4424, fixed in #4497 and released in `1.22.0` on 2026-06-28). Do not regress below `1.22.0`.
- iOS chrome may use SF Symbols via `expo-symbols` (`SymbolView`); `primitives` maps lucide concepts to SF Symbol names where both are needed.
- Icons can't be nested inside `<ThemedText>`; render them as siblings in a row `View` (e.g. the `Chip` `icon` prop, note chips).

### Accessibility & polish

- Add `accessibilityRole`/`accessibilityLabel`/`accessibilityState` and live regions to interactive and status elements.
- Buttons use a neobrutalist pressed effect (translate + shadow shift via `brutalShadow`). Home sections fade/rise in with staggered reanimated `FadeInDown`.

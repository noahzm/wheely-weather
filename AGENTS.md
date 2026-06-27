# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Wheely Weather

Expo Router + React Native app (iOS, Android, web) that scores how good conditions are for a bike ride. It's a port of an Astro/Tailwind/DaisyUI site. The look has since evolved into a layered system: a repeating **tartan** backdrop, **liquid-glass** chrome (`expo-glass-effect`), neobrutalist **`BrutalCard`** content surfaces, and the **National Park** typeface. When something looks "off," compare against this current design intent.

## Commands

- `npm run web` / `npm run ios` / `npm run android` — run the app (Expo).
- `npm run storybook:web` — component workshop at http://localhost:6006 (this is the primary surface for reviewing UI).
- `npm run build-storybook` — build the static Storybook; use this to verify web bundling (lucide, `@fontsource`, `react-native-svg`).
- `npm run lint` — ESLint via `expo lint` (`eslint-config-expo`, `--max-warnings 0`).
- `npm run format` / `npm run format:check` — Prettier.
- `npm test` — unit tests (`vitest run --project unit`).
- `npm run test:e2e` — Playwright e2e (`e2e/`).
- `npx vitest run --project unit src/domain/weather.test.js` — run a single test file.
- `npx tsc --noEmit` — typecheck.

### Testing notes

- `npm test` runs only the `unit` Vitest project (Node env): `src/**/*.{test,spec}.*`, excluding stories. Pure domain/utils logic lives here.
- The `storybook` Vitest project runs stories in a real browser via Playwright. It needs `npx playwright install` first; in restricted/sandboxed environments it will fail to launch Chromium, so prefer `--project unit` there.
- Domain and utility logic (`src/domain`, `src/utils`) is plain JS/TS with colocated `*.test.{js,ts}` — keep it framework-free and unit-tested.

## Architecture

- `src/app/` — Expo Router routes (flat, no tab group). `_layout.tsx` loads the National Park font, sets the status bar, and wraps the app in `ForecastProvider` + `TartanBackground` around a transparent `Stack`. `index.tsx` is the home screen; `settings.tsx` is the settings screen; `location.tsx` is a modal-style location picker pushed via `router.push('/location')`.
- `src/components/wheely/` — the presentational components, split one-per-file: `primitives` (`SectionTitle`, `Chip`, `BurstChip`, `BrutalCard`, `brutalShadow`, icon maps, helpers), `weather-header`, `ride-verdict`, `weather-alerts`, `hourly-forecast`, `kit-guide`, `ride-specs`, `daily-forecast`, `status` (`ErrorState`/`LoadingState`). Import from `@/components/wheely`. `src/components/wheely-ui.tsx` is a backward-compat barrel re-exporting `./wheely` — prefer the direct path in new code.
- `src/components/tartan-background.tsx` — full-screen repeating tartan tile rendered via a `react-native-svg` `Pattern` (web re-resolves the asset URL), with a light/dark scrim.
- `src/domain/` — weather scoring + copy (framework-agnostic).
- `src/utils/` — formatting/label helpers (`forecastHelpers`, `weatherLabels`, `hourlyChart`, `timeFormat`).
- `src/services/` — data fetching, storage, snapshots. `locationSearch.ios.ts` uses Apple's native geocoder (via `modules/apple-location-search`); `locationSearch.ts` is the non-iOS fallback.
- `src/constants/theme.ts` — palette + typography source of truth (also `Spacing`, `MaxContentWidth`, `TRANSPARENT`).
- `src/hooks/use-theme.ts` — theme resolution and color hooks; `use-gear-mode.ts` — persisted Everyday/Performance (`casual`/`pro`) gear mode.
- `src/stories/` — Storybook stories and fixtures.
- `modules/apple-location-search` — custom Expo native module wrapping Apple's `MKLocalSearch`.

### Data flow

`useWeatherForecast(mockScenario)` (in `src/hooks/use-weather-forecast.ts`) manages all fetch + location state and is exposed app-wide via `ForecastProvider` / `useForecast()` (in `src/hooks/forecast-context.tsx`). The root `app/_layout.tsx` wraps the `Stack` in `ForecastProvider`; screens call `useForecast()`.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of hitting the live API. The `ForecastProvider` reads `useGlobalSearchParams().mock` and passes it to `useWeatherForecast`.

## Conventions

### Theming (light/dark)

- Colors live in `WheelyTheme.{light,dark}` (`src/constants/theme.ts`), typed as `WheelyPalette`.
- Components are theme-aware: get colors via `useWheelyColors()` and build styles with a `makeStyles(c: WheelyPalette)` function memoized per palette. Do not hardcode hex values.
- Active scheme resolves through `useColorSchemeName()`, which honors `ColorSchemeOverrideContext`. Storybook drives that context from its "Theme" toolbar (`.storybook/preview.tsx`), so new components automatically respond to the toggle.
- Chrome (headers, nav buttons, settings/location title pills) uses `GlassView` from `expo-glass-effect` over the tartan backdrop; screens and the `Stack` run with transparent backgrounds so the tartan shows through.

### Typography

- The app uses a single typeface, **National Park**, mapped to all roles in `Fonts` (`theme.ts`): `sans`/`mono`/`rounded` → `NationalPark_400Regular`, `display`/`monoBold` → `NationalPark_700Bold`.
- `src/global.css` defines the `--font-*` CSS vars the web `Fonts` roles resolve to. Storybook loads the actual web font files via `@fontsource/national-park` `@import`s in `.storybook/preview.css`; Expo web and native load it via `expo-font` / `@expo-google-fonts/national-park` in `app/_layout.tsx`. Update both surfaces when adding a weight.

### Icons

- Use `lucide-react-native` (renders via `react-native-svg`, works on web). Pin to `0.x` — `1.x` currently ships a broken `LucideProvider` barrel export that breaks bundling.
- iOS chrome may use SF Symbols via `expo-symbols` (`SymbolView`); `primitives` maps lucide concepts to SF Symbol names where both are needed.
- Icons can't be nested inside `<ThemedText>`; render them as siblings in a row `View` (e.g. the `Chip` `icon` prop, note chips).

### Accessibility & polish

- Add `accessibilityRole`/`accessibilityLabel`/`accessibilityState` and live regions to interactive and status elements.
- Buttons use a neobrutalist pressed effect (translate + shadow shift via `brutalShadow`). Home sections fade/rise in with staggered reanimated `FadeInDown`.

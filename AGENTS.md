# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Wheely Weather

Expo Router + React Native app (iOS, Android, web) that scores how good conditions are for a bike ride. It's a port of an Astro/Tailwind/DaisyUI site, so when something looks "off," compare against the original neobrutalist design intent.

## Commands

- `npm run web` / `npm run ios` / `npm run android` — run the app (Expo).
- `npm run storybook:web` — component workshop at http://localhost:6006 (this is the primary surface for reviewing UI).
- `npm run build-storybook` — build the static Storybook; use this to verify web bundling (lucide, `@fontsource`, `react-native-svg`).
- `npm run lint` — ESLint (`eslint-config-expo`).
- `npm test` — unit tests (`vitest run --project unit`).
- `npx vitest run --project unit src/domain/weather.test.js` — run a single test file.
- `npx tsc --noEmit` — typecheck.

### Testing notes

- `npm test` runs only the `unit` Vitest project (Node env): `src/**/*.{test,spec}.*`, excluding stories. Pure domain/utils logic lives here.
- The `storybook` Vitest project runs stories in a real browser via Playwright. It needs `npx playwright install` first; in restricted/sandboxed environments it will fail to launch Chromium, so prefer `--project unit` there.
- Domain and utility logic (`src/domain`, `src/utils`) is plain JS with colocated `*.test.js` — keep it framework-free and unit-tested.

## Architecture

- `src/app/` — Expo Router routes. `_layout.tsx` loads fonts + sets the status bar. `(tabs)/index.tsx` is the home screen; `(tabs)/explore.tsx` is the explore tab. `location.tsx` is a modal-style location picker pushed via `router.push('/location')`.
- `src/components/wheely-ui.tsx` — the bulk of the presentational components (header, verdict, alerts, hourly chart, kit guide, ride specs, daily, modals).
- `src/domain/` — weather scoring + copy (framework-agnostic).
- `src/utils/` — formatting/label helpers.
- `src/services/` — data fetching, storage, snapshots. `locationSearch.ios.ts` uses Apple's native geocoder (via `modules/apple-location-search`); `locationSearch.ts` is the non-iOS fallback.
- `src/constants/theme.ts` — palette + typography source of truth.
- `src/hooks/use-theme.ts` — theme resolution and color hooks.
- `src/stories/` — Storybook stories and fixtures.
- `modules/apple-location-search` — custom Expo native module wrapping Apple's `MKLocalSearch`.

### Data flow

`useWeatherForecast(mockScenario)` (in `src/hooks/use-weather-forecast.ts`) manages all fetch + location state and is exposed app-wide via `ForecastProvider` / `useForecast()` (in `src/hooks/forecast-context.tsx`). The `(tabs)/_layout.tsx` wraps children in `ForecastProvider`; screens call `useForecast()`.

### Mock dev scenarios

Pass `?mock=ride|maybe|rest|alert` as a URL query param (web) or deep-link param (native) to load fixture data instead of hitting the live API. The `ForecastProvider` reads `useGlobalSearchParams().mock` and passes it to `useWeatherForecast`.

## Conventions

### Theming (light/dark)

- Colors live in `WheelyTheme.{light,dark}` (`src/constants/theme.ts`), typed as `WheelyPalette`.
- Components are theme-aware: get colors via `useWheelyColors()` and build styles with a `makeStyles(c: WheelyPalette)` function memoized per palette (see the `useWheely()` helper in `wheely-ui.tsx`). Do not hardcode hex values or import the deprecated `WheelyColors` alias in new code.
- Active scheme resolves through `useColorSchemeName()`, which honors `ColorSchemeOverrideContext`. Storybook drives that context from its "Theme" toolbar (`.storybook/preview.tsx`), so new components automatically respond to the toggle.

### Typography

- Roles are defined in `Fonts` (`theme.ts`): `display` (Archivo, stretched), `sans` (IBM Plex Sans), `mono` (IBM Plex Mono).
- Web (Storybook + Expo web) loads fonts via `@fontsource*` `@import`s in `src/global.css`; native loads the matching `@expo-google-fonts/*` families in `app/_layout.tsx`. Update both when adding a weight.
- The stretched display look uses `fontStretch` (web-only) guarded by `Platform.OS === 'web'`.

### Icons

- Use `lucide-react-native` (renders via `react-native-svg`, works on web). Pin to `0.x` — `1.x` currently ships a broken `LucideProvider` barrel export that breaks bundling.
- Icons can't be nested inside `<ThemedText>`; render them as siblings in a row `View` (e.g. the `Chip` `icon` prop, note chips).

### Accessibility & polish

- Add `accessibilityRole`/`accessibilityLabel`/`accessibilityState` and live regions to interactive and status elements.
- Buttons use a neobrutalist pressed effect (`pressedButton`: translate + shadow shift). Home sections fade/rise in with staggered reanimated `FadeInDown`.

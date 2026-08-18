# AGENTS.md

Expo Router app (iOS, Android, web) with a liquid-glass, neobrutalist look, live at wheelyweather.app.

This is the single source of truth for AI assistants working in this repo. There are no other agent config files (no `CLAUDE.md`, `.claude/`, `.cursor/`, or Copilot instructions) — everything lives here.

## Commands

CI (`.github/workflows/ci.yml`, Node 24) runs these in order — match this order when validating:

```bash
npm run format:check   # Prettier check
npm run lint           # ESLint, --max-warnings 0
npm run typecheck      # tsc --noEmit
npm test               # vitest run --project unit
npm run build:web      # expo export --platform web
```

- `npm run check` runs the full suite locally (all 5 steps).
- Single unit test: `npx vitest run --project unit src/domain/weather-codes.test.ts`
- `npm run test:coverage` enforces the thresholds in `vitest.config.ts`: 90% repo-wide (branches 88), and `src/domain/**` held higher — 95% statements/lines, 100% functions. Not a CI gate, but keep the script — without something invoking it, `@vitest/coverage-v8` reads as an unused dep and gets pruned, silently disarming the thresholds.
- Manual E2E (NOT in CI): `npm run test:e2e:app` (vs exported web app).
- `build:web` ends with `Something prevented Expo from exiting, forcefully exiting now.` — that is normal, not a failure.
- Deploys to Cloudflare happen automatically on every push to `main` (dashboard-managed Workers Builds). Deploy config — static asset server, SPA fallback, `/api/*` worker-first — lives in `wrangler.jsonc`, read by Cloudflare on its side.
  - The dashboard runs `npm run build:web` then `npx wrangler deploy`. Wrangler is deliberately **not** a dependency here — `npx` resolves it remotely, so there is no local `wrangler` to run and nothing to bump.
  - Build status and logs in the Cloudflare API lag badly (observed ~30 min stuck on `running`, and `terminated` for builds that were merely queued). To find out what is actually live, check the Worker's `modified_on`, not the build status.
- iOS dev client: `npm run ios` builds/installs/launches; `npm run ios:clean` regenerates native. If Metro won't connect, restart the dev server with `npx expo start --tunnel` (or `--host localhost`).

## Architecture

- Root composition in `src/app/_layout.tsx`: `SettingsProvider` → themed root (`ThemeProvider` + appearance override) → `ForecastProvider` → router stack. Tabs are platform-split — native uses `expo-router/unstable-native-tabs` in `(tabs)/_layout.tsx`, web uses `(tabs)/_layout.web.tsx` plus a fixed `BottomNavBar` in the root layout.
- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`), consumed via `useForecast()`. `useWeatherForecast` (`src/hooks/use-weather-forecast.ts`) drives loading, refresh, location actions, and snapshot cache hydration/persistence. `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) fetches weather, home-climate baseline, and location label first, then returns slower extras (AQI/alerts) separately for post-first-paint merge.
- Mock scenarios (`?mock=ride|maybe|rest|alert`) are latched in `ForecastProvider` so tab navigation does not clear them.
- Services split by platform: shared file + `*.ios.ts*` / `*.web.ts*` siblings. Default paths use Open-Meteo (weather) and Nominatim (geocoding); iOS shadows them with WeatherKit (`weatherService.ios.ts`) and MapKit (`locationSearch.ios.ts`). iOS weather/location modules do **not** fall back to web APIs — they fail with rebuild-required errors, by design.
- In `weatherService.ios.ts`, shared parsing must be imported from `weatherParsing.ts`, never from `weatherService.ts` (importing from `weatherService.ts` causes iOS platform-resolution recursion).
- Native iOS modules: `modules/apple-weatherkit`, `modules/apple-location-search`. Web geocoding is proxied by the Cloudflare Worker `workers/index.mjs`.
- Domain logic is framework-agnostic in `src/domain` / `src/utils`.

## Conventions

- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Import shared Wheely UI primitives from `@/components/wheely/primitives`, not the `@/components/wheely` barrel.
- No inline style color literals — use `useWheelyColors()` and theme tokens from `src/constants/theme.ts`.
- React Compiler is enabled (`app.json`): do not add manual `useMemo`/`useCallback` for performance-only reasons.
- New pure functions in `src/utils` or `src/domain` need a colocated `*.test.ts`; run `npm test` after touching `src/domain`.
- Get user approval before structural or logic changes to `src/domain/scoring.ts`.
- Sentry is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`); native builds set `SENTRY_DISABLE_AUTO_UPLOAD=true` (already in the npm scripts).
- In `vitest.config.ts`, the `unit` project must keep `extends: true` so the `@/` alias resolves for value imports (without it the whole suite crashes the moment a type-only import becomes a value import).

## Task playbooks

Match the playbook to the files you are about to touch. Keep edits surgical and run the specified validation afterward. The general safe-completion checklist for any change is: `npm run format:check` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build:web`.

### 1) UI change — `src/components/**` or `src/app/**`

- Locate the exact component/screen and its adjacent primitives first.
- Enforce theme-token usage (`useWheelyColors`, `src/constants/theme.ts`); no inline color literals.
- List touched files before editing, then apply surgical edits only.
- Validate with `npm run lint` plus the smallest relevant tests.

### 2) Domain or utility logic change — `src/domain/**` or `src/utils/**`

- Identify all call sites for the function or constant before editing.
- Keep logic framework-agnostic in `src/domain` / `src/utils`.
- Add/update colocated unit tests for new pure functions.
- After any domain edit, run `npm test`.

### 3) Platform-specific service change — `**\/*.ios.ts*`, `**\/*.web.ts*`

- Inspect both the default and platform-specific files (`*.ios.ts*`, `*.web.ts*`, shared file) together.
- Preserve the no-fallback rule for iOS weather/location native modules (they fail with rebuild-required errors, not web fallbacks).
- For `weatherService.ios.ts`, import shared parsing from `weatherParsing.ts` only — never `weatherService.ts`.
- Validate with `npx tsc --noEmit` plus targeted tests.

### 4) State / service change — `src/hooks/**` or `src/services/**` (non-platform)

- These are high-blast-radius files: `ForecastProvider` (`src/hooks/forecast-context.tsx`) and the forecast services drive the whole app.
- Identify all call sites before editing (for hooks, find consumers of the hook/context; for services, find callers in `src/hooks` and `src/services/forecastSnapshot.ts`).
- Keep logic framework-agnostic where possible; never introduce web API fallbacks for iOS native modules.
- Add or update unit tests for new pure logic; run `npm test` afterward.

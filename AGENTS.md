# AGENTS.md

Expo Router app (iOS, Android, web) with a liquid-glass, neobrutalist look, live at wheelyweather.app.

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
- `npm run test:coverage` enforces the 90% thresholds in `vitest.config.ts`. Not a CI gate, but keep the script — without something invoking it, `@vitest/coverage-v8` reads as an unused dep and gets pruned, silently disarming the thresholds.
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
- Full playbooks for UI / domain / platform-service changes: `.claude/rules/*.md` and `.github/copilot-instructions.md`.

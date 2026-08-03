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
- Manual E2E (NOT in CI): `npm run test:e2e:app` (vs exported web app).
- `npm run deploy:web` = `build:web` then `wrangler deploy` to Cloudflare. Static asset server; SPA fallback and `/api/*` worker-first are set in `wrangler.jsonc`.
- iOS dev client: `npm run ios` builds/installs/launches; `npm run ios:clean` regenerates native. If Metro won't connect, restart the dev server with `npx expo start --tunnel` (or `--host localhost`).

## Architecture

- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`), consumed via `useForecast()`. `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) fetches weather, home-climate baseline, and location label first, then returns slower extras (AQI/alerts) separately for post-first-paint merge.
- Mock scenarios (`?mock=ride|maybe|rest|alert`) are latched in `ForecastProvider` so tab navigation does not clear them.
- Services split by platform: shared file + `*.ios.ts*` / `*.web.ts*` siblings. iOS weather/location modules do **not** fall back to web APIs — they fail with rebuild-required errors, by design.
- In `weatherService.ios.ts`, shared parsing must be imported from `weatherParsing.ts`, never from `weatherService.ts` (importing from `weatherService.ts` causes iOS platform-resolution recursion).
- Native iOS modules: `modules/apple-weatherkit`, `modules/apple-location-search`. Web geocoding is proxied by the Cloudflare Worker `workers/index.mjs`.
- Domain logic is framework-agnostic in `src/domain` / `src/utils`.

## Conventions

- Import shared Wheely UI primitives from `@/components/wheely/primitives`, not the `@/components/wheely` barrel.
- No inline style color literals — use `useWheelyColors()` and theme tokens from `src/constants/theme.ts`.
- React Compiler is enabled (`app.json`): do not add manual `useMemo`/`useCallback` for performance-only reasons.
- New pure functions in `src/utils` or `src/domain` need a colocated `*.test.ts`; run `npm test` after touching `src/domain`.
- Get user approval before structural or logic changes to `src/domain/scoring.ts`.
- Sentry is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`); native builds set `SENTRY_DISABLE_AUTO_UPLOAD=true` (already in the npm scripts).
- In `vitest.config.ts`, the `unit` project must keep `extends: true` so the `@/` alias resolves for value imports (without it the whole suite crashes the moment a type-only import becomes a value import).
- Full playbooks for UI / domain / platform-service changes: `.claude/rules/*.md` and `.github/copilot-instructions.md`.

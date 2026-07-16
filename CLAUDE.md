# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repository root. CI (`.github/workflows/ci.yml`) runs these in order — always match this order when validating changes:

```bash
npm run format:check   # Prettier check
npm run lint           # ESLint, --max-warnings 0
npx tsc --noEmit       # TypeScript typecheck
npm test               # vitest run --project unit
npm run build:web      # expo export --platform web
```

Single test file: `npx vitest run --project unit src/domain/weather-codes.test.ts`

Storybook component tests (not run in CI): `npx vitest run --project storybook`

Other useful commands:

```bash
npm run web / ios / android     # run the app (ios builds/installs + starts dev server)
npm run ios:install             # build/install iOS dev app without starting Metro
npm run ios:start               # launch an already-installed iOS dev build
npm run ios:start:localhost     # relaunch dev build, localhost host (fixes flaky Metro connectivity)
npm run ios:start:tunnel        # relaunch dev build, tunnel host
npm run ios:clean               # clean native iOS regen + build/install + launch
npm run storybook:web           # component workshop at http://localhost:6006
npm run deploy:web              # build then deploy web build via Wrangler (Cloudflare)
```

`npm run test:e2e` (Playwright vs Storybook) and `npm run test:e2e:app` (Playwright vs exported web app) are not part of CI and are run manually.

## Architecture

Expo Router app (iOS, Android, web) with a liquid-glass, neobrutalist look, live at wheelyweather.app.

- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`), consumed via `useForecast()`.
  - `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) builds the UI snapshot: fetches weather data, home-climate baseline, and location label, then returns slower extras (AQI/alerts) separately for post-first-paint merge.
  - Mock scenarios (`?mock=ride|maybe|rest|alert`) are intentionally latched in `ForecastProvider` so tab navigation doesn't clear them — see the `latchedMock` state there.
- Services are split by platform:
  - iOS weather/location modules do **not** fall back to web APIs when native modules are unavailable — they fail with rebuild-required errors, by design.
  - In `weatherService.ios.ts`, shared parsing must be imported from `weatherParsing.ts`, never from `weatherService.ts` — importing from `weatherService.ts` causes iOS platform-resolution recursion.

## Conventions

- Import shared Wheely UI primitives from `@/components/wheely/primitives`, not the `@/components/wheely` barrel.
- Theming is strict: no inline style color literals — use `useWheelyColors()` and theme tokens from `src/constants/theme.ts`.
- React Compiler is enabled (`app.json`) — do not add manual `useMemo`/`useCallback` for performance-only reasons.
- Sentry init is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`); native builds may need `SENTRY_DISABLE_AUTO_UPLOAD=true` when upload credentials aren't configured (already set in the `ios*` npm scripts).
- When adding a new pure function in `src/utils` or `src/domain`, add a colocated unit test (e.g. `foo.ts` + `foo.test.ts`).
- After modifying files in `src/domain`, run `npm test`.
- **Get user approval before making structural or logic changes to `src/domain/scoring.ts`.**

## Task playbooks

Task-specific playbooks (UI changes, domain/utility logic changes, platform-specific service changes) live in `.claude/rules/` and load automatically when working under their matching paths.

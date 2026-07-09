# AGENTS.md

Kilo-specific flight manual for Wheely Weather. For the full architecture, conventions, and toolchain constraints, see [`.agents/AGENTS.md`](./.agents/AGENTS.md).

## Commands

From the repo root (`/Users/noah/Projects/wheely-weather`):

| Command                                           | Purpose                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `npm run web` / `npm run ios` / `npm run android` | Run the app                                               |
| `npm run storybook:web`                           | Storybook at http://localhost:6006                        |
| `npm run build:web`                               | Export the web build (`expo export --platform web`)       |
| `npm run deploy:web`                              | Build then deploy the web build via Wrangler (Cloudflare) |

## Quality gates

Mirror CI (`.github/workflows/ci.yml`), run in this order:

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test
npm run build:web
```

`npm run test:e2e` (Playwright against Storybook) and `npm run test:e2e:app` (Playwright against the exported web app) aren't part of CI and are run manually.

## Architecture

For the full architecture, conventions, and toolchain constraints, see [`.agents/AGENTS.md`](./.agents/AGENTS.md).

## High-signal gotchas

- **iOS platform-split files** (`weatherService.ios.ts`, `locationSearch.ios.ts`) shadow the web implementations and **do not auto-fallback**. They call the `apple-weatherkit` / `apple-location-search` Expo Modules, which are local modules under `./modules` auto-discovered by Expo Autolinking (the canonical local-module convention — no `package.json` or root dependency entry; discovery keys off each module's `expo-module.config.json`) and linked into the iOS pod via `pod install`. JS imports them by relative path (`weatherService.ios.ts`, `locationSearch.ios.ts`), so Metro resolves them regardless of autolinking. `fetchOpenMeteoData` throws `"WeatherKit not available — rebuild the native app."` if the native module is ever missing (e.g. a JS-only build without a native rebuild).
- **Infinite-recursion risk**: `weatherService.ios.ts` must import shared parsing helpers from `weatherParsing.ts`, never from `weatherService.ts`. Metro resolves `./weatherService` back to `weatherService.ios.ts` on iOS.
- **Mock scenarios are latched**: `?mock=ride|maybe|rest|alert` drops from query params on RN tab switches. `ForecastProvider` latches the last-seen value so mock mode persists across tab navigation.
- **React Compiler** is enabled (`app.json` `experiments.reactCompiler: true`). Do not add manual `useMemo`/`useCallback` for performance.
- **Path aliases**: `@/*` → `./src/*`, `@/assets/*` → `./assets/*`.
- **Sentry**: `initSentry()` runs at module load and is a no-op without `EXPO_PUBLIC_SENTRY_DSN`. `_layout.tsx` conditionally applies `Sentry.wrap()` to avoid a spurious init warning. For native builds, set `SENTRY_DISABLE_AUTO_UPLOAD` (real env var) or the sentry-cli upload phase aborts the build.
- **No inline styles or raw hex codes**: `react-native/no-color-literals` is an ESLint error — use `useWheelyColors()`.
- **`src/domain/scoring.ts`**: structural or logic changes require user approval before modifying.
- **Barrel vs direct imports**: import from `@/components/wheely/primitives`, **not** the barrel (`@/components/wheely`).

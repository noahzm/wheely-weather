# AGENTS.md

Expo Router app (iOS, Android, web) with a liquid-glass, neobrutalist look, live at wheelyweather.app.

Platform priority: **iOS first**, the web app is the fallback, and Android is kept working for a possible future release but is largely untested. Verify on the iOS simulator first, then web; mark Android-only behavior as untested rather than assuming it works.

This is the single source of truth for AI assistants working in this repo. No other agent config is committed (no `CLAUDE.md`, `.cursor/`, or Copilot instructions; a local `.claude/` may exist but is tool-generated and untracked) — everything lives here.

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
- `npm run test:coverage` enforces the thresholds in `vitest.config.mts` over all of `src/domain`, `src/utils`, and `src/services` (platform `*.ios`/`*.web` files excluded): ~89% floor (branches 83), and `src/domain/**` held higher — 95% statements/lines, 100% functions, branches 90. Not a CI gate, but keep the script — without something invoking it, `@vitest/coverage-v8` reads as an unused dep and gets pruned, silently disarming the thresholds.
- There are no automated E2E tests. To check the web app, run `npm run web` (or serve the `npm run build:web` export) and verify in the built-in browser.
- `build:web` ends with `Something prevented Expo from exiting, forcefully exiting now.` — that is normal, not a failure.
- Deploys to Cloudflare happen automatically on every push to `main` (dashboard-managed Workers Builds). Deploy config — static asset server, SPA fallback, `/api/*` worker-first, Workers Logs — lives in `wrangler.jsonc`, read by Cloudflare on its side.
  - The dashboard runs `npm run build:web` then `npx wrangler deploy`. Wrangler is deliberately **not** a dependency here — `npx` resolves it remotely, so there is no local `wrangler` to run and nothing to bump.
  - Build status and logs in the Cloudflare API lag badly (observed ~30 min stuck on `running`, and `terminated` for builds that were merely queued). To find out what is actually live, check the Worker's `modified_on`, not the build status.
- iOS dev client: `npm run ios` builds/installs/launches; `npm run ios:clean` regenerates native. If Metro won't connect, restart the dev server with `npx expo start --tunnel` (or `--host localhost`).
  - Native builds are slow on this machine, so avoid them: JS/TS-only changes need no rebuild (keep the installed dev client and run `npx expo start`). Rebuild only after native changes (native deps, `app.json` plugins/native config, Swift in `modules/`), and prefer `npm run ios` over `ios:clean`.
  - `app.json` sets `buildCacheProvider: { plugin: "expo/local-build-cache-provider" }` (the object form; the CLI rejects the bare string its README shows): `expo run:ios` stores each built app in `.expo/build-cache/` keyed by the native fingerprint and reinstalls it without compiling when nothing native changed. The fingerprint doesn't cover `targets/` by default, so `fingerprint.config.js` adds it; without that, widget-only changes silently reinstalled a stale build. ccache does not help here: Xcode 27's build system invokes clang directly and ignores React Native's `CC` wrapper, so `apple.ccacheEnabled` was tried and removed.
  - The EAS production profile pins `ios.image` to `macos-tahoe-26.5-xcode-26.6`. Building against the iOS 27 SDK (Xcode 27, which local builds use) folds the `role="search"` native tab back into the tab bar, because react-native-screens still uses the legacy `UITabBarItem` search item instead of `UISearchTab` ([software-mansion/react-native-screens#4671](https://github.com/software-mansion/react-native-screens/issues/4671)). Remove the pin once an Expo SDK ships the fix.
  - If `pod install` crashes with `Encoding::CompatibilityError`, the shell locale isn't UTF-8: rerun with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

## Architecture

- Root composition in `src/app/_layout.tsx`: `SettingsProvider` → themed root (`ThemeProvider` + appearance override) → `ForecastProvider` → router stack. Tabs are platform-split — native uses `expo-router/unstable-native-tabs` in `(tabs)/_layout.tsx`, web uses `(tabs)/_layout.web.tsx` plus a fixed `BottomNavBar` in the root layout.
- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`), consumed via `useForecast()`. `useWeatherForecast` (`src/hooks/use-weather-forecast.ts`) drives loading, refresh, location actions, and cache hydration; its pieces live in `src/hooks/forecast/`. `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) fetches weather, home-climate baseline, and location label first, then returns slower extras (AQI/alerts) separately for post-first-paint merge.
- Mock scenarios (`?mock=ride|maybe|rest|alert`) are latched in `ForecastProvider` so tab navigation does not clear them.
- Services split by platform: shared file + `*.ios.ts*` / `*.web.ts*` siblings. Default paths use Open-Meteo (weather) and Nominatim (geocoding); iOS shadows them with WeatherKit (`weatherService.ios.ts`) and MapKit (`locationSearch.ios.ts`). iOS weather/location modules do **not** fall back to web APIs — they fail with rebuild-required errors, by design.
- In `weatherService.ios.ts`, shared parsing must be imported from `weatherParsing.ts`, never from `weatherService.ts` (importing from `weatherService.ts` causes iOS platform-resolution recursion).
- Native iOS modules: `modules/apple-weatherkit`, `modules/apple-location-search`. Web geocoding is proxied by the Cloudflare Worker `workers/index.mjs`.
- Home screen widget: `targets/widget` (SwiftUI, generated into the Xcode project by `@bacons/apple-targets` on prebuild). It can't run TS scoring, so `useWidgetSync` builds a display-ready `WidgetSnapshot` (`src/utils/widgetSnapshot.ts`) and writes it to the `group.app.wheelyweather` App Group; `WheelyWidget.swift` decodes the same field names. Changing the payload means changing both sides. `targets/*/Assets.xcassets` is regenerated from `expo-target.config.js`.
- Domain logic is framework-agnostic in `src/domain` / `src/utils`.
- The verdict (home card and widget) comes from `getRideVerdict` (`src/domain/verdict.ts`): it rates today's best daylight ride window, or tomorrow's once no daylight is left. `getOverallStatus` is the building block it rates with, and the fallback when no window exists.
- Thresholds are resolved per rider by `resolveThresholds` (`src/domain/acclimatization.ts`): the home climate's recent warm, humid and cool extremes, scaled by the exposure level, shift the comfort bands. Hazards currently stay fixed: the heat and dewpoint ceilings, freezing-precipitation weather codes, and the cold-rain rule.

## Forecast invariants

Each of these has caused a real bug when broken.

- **Cache only matching pairs.** The forecast cache (disk + memory) is written in `applyForecastSuccess` and the extras-merge callback, where the snapshot is known to belong to `savedLocation`. Never persist from an effect watching state: during a location switch, state briefly holds the new location with the previous place's snapshot.
- **Every load settles `refreshing`.** Any path that sets `refreshing: true` must end in `loadForecast` (or explicitly clear it), including fallback branches.
- **Explain with the rating's thresholds.** Reason helpers (`getDayConditionReason`, `getHourConditionReasons`) must receive `snapshot.acclimatization.thresholds`; their `THRESHOLDS` default silently disagrees with acclimatized ratings.
- **Mock mode never touches GPS.** Relocation goes through `relocate` / `canRelocate` in `use-weather-forecast.ts`; mock previews must not run GPS or overwrite the persisted device fix.

## Conventions

- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Import shared Wheely UI primitives from `@/components/wheely/primitives`, not the `@/components/wheely` barrel.
- No inline style color literals — use `useWheelyColors()` and theme tokens from `src/constants/theme.ts`.
- React Compiler is enabled (`app.json`): do not add manual `useMemo`/`useCallback` for performance-only reasons.
- Reanimated shared values: use `.set()` / `.get()`, not `.value =` — the React Compiler lint rule (`react-hooks/immutability`) flags `.value` writes.
- Sentry is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`). Source maps upload only from EAS production builds (`SENTRY_AUTH_TOKEN` is an EAS secret there); local native builds and the development/preview EAS environments set `SENTRY_DISABLE_AUTO_UPLOAD=true` (already in the npm scripts). `metro.config.js` must keep `getSentryExpoConfig`, which injects the debug IDs that tie events to uploaded maps.
- ESLint type-aware linting uses `tsconfig.eslint.json` (includes test files), while `npm run typecheck` uses `tsconfig.json` (excludes them). A test file may pass typecheck but fail lint, or vice versa.
- `max-params` is 5: pass a function or an options object rather than a sixth argument.
- Commits use conventional prefixes, with an optional scope (`fix(forecast): …`). The usual ones are `feat`, `fix`, `chore`, `docs`, `deps`, `ci`, but any standard prefix (`perf`, `refactor`, `test`, …) is fine.

## Testing

- New pure functions in `src/utils` or `src/domain` need a colocated `*.test.ts`.
- Tests run in Node with no React renderer, so hooks are not unit-tested. Keep hook logic in pure functions beside the hook and test those (see `src/hooks/forecast/load-forecast-data.ts`, `merge-extras.ts`).
- Mock AsyncStorage and telemetry with `vi.hoisted` + `vi.mock` over an in-memory `Map` (see `src/services/locationStorage.test.ts`); stub network calls with `vi.stubGlobal('fetch', …)`.
- In `vitest.config.mts`, the `unit` project must keep `extends: true` so the `@/` alias resolves for value imports (without it the whole suite crashes the moment a type-only import becomes a value import).

## Dependencies

- **Dependabot never bumps the Expo families** (`expo*`, `@expo/*`, `react-native*`, `react`, `typescript`, `@sentry/react-native`, …); the SDK release train owns them. In every dependency sweep, also run `npx expo-doctor`; if its version-match check fails, run `npx expo install --fix` then `npm run check`. If `pod install` then complains about old podspecs, run `npm run ios:clean`.
- **Never run `npm audit fix --force`.** Its "fixes" are multi-major downgrades of Expo and React Native. The standing audit findings trace to two build-time-only roots with no upstream fix (`image-size` under metro, `uuid` pinned by `xcode` under `@expo/config-plugins`); treat them as accepted.
- **Leave the npm install-script warnings alone.** The blocked scripts (`@sentry/cli`, `fsevents`, `unrs-resolver`) are fallbacks for binaries that already arrive via optional dependencies, so don't approve them. Never install with `--omit=optional`: that removes those binaries and breaks Sentry uploads in EAS builds.
- `@types/node` tracks the Node major CI runs (24); bump it together with `ci.yml` and `engines`.

## Task playbooks

Match the playbook to the files you are about to touch, keep edits surgical, and validate with the Commands sequence above (or `npm run check`).

- **UI (`src/components/**`, `src/app/**`)**: find the component and its adjacent primitives first; theme tokens only.
- **Domain / utils (`src/domain/**`, `src/utils/**`)**: find every call site before changing a function or constant; add or update colocated tests.
- **Platform services (`**/*.ios.ts*`, `**/*.web.ts*`)**: read the shared file and every platform sibling together; keep the iOS no-fallback rule and the `weatherParsing.ts` import rule.
- **State / services (`src/hooks/**`, `src/services/**`)**: high blast radius — `ForecastProvider` and the forecast services drive the whole app. Find all consumers first and check the forecast invariants above.

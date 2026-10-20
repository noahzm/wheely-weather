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
npm run test:coverage  # unit tests (vitest --project unit) plus coverage floors
npm run build:web      # expo export --platform web
```

- `npm run check` runs the full suite locally (all 5 steps), with plain `npm test` in place of the coverage run.
- Single unit test: `npx vitest run --project unit src/domain/weather-codes.test.ts`
- `npm run test:coverage` enforces the thresholds in `vitest.config.mts` over all of `src/domain`, `src/utils`, and `src/services` (platform `*.ios`/`*.web` files excluded): statements 93, branches 90, functions and lines 95, and `src/domain/**` held higher — 95% statements/lines, 100% functions, branches 90. CI runs it, so falling below a floor fails the build.
- iOS end-to-end flows live in `.maestro/` and run locally with `npm run e2e:ios` (about a minute): Metro must be running and the dev client installed on a booted simulator. Each flow loads the bundle, opens a mock scenario by deep link (`wheelyweather:///?mock=…`; the third slash matters, without a path the param is dropped) and checks the home screen; `tabs.yaml` also checks the scenario survives tab switches. Mock data is keyed to the clock, so flows match star ranges and stable text, never the rotating verdict headline. They don't run in CI: that would need paid macOS runners. Maestro itself is a local install (`curl -fsSL "https://get.maestro.mobile.dev" | bash`, needs Java 17+), not an npm dependency.
- There are no automated web E2E tests. To check the web app, run `npm run web` (or serve the `npm run build:web` export) and verify in the built-in browser.
- `build:web` ends with `Something prevented Expo from exiting, forcefully exiting now.` — that is normal, not a failure.
- Deploys to Cloudflare happen automatically on every push to `main` (dashboard-managed Workers Builds). Deploy config — static asset server, SPA fallback, `/api/*` worker-first, Workers Logs — lives in `wrangler.jsonc`, read by Cloudflare on its side. Only `/api/*` reaches the Worker: pages and files are served straight from `dist/`, so their security and caching headers live in `public/_headers`, not in Worker code.
  - The dashboard runs `npm run build:web` then `npx wrangler deploy`, which uses the pinned `wrangler` devDependency. Cloudflare deploys separately from GitHub CI, so `wrangler.jsonc` sets `build.command` to `npm test`: Wrangler runs it before every deploy, and a failing test stops the deploy.
  - Build status and logs in the Cloudflare API lag badly (observed ~30 min stuck on `running`, and `terminated` for builds that were merely queued). To find out what is actually live, check the Worker's `modified_on`, not the build status.
- iOS dev client: `npm start -- --ios` boots the simulator, launches the installed dev client, and starts Metro; `npm run ios` builds/installs/launches; `npm run ios:clean` regenerates native. Always use `npm start` / `npm run ios` rather than bare `npx expo …`. If Metro won't connect, restart the dev server with `npm start -- --tunnel`. Avoid `--host localhost`: Metro then listens only on IPv6 `[::1]`, while the dev client connects to `127.0.0.1`.
  - Native builds are slow on this machine, so avoid them: JS/TS-only changes need no rebuild (keep the installed dev client and run `npm start -- --ios`). Rebuild only after native changes (native deps, `app.json` plugins/native config, Swift in `modules/` or `targets/`), and prefer `npm run ios` over `ios:clean`.
  - `app.json` sets `buildCacheProvider: { plugin: "expo/local-build-cache-provider" }` (the object form; the CLI rejects the bare string its README shows): `expo run:ios` stores each built app in `.expo/build-cache/` keyed by the native fingerprint and reinstalls it without compiling when nothing native changed. The fingerprint doesn't cover `targets/` by default, so `fingerprint.config.js` adds it; without that, widget-only changes silently reinstalled a stale build. ccache does not help here: Xcode 27's build system invokes clang directly and ignores React Native's `CC` wrapper, so `apple.ccacheEnabled` was tried and removed. Instead, `plugins/withCompilationCache.js` turns on Xcode's own compilation cache (`COMPILATION_CACHE_ENABLE_CACHING`) for the app and every pod, so a native change that re-runs `pod install` rebuilds in about a minute instead of a full ~20-minute recompile.
  - The EAS profiles build on the default image. They used to pin `ios.image` to `macos-tahoe-26.5-xcode-26.6` because react-native-screens `~4.26.0` still used the legacy `UITabBarItem` search item instead of `UISearchTab` ([software-mansion/react-native-screens#4671](https://github.com/software-mansion/react-native-screens/issues/4671)), folding the `role="search"` native tab back into the tab bar on the iOS 27 SDK; Expo SDK 58 ships `react-native-screens` 4.30.0 with the fix ([#4679](https://github.com/software-mansion/react-native-screens/pull/4679)), so the pin was removed.

## Architecture

- Root composition in `src/app/_layout.tsx`: `SettingsProvider` → themed root (`ThemeProvider` + appearance override) → `ForecastProvider` → router stack. Tabs are platform-split — native uses `expo-router/unstable-native-tabs` in `(tabs)/_layout.tsx`, web renders every layout as a `Slot` (no stacks) so the document itself scrolls — Safari's toolbar collapse and pull to refresh depend on it — with a fixed `BottomNavBar` and per-page scroll memory (`useWebScrollMemory`) in the root layout. Don't reintroduce Expo's `ScrollViewStyleReset` or a web `Stack`: both pin screens to the window height.
- Forecast state is centralized in `ForecastProvider` (`src/hooks/forecast-context.tsx`), consumed via `useForecast()`. `useWeatherForecast` (`src/hooks/use-weather-forecast.ts`) drives loading, refresh, location actions, and cache hydration; its pieces live in `src/hooks/forecast/`. `getForecastSnapshot` (`src/services/forecastSnapshot.ts`) fetches weather, home-climate baseline, and location label first, then returns slower extras (AQI/alerts) separately for post-first-paint merge.
- Mock scenarios (`?mock=ride|maybe|rest|alert|wait`) are latched in `ForecastProvider` so tab navigation does not clear them.
- Services split by platform: shared file + `*.ios.ts*` / `*.web.ts*` siblings. Default paths use Open-Meteo (weather) and Nominatim (geocoding); iOS shadows them with WeatherKit (`weatherService.ios.ts`), MapKit (`locationSearch.ios.ts`) and Apple's reverse geocoder (`locationGeocoding.ios.ts`, which reuses the placemark the WeatherKit module already looks up for the forecast's time zone). iOS weather/location modules do **not** fall back to web APIs — they fail with rebuild-required errors, by design.
- Forecast services: `weatherFetch.ts` makes the network calls, `weatherParsing.ts` turns the `OpenMeteoData` payload into `Weather`, and `weatherService*.ts` picks sources per platform. The platform files must import shared code from `weatherFetch.ts` / `weatherParsing.ts`, never from `weatherService.ts` (that resolves back to the platform file itself and recurses).
- Native iOS modules: `modules/apple-weatherkit`, `modules/apple-location-search`. Web geocoding is proxied by the Cloudflare Worker `workers/index.ts`.
- Web forecasts also come from WeatherKit, via the Worker's `/api/forecast`: one edge-cached response bundling the forecast and alerts (a single Apple request; `workers/weatherkit.ts` signs it and reshapes it into `OpenMeteoData`, like the native module) with Open-Meteo's AQI. It needs four Worker secrets (`WEATHERKIT_TEAM_ID`, `WEATHERKIT_SERVICE_ID`, `WEATHERKIT_KEY_ID`, `WEATHERKIT_PRIVATE_KEY`) and returns 503 without them. REST alerts need the location's country (`country=`, not the `countryCode` Apple's docs name; a wrong one silently returns none), `alertCountry` infers the country from the time zone — the US (including Puerto Rico and the US Virgin Islands), Canada, the UK, Ireland, most of western Europe, Australia, New Zealand, Japan and South Korea, with new zones added to `ZONE_COUNTRIES` in `workers/weatherkit.ts` as coverage expands; a 400 (no alert coverage there) is retried without alerts. `weatherService.web.ts` shares one bundle request between the forecast and the extras; unlike iOS, it falls back to Open-Meteo and NWS on any failure, and the dev server (no Worker) always uses them. REST condition codes differ from the Swift enum; `restConditionToWmoCode` translates them.
- Home screen widget: `targets/widget` (SwiftUI, generated into the Xcode project by `@bacons/apple-targets` on prebuild). It can't run TS scoring, so `useWidgetSync` builds a display-ready `WidgetSnapshot` (`src/services/widgetSnapshot.ts`) and writes it to the `group.app.wheelyweather` App Group; `WheelyWidget.swift` decodes the same field names. Changing the payload means changing both sides. The widget only changes when the app writes to it, so each payload also carries the next 12 hours' verdicts (`upcoming`, rated by re-parsing the forecast with `forecastFromHour`), and `expo-background-task` re-fetches the forecast every few hours when iOS allows (`src/hooks/forecast/background-refresh.ts`). The iOS simulator never runs background tasks: verify that path on a device. `targets/widget/Assets.xcassets` is regenerated from `targets/widget/expo-target.config.js`.
- Domain logic is framework-agnostic in `src/domain` / `src/utils`.
- Each day's best ride window (the best three daylight hours, rated worst-case) is picked in `src/domain/ride-window.ts`; `weatherParsing.ts` only collects the hours.
- The verdict (home card and widget) comes from `getRideVerdict` (`src/domain/verdict.ts`): it rates today's best daylight ride window, or tomorrow's once no daylight is left. `getOverallStatus` is the building block it rates with, and the fallback when no window exists.
- Thresholds are resolved per rider by `resolveThresholds` (`src/domain/acclimatization.ts`): the home climate's recent warm, humid and cool extremes, scaled by the exposure level, shift the comfort bands. Home climate is auto-assigned to the first place a rider loads (`pickAutoHomeLocation`), provisionally: a home from a search gives way to the first GPS fix, while anything the rider picks (house buttons in Search) is final, and clearing it stores a marker so it stays off. Hazards stay fixed: the heat and dewpoint ceilings, freezing-precipitation weather codes, and cold rain at or below 40°F (only the mild 40–45°F cold-rain band softens to marginal for cold-adapted riders).

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
- Reanimated shared values: use `.set()` / `.get()`, not `.value =`, in render scope — React Compiler memoizes render and treats a direct write as a side effect. Inside effects and worklets, `.value =` is fine (and common). No lint rule catches Reanimated writes: `react-hooks/immutability` is enabled in `eslint.config.js` but only knows React values (`useState` results and the like), so this convention is enforced by review, not tooling.
- Sentry is DSN-gated (`EXPO_PUBLIC_SENTRY_DSN`) and off in `__DEV__` (`sentryEnabled` in `src/services/telemetry.ts`), so dev builds on the simulator never report, even with the DSN in `.env`. Source maps upload only from EAS production builds (`SENTRY_AUTH_TOKEN` is an EAS secret there); local native builds and the development/preview EAS environments set `SENTRY_DISABLE_AUTO_UPLOAD=true` (already in the npm scripts). `metro.config.js` must keep `getSentryExpoConfig`, which injects the debug IDs that tie events to uploaded maps.
- One `tsconfig.json` covers app code and tests, for both `tsc` and type-aware ESLint. Its `extends` must stay `expo/tsconfig.base.json` — the extensionless `expo/tsconfig.base` stopped resolving through expo's `exports` map in SDK 58, which tsc tolerates but vitest's oxc transform does not (every test file fails with `Failed to load tsconfig 'expo/tsconfig.base'`). Typed routes are on: `npm run typegen` (`expo customize tsconfig.json`) writes `.expo/types/router.d.ts` and `expo-env.d.ts`, both gitignored, and `lint`/`typecheck` run it first so CI checks the same route types as a dev machine.
- `max-params` is 5: pass a function or an options object rather than a sixth argument.

## Git and deploys

Every push to `main` deploys the web app, so treat each push as a release.

- Leave work uncommitted until Noah has reviewed it and asks for a commit or push.
- Don't push docs-only changes (README, AGENTS.md, CONTRIBUTING.md, …) on their own; they ride along with the next code change.
- Before a push or an EAS build, run `npm run check` and `npx expo-doctor`, and fix any version mismatch first. Before an EAS production build, and after any Expo SDK or React Native bump, also run `npm run e2e:ios`.
- Commits use conventional prefixes, with an optional scope (`fix(forecast): …`). The usual ones are `feat`, `fix`, `chore`, `docs`, `deps`, `ci`, but any standard prefix (`perf`, `refactor`, `test`, …) is fine.
- Commits are attributed to Noah alone: no `Co-Authored-By` or other AI attribution trailers.
- `Fixes WHEELY-WEATHER-N` in a commit body resolves that Sentry issue (Sentry is linked to the repo).
- Dependabot PRs are squash-merged once CI is green and Noah approves.

## Testing

- New pure functions in `src/utils` or `src/domain` need a colocated `*.test.ts`.
- Tests run in Node with no React renderer, so hooks are not unit-tested. Keep hook logic in pure functions beside the hook and test those (see `src/hooks/forecast/load-forecast-data.ts`, `merge-extras.ts`).
- Mock AsyncStorage and telemetry with `vi.hoisted` + `vi.mock` over an in-memory `Map` (see `src/services/locationStorage.test.ts`); stub network calls with `vi.stubGlobal('fetch', …)`.
- In `vitest.config.mts`, the `unit` project must keep `extends: true` so the `@/` alias resolves for value imports (without it the whole suite crashes the moment a type-only import becomes a value import).

## Dependencies

- **Dependabot never bumps the Expo families** (`expo*`, `@expo/*`, `react-native*`, `react`, `typescript`, `@sentry/react-native`, …); the SDK release train owns them. In every dependency sweep, also run `npx expo-doctor`; if its version-match check fails, run `npx expo install --fix` then `npm run check`. If `pod install` then complains about old podspecs, run `npm run ios:clean`.
- **Never run `npm audit fix --force`.** Its "fixes" are multi-major downgrades of Expo and React Native. The standing audit findings trace to build-time-only roots with no upstream fix (`uuid@8` under `@bacons/apple-targets` → `@bacons/xcode`, which lists it but never imports it; `braces` under metro's `metro-file-map` (via `micromatch`), which only expands local config globs; `node-forge` under `@expo/cli` and `@expo/code-signing-certificates`, unused because EAS Update code signing isn't configured and on-device verification is native); treat them as accepted. The matching Dependabot alerts are dismissed as `not_used`; dismiss new ones the same way only after confirming the path is still build-time.
- **Keep the `overrides` in `package.json` across upgrades.** Each one is deliberate: `typescript: "$typescript"` keeps one TypeScript for every tool (expo-doctor flags a mismatch otherwise); `xcode` → `uuid ^11.1.1` clears GHSA-w5hq-g745-h8pq (xcode only calls `uuid.v4()`); `@bacons/xcode` → `@xmldom/xmldom ^0.8.15` keeps its old `@expo/plist` off the vulnerable xmldom 0.7. An SDK bump or `npx expo install --fix` can drop them, so after one, check they're still there and that `npm audit` shows only the accepted findings above. Remove an override only once `npm ls` shows the upstream range no longer needs it.
- **Leave the npm install-script warnings alone.** The blocked scripts (`@sentry/cli`, `fsevents`, `unrs-resolver`, and wrangler's `esbuild` and `workerd`) are fallbacks for binaries that already arrive via optional dependencies, so don't approve them. `@sentry/cli` shows up twice (3.x under `@sentry/react-native`, 2.x under `@sentry/bundler-plugins`); both come from Sentry's own dependencies and each gets its platform binary, so leave the duplicate alone. Never install with `--omit=optional`: that removes those binaries and breaks Sentry uploads in EAS builds.
- `@types/node` tracks the Node major CI runs (24); bump it together with `ci.yml` and `engines`.
- `dependabot.yml` also holds back major versions of `@babel/core`, `eslint` and `eslint-plugin-unicorn` until the Expo toolchain supports them; don't bump those majors by hand either.

## Task playbooks

Match the playbook to the files you are about to touch, keep edits surgical, and validate with the Commands sequence above (or `npm run check`).

- **UI (`src/components/**`, `src/app/**`)**: find the component and its adjacent primitives first; theme tokens only.
- **Domain / utils (`src/domain/**`, `src/utils/**`)**: find every call site before changing a function or constant; add or update colocated tests.
- **Platform services (`**/*.ios.ts*`, `**/*.web.ts*`)**: read the shared file and every platform sibling together; keep the iOS no-fallback rule and the `weatherParsing.ts` import rule.
- **State / services (`src/hooks/**`, `src/services/**`)**: high blast radius — `ForecastProvider` and the forecast services drive the whole app. Find all consumers first and check the forecast invariants above.

# Link native `apple-weatherkit` (and `apple-location-search`) Expo modules into the iOS build

## Context / Root cause

On TestFlight, pull-to-refresh shows the stale/error banner ("Couldn't refresh the forecast").
The iOS platform-split `fetchOpenMeteoData` (`src/services/weatherService.ios.ts:104`) calls
`AppleWeatherKitModule.forecast(...)`, but `AppleWeatherKitModule` is `null` at runtime because
the native module is **not present in the compiled app binary**.

Why it's missing:
- `modules/apple-weatherkit/` has **no `package.json`** — Expo Modules autolinking requires one.
- It is **not declared** as a dependency in root `package.json` and is **not in `node_modules`**.
- Consequently `ios/Pods`, the `.xcodeproj`, and the `.xcworkspace` contain **no `AppleWeatherKit` pod**.

So `requireOptionalNativeModule('AppleWeatherKit')` (`modules/apple-weatherkit/src/AppleWeatherKitModule.ts:16`)
returns `null`, and `fetchOpenMeteoData` throws `"WeatherKit not available — rebuild the native app."`
on every refresh. AGENTS.md documents this as the *current* state ("returns null/throw until a native
rebuild links the module"). The WeatherKit entitlement (`app.json:17-19`) and the Apple Developer Portal
capability are already correctly enabled — those are NOT the problem.

The sibling `modules/apple-location-search/` (MapKit search) has the identical defect (no `package.json`,
not linked), so it's fixed in the same change. Scope confirmed: **both modules**.

## Tasks (ordered)

1. **Add `package.json` to `modules/apple-weatherkit/`** (root of the module):
   ```json
   {
     "name": "apple-weatherkit",
     "version": "1.0.0",
     "main": "src/index.ts",
     "peerDependencies": { "expo": "*" }
   }
   ```
   The existing `expo-module.config.json` (`platforms: ["apple","web"]`) stays as-is; do not duplicate
   its config into `package.json`.

2. **Add `package.json` to `modules/apple-location-search/`** with the same shape
   (`name: "apple-location-search"`, `main: "src/index.ts"`, `peerDependencies: { "expo": "*" }`).

3. **Declare both as local dependencies in root `package.json`** under `dependencies` (keep alphabetical
   with existing entries):
   ```json
   "apple-location-search": "file:./modules/apple-location-search",
   "apple-weatherkit": "file:./modules/apple-weatherkit",
   ```
   (JS already imports these via relative paths `../../modules/...`, so no import changes are needed;
   the dependency exists purely so Expo autolinking resolves and installs the native pods.)

4. **Install + link locally**: `npm install` (creates `node_modules/apple-weatherkit` and
   `node_modules/apple-location-search`), then `cd ios && pod install` (or `npx pod-install`).

5. **Rebuild the production iOS binary** via EAS so the pods are compiled into the app:
   `npm run eas:build:ios-prod` (== `eas build --platform ios --profile production`). EAS runs
   `pod install` itself, so the new pods are included automatically.

## Validation

- After step 4 (local), confirm `ios/Pods/AppleWeatherKit` and `ios/Pods/AppleLocationSearch` now exist
  and the `.xcodeproj` references them.
- After step 5, install the new TestFlight build and pull-to-refresh on a real device: the forecast
  should load (no "WeatherKit not available" throw, no Sentry `loadForecast` error from that path).
- Verify MapKit location search now works (the second module).
- Optional local sanity check before a full EAS build: `npx expo prebuild --platform ios` then
  `xcodebuild`/run on device confirms the module links without a production upload.

## Risks / open questions

- **`WeatherKit` framework linking**: the podspec (`modules/apple-weatherkit/ios/AppleWeatherKit.podspec`)
  does not declare `s.frameworks = 'WeatherKit'`. `import WeatherKit` usually links automatically as a
  system framework, but if the native build fails to link, add `s.frameworks = 'WeatherKit'` to the podspec.
- **EAS tarball**: `file:` deps are copied into `node_modules` and included in the EAS upload — verify the
  build log shows the modules resolved (no "module not found"). If EAS skips them, switch to `link:` or a
  workspace.
- **Docs drift**: AGENTS.md currently states these modules "return null/throw until a native rebuild links
  the module." Once linked, update that paragraph to reflect they're now wired in.
- Follow-up (out of scope here): with the module now throwing instead of returning `null`, consider whether
  iOS should gracefully fall back to Open-Meteo on WeatherKit failure — currently there is NO fallback.

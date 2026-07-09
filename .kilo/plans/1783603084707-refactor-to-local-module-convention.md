# Refactor: adopt canonical Expo local-module convention for `apple-weatherkit` / `apple-location-search`

## Context

The native modules are now **linked and building** (verified locally: both pods `AppleWeatherKit`
and `AppleLocationSearch` appear in `Podfile.lock` / `Pods/Pods.xcodeproj`, and `xcodebuild`
compiles + links them against `WeatherKit` / `CoreLocation` / `MapKit`). The original defect — the
module being `null` at runtime because it was never compiled into the TestFlight binary — is fixed.

That fix was applied via the **standalone-module pattern**: I added a `package.json` to each module
and a root `file:` dependency, then ran `npm install` + `pod install`. Per Expo's official docs
(`create-expo-module --local`, `expo/fyi` "local autolinking"), a module living in `./modules` is
**auto-discovered by Expo Autolinking without a `package.json` and without a root dependency entry**
— local modules "rely on the host app," and JS must import them relatively (which this repo already
does: `weatherService.ios.ts:12`, `locationSearch.ios.ts:4`). The `file:`-dependency approach works
but is the pattern for sharing a module across apps, not for a single-app local module.

User decision: **use best practices** → switch to the canonical local-module convention. This is a
cleanup of the *mechanism*, not a change to the working linkage. Keep the `s.frameworks` podspec
additions (those are correct regardless of convention).

## Preconditions / ordering

- **Wait for the in-flight EAS production build (the `file:`-dependency version) to finish before
  mutating anything.** Do not change state while that build runs. This refactor produces a *new*
  build to validate.
- No `expo.autolinking` override exists in root `package.json`, so `nativeModulesDir` defaults to
  `./modules` → local autodiscovery applies (confirmed).

## Tasks (ordered)

1. **Remove `modules/apple-weatherkit/package.json`** and **`modules/apple-location-search/package.json`**.
   (The `expo-module.config.json` stays — it is what autolinking needs, not a `package.json`.)

2. **Remove the two `file:` dependency entries** from root `package.json` `dependencies`
   (keep alphabetical order):
   ```json
   "apple-location-search": "file:./modules/apple-location-search",
   "apple-weatherkit": "file:./modules/apple-weatherkit",
   ```

3. **`npm install`** to regenerate `package-lock.json` and drop the `node_modules` symlinks for the
   two modules.

4. **Empirical confidence check (mandatory before concluding):** verify autolinking still discovers
   both modules from `./modules` *without* a `package.json` or `node_modules` entry:
   ```bash
   node --no-warnings --eval "require('expo/bin/autolinking')" expo-modules-autolinking search --platform ios
   ```
   Expect both `apple-weatherkit` and `apple-location-search` present, with `path` under
   `modules/...`, and `"duplicates": []`. If either is missing here, STOP — the convention won't link
   and you must revert to the `file:` approach (see Risks).

5. **Re-link pods:** clear the stale cache that bit us before and reinstall:
   ```bash
   cd ios && rm -rf Pods Podfile.lock && npx pod-install --no-repo-update
   ```
   Confirm `Podfile.lock` references `AppleWeatherKit` / `AppleLocationSearch` from
   `../modules/.../ios` (not from `node_modules`).

6. **Build both pod targets** to re-confirm native linking (WeatherKit/CoreLocation + MapKit):
   ```bash
   xcodebuild build -workspace WheelyWeather.xcworkspace -scheme AppleWeatherKit  -sdk iphoneos -arch arm64 -configuration Debug ONLY_ACTIVE_ARCH=YES
   xcodebuild build -workspace WheelyWeather.xcworkspace -scheme AppleLocationSearch -sdk iphoneos -arch arm64 -configuration Debug ONLY_ACTIVE_ARCH=YES
   ```
   Expect `** BUILD SUCCEEDED **` for both.

7. **Update `AGENTS.md` line 36**: change the wording from "wired in via local `file:` deps in root
   `package.json`" to the canonical description — auto-discovered from `./modules` by Expo
   Autolinking (local-module convention), linked into the iOS pod via `pod install`. Keep the rest
   (no fallback, `fetchOpenMeteoData` throw, relative-path imports) unchanged.

8. **Rebuild for production:** `npm run eas:build:ios-prod`. This is the real test of the canonical
   setup on EAS.

## Validation

- Step 4 search output shows both modules with `duplicates: []`.
- Step 5 `Podfile.lock` lists both pods sourced from `../modules/.../ios`.
- Step 6 both pod targets build + link (`BUILD SUCCEEDED`).
- Step 8 EAS build log shows no "module not found" / "apple-weatherkit not found" errors and
  `pod install` succeeds with both pods present.
- After the new TestFlight build: pull-to-refresh on a real device loads the forecast (no
  "WeatherKit not available" throw, no stale banner), and MapKit location search works.

## Risks / rollback

- **Regression risk (main):** if the *original* TestFlight bug was actually caused by `./modules`
  *not* being discovered (rather than `pod install` never being re-run), removing the `file:` dep
  could reintroduce the `null`-module failure on the next EAS build. The Step 4 local search check
  reduces but does not fully eliminate this risk (EAS does a fresh `expo prebuild` + `pod install`,
  which uses the same autolinking search). **Rollback if Step 8 shows the module missing:** restore
  the two `package.json` files and the root `file:` deps (the previous working state) and rebuild.
- **Stale Pods cache:** the earlier `ExpoModulesWorklets`/`ExpoModulesCore` "differs from the version
  stored in Pods/Local Podspecs" failure is a local-env podspec-cache issue, not related to these
  modules. Remedy is the `rm -rf Pods Podfile.lock && pod-install` in Step 5.
- **Do not touch `s.frameworks`** in the two podspecs — they stay (`WeatherKit`,`CoreLocation` and
  `MapKit`); the project does not use `use_frameworks!` unconditionally, so explicit linkage is needed.
- Keep the relative-path imports in `weatherService.ios.ts` / `locationSearch.ios.ts` as-is.

const { withAppDelegate } = require('@expo/config-plugins');

// This project's Info.plist declares a scene-based `UIApplicationSceneManifest` (added via
// `expo.ios.infoPlist` in app.json, required so the app doesn't assert-crash at launch on
// iOS 27+), pointing at a `SceneDelegate` class. But `expo prebuild`'s generated
// `AppDelegate.swift` template doesn't itself emit a `SceneDelegate` — it only emits the
// legacy, non-scene window setup inside `AppDelegate.application(_:didFinishLaunchingWithOptions:)`.
// Left alone, that's a mismatch: the Info.plist points at a class that doesn't exist.
//
// This plugin adds the missing `SceneDelegate`, subclassing Expo's own `ExpoAppSceneDelegate`
// (from the `expo` package) rather than hand-rolling one. That matters because a hand-rolled
// scene delegate that forwards URLs straight to `RCTLinkingManager` bypasses the
// `ExpoAppDelegate` subscriber dispatch that expo-dev-launcher relies on to intercept its own
// deep links before JS has loaded — which leaves dev-launcher deep links (e.g. the one
// `expo run:ios` opens automatically) silently inert, falling back to Bonjour discovery that
// can hang indefinitely in the simulator. `ExpoAppSceneDelegate` forwards every scene event
// through the same subscriber pipeline `AppDelegate`'s own overrides use, with built-in
// de-duplication so `RCTLinkingManager` still only fires once.
//
// It also removes the legacy `#if os(iOS) || os(tvOS) window = UIWindow(...); factory
// .startReactNative(...) #endif` block from `didFinishLaunchingWithOptions`: under the scene
// life cycle that block is dead weight at best, and at worst races the window/startReactNative
// call `SceneDelegate` also makes.
//
// This patches the generated `ios/<name>/AppDelegate.swift` on every prebuild, since that file
// isn't committed (see .gitignore's `/ios`).

const SCENE_DELEGATE_MARKER = 'ExpoAppSceneDelegate';

const LEGACY_WINDOW_BLOCK_RE =
  /\n *#if os\(iOS\) \|\| os\(tvOS\)\n *window = UIWindow\(frame: UIScreen\.main\.bounds\)\n *factory\.startReactNative\(\n *withModuleName: "main",\n *in: window,\n *launchOptions: launchOptions\)\n *#endif\n/;

const SCENE_BASED_CLASS_RE = /class SceneDelegate: UIResponder, UIWindowSceneDelegate \{[\s\S]*?\n\}(?=\n)/;

const APP_DELEGATE_CLASS_OPEN_RE = /class AppDelegate: ExpoAppDelegate(, ExpoReactNativeFactoryProvider)? \{\n(?: *var window: UIWindow\?\n)?/;

const SCENE_DELEGATE_CLASS =
  '// Re-feeds scene life-cycle and URL events to `AppDelegate`, so both its subscribers (e.g.\n' +
  "// expo-dev-launcher's deep link handling) and its overrides (e.g. RCTLinkingManager above) run.\n" +
  '// Required for iOS 27, which asserts at launch unless the app adopts the scene-based life cycle\n' +
  '// (see `UIApplicationSceneManifest` in Info.plist).\n' +
  'class SceneDelegate: ExpoAppSceneDelegate {}\n';

function patchAppDelegateSwift(contents) {
  let patched = contents;
  let changed = false;

  // Ensure `AppDelegate` conforms to `ExpoReactNativeFactoryProvider` (required by
  // `ExpoAppSceneDelegate` to reach the React Native factory) and declares `window`, exactly
  // once, whichever of the two starting shapes we're patching.
  if (!APP_DELEGATE_CLASS_OPEN_RE.test(patched)) {
    console.warn(
      '[withDevLauncherSceneDelegateFix] Could not find the expected `AppDelegate` class opening ' +
        "to patch. Expo's generated template may have changed — skipping this part of the fix, " +
        'check ios/WheelyWeather/AppDelegate.swift by hand.'
    );
  } else {
    const before = patched;
    patched = patched.replace(
      APP_DELEGATE_CLASS_OPEN_RE,
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {\n  var window: UIWindow?\n'
    );
    changed = changed || patched !== before;
  }

  // Drop the legacy non-scene window setup, if present (the stock template emits it
  // unconditionally, regardless of whether a scene manifest is configured).
  if (LEGACY_WINDOW_BLOCK_RE.test(patched)) {
    patched = patched.replace(LEGACY_WINDOW_BLOCK_RE, '\n');
    changed = true;
  }

  // Add or fix up `SceneDelegate`.
  if (!patched.includes(SCENE_DELEGATE_MARKER)) {
    if (SCENE_BASED_CLASS_RE.test(patched)) {
      // A hand-rolled (or previously template-generated) scene delegate exists — replace it.
      patched = patched.replace(SCENE_BASED_CLASS_RE, SCENE_DELEGATE_CLASS.trimEnd());
      changed = true;
    } else if (patched.includes('class ReactNativeDelegate: ExpoReactNativeFactoryDelegate')) {
      // No scene delegate at all (the common case) — insert one before `ReactNativeDelegate`.
      patched = patched.replace(
        /class ReactNativeDelegate: ExpoReactNativeFactoryDelegate/,
        `${SCENE_DELEGATE_CLASS}\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate`
      );
      changed = true;
    } else {
      console.warn(
        '[withDevLauncherSceneDelegateFix] Could not find where to insert `SceneDelegate` ' +
          "(no `ReactNativeDelegate` class found either). Expo's generated template may have " +
          'changed — skipping this part of the fix, check ios/WheelyWeather/AppDelegate.swift by hand.'
      );
    }
  }

  return { contents: patched, changed };
}

const withDevLauncherSceneDelegateFix = (config) => {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      console.warn(
        '[withDevLauncherSceneDelegateFix] Expected a Swift AppDelegate but found ' +
          `"${config.modResults.language}" — skipping.`
      );
      return config;
    }

    const { contents, changed } = patchAppDelegateSwift(config.modResults.contents);
    if (changed) {
      config.modResults.contents = contents;
    }
    return config;
  });
};

module.exports = withDevLauncherSceneDelegateFix;
module.exports.patchAppDelegateSwift = patchAppDelegateSwift;

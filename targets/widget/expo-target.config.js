// Home screen widget: today's ride verdict, written by the app into the shared
// App Group (src/services/widgetStorage.ios.ts). The widget's own colors live in
// WidgetTheme.swift and WidgetScene.swift, mirroring src/constants/theme.ts; the
// colorsets here are the system's accent and widget-background names. Oswald
// ships in fonts/ (registered in Info.plist), and the scene's film grain is the
// app's tile.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
function createWidgetTargetConfig(config) {
  return {
    type: 'widget',
    name: 'WheelyWidget',
    displayName: 'Wheely Weather',
    bundleIdentifier: '.widget',
    deploymentTarget: '18.0',
    colors: {
      $accent: '#F1BDF2',
      $widgetBackground: { light: '#FFFFFF', dark: '#141416' },
    },
    images: {
      sceneGrain: {
        '1x': '../../assets/images/scene-grain.png',
        '2x': '../../assets/images/scene-grain@2x.png',
      },
    },
    entitlements: {
      'com.apple.security.application-groups':
        config.ios.entitlements['com.apple.security.application-groups'],
    },
  };
}

module.exports = createWidgetTargetConfig;

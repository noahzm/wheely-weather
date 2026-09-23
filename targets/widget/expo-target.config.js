// Home screen widget: today's ride verdict, written by the app into the shared
// App Group (src/services/widgetStorage.ios.ts). Colors mirror the verdict card's
// `condition` tokens in src/constants/theme.ts (same in light and dark).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'WheelyWidget',
  displayName: 'Wheely Weather',
  bundleIdentifier: '.widget',
  deploymentTarget: '18.0',
  colors: {
    $accent: '#F1BDF2',
    $widgetBackground: { light: '#FFFFFF', dark: '#141416' },
    rideYes: '#2ECC71',
    rideMaybe: '#FFD20A',
    rideNo: '#FF5252',
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});

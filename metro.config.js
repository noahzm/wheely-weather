// Learn more https://docs.expo.io/guides/customizing-metro
// Sentry's wrapper adds debug IDs to each bundle so errors can be matched to the
// source maps uploaded at build time; plain Expo config would leave traces minified.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);

// The native fingerprint keys the local build cache (`buildCacheProvider` in
// app.json). It doesn't see `targets/` (the widget's Swift, assets and config,
// wired in by @bacons/apple-targets), so a widget-only change reinstalled a
// stale cached build. Hash the folder so widget edits force a rebuild, and skip
// `package.json` scripts (none are postinstall hooks) so script edits don't
// invalidate the cached native binary.
/** @type {import('expo/fingerprint').Config} */
const config = {
  extraSources: [
    { type: 'dir', filePath: 'targets', reasons: ['Apple targets (home screen widget)'] },
  ],
  sourceSkips: ['PackageJsonScriptsAll'],
};

module.exports = config;

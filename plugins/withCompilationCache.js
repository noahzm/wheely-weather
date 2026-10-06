const { withPodfile, withXcodeProject } = require('@expo/config-plugins');

// Turns on Xcode's compilation cache (`COMPILATION_CACHE_ENABLE_CACHING`, Xcode 26+) for the
// app and every pod. It caches each compiled file by its inputs, so results survive what
// Xcode's incremental build doesn't: `pod install` regenerating the Pods project (which
// `expo run:ios` triggers after any native change) and clean builds. ccache was tried for
// the same goal and removed, because Xcode 27 invokes clang directly and ignores its wrapper.
//
// Pods get it from a `post_install` step appended to the generated Podfile, since `ios/`
// isn't committed (see .gitignore's `/ios`).

const PODFILE_MARKER = '# withCompilationCache';

const REACT_NATIVE_POST_INSTALL_RE = /( *)react_native_post_install\([\s\S]*?\n *\)\n/;

function patchPodfile(contents) {
  if (contents.includes(PODFILE_MARKER)) return contents;
  const match = REACT_NATIVE_POST_INSTALL_RE.exec(contents);
  if (!match) {
    console.warn(
      '[withCompilationCache] Could not find `react_native_post_install` in the Podfile. ' +
        "Expo's template may have changed — pods will build without the compilation cache.",
    );
    return contents;
  }
  const indent = match[1];
  const step = [
    `${indent}${PODFILE_MARKER}`,
    `${indent}installer.pods_project.targets.each do |target|`,
    `${indent}  target.build_configurations.each do |build_config|`,
    `${indent}    build_config.build_settings['COMPILATION_CACHE_ENABLE_CACHING'] = 'YES'`,
    `${indent}  end`,
    `${indent}end`,
    '',
  ].join('\n');
  return contents.replace(match[0], `${match[0]}${step}`);
}

const withCompilationCache = (config) => {
  config = withPodfile(config, (config) => {
    config.modResults.contents = patchPodfile(config.modResults.contents);
    return config;
  });
  return withXcodeProject(config, (config) => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const buildConfig of Object.values(configurations)) {
      if (typeof buildConfig === 'object' && buildConfig.buildSettings) {
        buildConfig.buildSettings.COMPILATION_CACHE_ENABLE_CACHING = 'YES';
      }
    }
    return config;
  });
};

module.exports = withCompilationCache;
module.exports.patchPodfile = patchPodfile;

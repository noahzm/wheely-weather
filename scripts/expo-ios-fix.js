const fs = require('node:fs');
const path = require('node:path');

// Fixes four recurring macOS / Xcode 27 iOS simulator & CocoaPods failure modes
// when loaded into the Expo CLI process (`node -r ./scripts/expo-ios-fix.js`):
//
// 1. UTF-8 locale: CocoaPods crashes with `Encoding::CompatibilityError` when
//    `LANG` / `LC_ALL` are unset in non-interactive shells.
// 2. Stale `ios/Podfile.lock`: when `package.json` bumps Expo packages, coupled
//    local podspecs (`ExpoModulesCore` + `ExpoModulesWorklets`) update together,
//    but `@expo/package-manager` only retries `pod update <single-pod>` against
//    the old `Podfile.lock` and fails. Removing `ios/Podfile.lock` right before
//    `pod install` lets CocoaPods resolve local podspecs cleanly without `ios:clean`.
// 3. `osascript` `System Events` (-1743) & Xcode 27 `DeviceHub.app`: `@expo/cli`
//    uses AppleScript `tell app "System Events" to count processes ...` to check
//    whether `Simulator` or `DeviceHub` is running, which fails with -1743 in
//    terminals/agents without macOS Automation permission. Use `lsappinfo list`
//    instead, and launch `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`
//    before `devices://device/open?id=<udid>` on Xcode 27+.
// 4. Cold simulator boot race (`NSPOSIXErrorDomain` code 60): `xcrun simctl boot`
//    returns before `BackBoard` / SpringBoard finish starting, causing the
//    immediate `simctl openurl` to time out. Wait on `simctl bootstatus -b` and
//    retry `simctl openurl` once on code 60 / 405.

if (!/utf-?8/i.test(process.env.LANG ?? '')) {
  process.env.LANG = 'en_US.UTF-8';
}
if (!/utf-?8/i.test(process.env.LC_ALL ?? '')) {
  process.env.LC_ALL = 'en_US.UTF-8';
}
process.env.EXPO_NO_TELEMETRY ||= '1';

const XCODE_SIMULATOR_APP = '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app';
const XCODE_DEVICE_HUB_APP = '/Applications/Xcode.app/Contents/Applications/DeviceHub.app';
const SIMULATOR_PROCESS_RE = /"(?:Simulator|Device Hub|DeviceHub)"/;

const spawnAsyncPath = require.resolve('@expo/spawn-async');
const origSpawnAsync = require(spawnAsyncPath);

function wrapPromiseWithChild(promise, child) {
  promise.child = child;
  return promise;
}

async function isSimulatorGuiRunning() {
  try {
    const result = await origSpawnAsync('lsappinfo', ['list']);
    return SIMULATOR_PROCESS_RE.test(result.stdout);
  } catch {
    return false;
  }
}

async function ensureDeviceHubOpen(udid) {
  if (!fs.existsSync(XCODE_DEVICE_HUB_APP)) {
    return;
  }
  if (!(await isSimulatorGuiRunning())) {
    await origSpawnAsync('open', [XCODE_DEVICE_HUB_APP]).catch(() => null);
  }
  if (udid && udid !== 'booted') {
    await origSpawnAsync('open', [`devices://device/open?id=${udid}`]).catch(() => null);
  }
}

function handleOsascript(args, options) {
  if (args?.some((arg) => arg.includes('count processes'))) {
    const checkPromise = isSimulatorGuiRunning().then((running) => {
      const stdout = running ? '1\n' : '0\n';
      return { pid: 0, stdout, stderr: '', status: 0, signal: null, output: [stdout, ''] };
    });
    return wrapPromiseWithChild(checkPromise, null);
  }
  if (args?.some((arg) => arg.includes('to activate'))) {
    const rawPromise = origSpawnAsync('osascript', args, options);
    const safePromise = rawPromise.catch(() => ({
      pid: 0,
      stdout: '',
      stderr: '',
      status: 0,
      signal: null,
      output: ['', ''],
    }));
    return wrapPromiseWithChild(safePromise, rawPromise.child);
  }
  return origSpawnAsync('osascript', args, options);
}

function handleOpenSimulator(args, options) {
  if (!fs.existsSync(XCODE_SIMULATOR_APP) && fs.existsSync(XCODE_DEVICE_HUB_APP)) {
    const udidIndex = args.indexOf('-CurrentDeviceUDID');
    const udid = udidIndex === -1 ? undefined : args[udidIndex + 1];
    const openPromise = ensureDeviceHubOpen(udid).then(() => ({
      pid: 0,
      stdout: '',
      stderr: '',
      status: 0,
      signal: null,
      output: ['', ''],
    }));
    return wrapPromiseWithChild(openPromise, null);
  }
  return origSpawnAsync('open', args, options);
}

function handleSimctlBoot(udid, options) {
  const bootPromise = ensureDeviceHubOpen(udid).then(() =>
    origSpawnAsync('xcrun', ['simctl', 'bootstatus', udid, '-b'], options),
  );
  return wrapPromiseWithChild(bootPromise, null);
}

function normalizeSimulatorUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.includes('expo-development-client')) {
    return rawUrl;
  }
  return rawUrl.replace(/url=http%3A%2F%2F[^%]+%3A/i, 'url=http%3A%2F%2F127.0.0.1%3A');
}

function handleSimctlOpenUrl(args, options) {
  const deviceId = args[2] ?? 'booted';
  const normalizedArgs = [...args];
  if (normalizedArgs[3]) {
    normalizedArgs[3] = normalizeSimulatorUrl(normalizedArgs[3]);
  }
  const openUrlPromise = ensureDeviceHubOpen(deviceId).then(async () => {
    await origSpawnAsync('xcrun', ['simctl', 'launch', deviceId, 'app.wheelyweather']).catch(
      () => null,
    );
    try {
      return await origSpawnAsync('xcrun', normalizedArgs, options);
    } catch (error) {
      const message = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
      if (message.includes('code=60') || message.includes('code=405') || message.includes('Shut')) {
        await origSpawnAsync('xcrun', ['simctl', 'bootstatus', deviceId, '-b']).catch(() => null);
        return origSpawnAsync('xcrun', normalizedArgs, options);
      }
      throw error;
    }
  });
  return wrapPromiseWithChild(openUrlPromise, null);
}

function patchedSpawnAsync(command, args = [], options = {}) {
  if (command === 'pod' && args[0] === 'install') {
    const cwd = options.cwd ?? path.join(process.cwd(), 'ios');
    const podfileLock = path.join(cwd, 'Podfile.lock');
    try {
      fs.rmSync(podfileLock, { force: true });
    } catch {
      // Ignore if Podfile.lock cannot be removed
    }
    return origSpawnAsync(command, args, options);
  }

  if (command === 'osascript') {
    return handleOsascript(args, options);
  }

  if (command === 'open' && args[0] === '-a' && args[1] === 'Simulator') {
    return handleOpenSimulator(args, options);
  }

  if (command === 'xcrun' && args[0] === 'simctl') {
    if (args[1] === 'boot' && args[2]) {
      return handleSimctlBoot(args[2], options);
    }
    if (args[1] === 'openurl') {
      return handleSimctlOpenUrl(args, options);
    }
  }

  return origSpawnAsync(command, args, options);
}

require.cache[spawnAsyncPath].exports = patchedSpawnAsync;

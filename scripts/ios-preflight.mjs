// Read-only checks: never boot/rebuild an app, start Metro, or launch Maestro's driver.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
export const EAS_FALLBACK =
  'EAS fallback: eas workflow:run .eas/workflows/e2e-ios.yml (uses one iOS build from the monthly quota).';

async function runCommand(command, args) {
  try {
    return await exec(command, args, {
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' },
    });
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')} failed or exceeded 8 seconds. ${error.message}`, {
      cause: error,
    });
  }
}

export async function findMaestro(env = process.env) {
  const candidates = [
    ...(env.PATH ?? '')
      .split(path.delimiter)
      .filter(Boolean)
      .map((directory) => path.join(directory, 'maestro')),
    path.join(os.homedir(), '.maestro/bin/maestro'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next PATH entry or the standard standalone install.
    }
  }
  throw new Error('Maestro is missing. Install its CLI and Java 17+; see CONTRIBUTING.md.');
}

async function selectSimulator(run, requestedDevice) {
  const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']);
  const booted = Object.values(JSON.parse(stdout).devices)
    .flat()
    .filter((device) => device.state === 'Booted');
  const matches = requestedDevice
    ? booted.filter((device) => device.udid === requestedDevice)
    : booted;
  if (matches.length === 0) {
    throw new Error(
      'No matching booted simulator. Start one with npm start -- --ios, then rerun preflight. IOS_SIMULATOR_UDID can select a device.',
    );
  }
  if (matches.length > 1) {
    throw new Error(
      'Multiple simulators are booted. Keep only one running, or set IOS_SIMULATOR_UDID to select it.',
    );
  }
  const device = matches[0];
  await run('xcrun', ['simctl', 'spawn', device.udid, 'launchctl', 'print', 'system']);
  return device;
}

async function checkApp(run, device, app, releaseBuild) {
  const { stdout } = await run('xcrun', [
    'simctl',
    'get_app_container',
    device.udid,
    app.ios.bundleIdentifier,
    'app',
  ]);
  if (!releaseBuild) {
    const plist = await run('plutil', [
      '-convert',
      'json',
      '-o',
      '-',
      path.join(stdout.trim(), 'Info.plist'),
    ]);
    const schemes =
      JSON.parse(plist.stdout).CFBundleURLTypes?.flatMap((type) => type.CFBundleURLSchemes ?? []) ??
      [];
    if (!schemes.includes(`exp+${app.slug}`)) {
      throw new Error(
        'The installed app is not the dev client. Install it with npm run ios; JS-only changes otherwise need no rebuild.',
      );
    }
  }
}

async function checkMetro(fetchImpl) {
  try {
    const response = await fetchImpl('http://127.0.0.1:8081/status', {
      signal: AbortSignal.timeout(2500),
    });
    const status = await response.text();
    if (!response.ok || status.trim() !== 'packager-status:running') {
      throw new Error('Port 8081 did not answer as Metro.');
    }
  } catch (error) {
    throw new Error(
      'Metro is unreachable at 127.0.0.1:8081. Start npm start in another terminal. Avoid --host localhost (IPv6-only).',
      { cause: error },
    );
  }
}

export async function checkIOSPrerequisites({
  platform = process.platform,
  env = process.env,
  run = runCommand,
  locateMaestro = findMaestro,
  fetchImpl = fetch,
  report = console.log,
  app,
} = {}) {
  if (platform !== 'darwin') throw new Error('Local iOS checks require macOS and Xcode.');
  const config = app ?? JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8')).expo;
  await run('xcode-select', ['-p']);
  report('OK: Xcode command-line tools');
  const java = await run('java', ['-version']);
  const major = Number(/version\s+"?(\d+)/.exec(`${java.stderr}\n${java.stdout}`)?.[1]);
  if (!Number.isFinite(major) || major < 17)
    throw new Error('Java 17+ is required by Maestro. Set JAVA_HOME to a supported JDK.');
  report(`OK: Java ${major}`);
  const maestro = await locateMaestro(env);
  await run(maestro, ['--version']);
  report(`OK: Maestro (${maestro})`);
  const device = await selectSimulator(run, env.IOS_SIMULATOR_UDID);
  report(`OK: responsive simulator ${device.name} (${device.udid})`);
  const releaseBuild = env.MAESTRO_RELEASE_BUILD === 'true';
  try {
    await checkApp(run, device, config, releaseBuild);
  } catch (error) {
    throw new Error(
      `App check failed: ${error.message} Use npm run ios to install the dev client if missing.`,
      { cause: error },
    );
  }
  report(`OK: installed ${releaseBuild ? 'release app' : 'development client'}`);
  if (!releaseBuild) {
    await checkMetro(fetchImpl);
    report('OK: Metro reachable over IPv4');
  }
  report('Preflight passed. This does not establish that Maestro’s iOS driver will start.');
  return { device, maestro };
}

export function reportPreflightFailure(error) {
  console.error(`iOS preflight: ${error.message}\n${EAS_FALLBACK}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await checkIOSPrerequisites().catch(reportPreflightFailure);
}

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { checkIOSPrerequisites, reportPreflightFailure } from './ios-preflight.mjs';

try {
  const { device, maestro } = await checkIOSPrerequisites();
  const args = process.argv.slice(2);
  const child = spawn(
    maestro,
    ['--device', device.udid, 'test', ...(args.length > 0 ? args : ['.maestro'])],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      stdio: 'inherit',
      env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' },
    },
  );
  child.on('error', reportPreflightFailure);
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  reportPreflightFailure(error);
}

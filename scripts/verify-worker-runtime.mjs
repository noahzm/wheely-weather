// Match Wrangler's exact runtime rather than installing a second Miniflare.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const requireWrangler = createRequire(import.meta.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare');
const run = promisify(execFile);

async function bundleWorker(directory) {
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'),
  );
  assert.equal(parsed.error, undefined, 'wrangler.jsonc must be valid JSONC');
  const config = parsed.config;
  config.main = path.resolve(root, config.main);
  // A local dry run must never invoke the deployment build hook recursively,
  // require dist/, load project secrets, or target a production route.
  delete config.build;
  delete config.assets;
  delete config.routes;
  const configPath = path.join(directory, 'wrangler.json');
  await writeFile(configPath, JSON.stringify(config));
  await writeFile(path.join(directory, 'empty.env'), '');
  await run(
    process.execPath,
    [
      path.join(path.dirname(requireWrangler.resolve('wrangler/package.json')), 'bin/wrangler.js'),
      'deploy',
      '--dry-run',
      '--config',
      configPath,
      '--env-file',
      path.join(directory, 'empty.env'),
      '--outdir',
      directory,
    ],
    {
      cwd: directory,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_LOG_PATH: path.join(directory, 'wrangler.log'),
      },
    },
  );
  const sqliteClasses = new Set(
    config.migrations?.flatMap((migration) => migration.new_sqlite_classes ?? []),
  );
  return {
    // Inline contents: path-only modules fail to load in Miniflare 5's adapter.
    script: await readFile(path.join(directory, 'index.js'), 'utf8'),
    modules: true,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    durableObjects: Object.fromEntries(
      config.durable_objects.bindings.map((binding) => [
        binding.name,
        { className: binding.class_name, useSQLite: sqliteClasses.has(binding.class_name) },
      ]),
    ),
  };
}

async function checkGeocoding(runtime, upstreamCalls) {
  const search = 'https://wheelyweather.app/api/geocode/search?q=Boston';
  const first = await runtime.dispatchFetch(search);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), []);
  assert.equal(upstreamCalls.length, 1);
  assert.equal(
    upstreamCalls[0].headers.get('User-Agent'),
    'WheelyWeather/1.0 (https://wheelyweather.app; contact@wheelyweather.app)',
  );

  const cached = await runtime.dispatchFetch(search);
  assert.equal(cached.status, 200);
  assert.deepEqual(await cached.json(), []);
  assert.equal(upstreamCalls.length, 1, 'cached searches must not consume the shared limit');

  const reverseUrl = 'https://wheelyweather.app/api/geocode/reverse?lat=42.360081&lon=-71.058884';
  const throttled = await runtime.dispatchFetch(reverseUrl);
  assert.equal(throttled.status, 429, 'search and reverse geocoding must share one global limit');
  assert.equal(throttled.headers.get('Retry-After'), '2');
  assert.equal(upstreamCalls.length, 1);
  // Exercise the actual protocol deadline, not a fake clock in the Node host:
  // the SQLite object runs in a separate workerd process.
  await delay(Number(throttled.headers.get('Retry-After')) * 1000);
  const reverse = await runtime.dispatchFetch(reverseUrl);
  assert.equal(reverse.status, 200);
  assert.deepEqual(await reverse.json(), { address: { city: 'Boston' } });
  assert.equal(upstreamCalls.length, 2);
  assert.equal(
    upstreamCalls[1].url,
    'https://nominatim.openstreetmap.org/reverse?lat=42.360&lon=-71.059&format=json',
  );

  const unconfigured = await runtime.dispatchFetch(
    'https://wheelyweather.app/api/forecast?lat=42.36&lon=-71.05',
  );
  assert.equal(unconfigured.status, 503, 'tests must not need WeatherKit secrets');
  assert.equal(upstreamCalls.length, 2);
}

async function main() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wheely-worker-'));
  let runtime;
  try {
    const worker = await bundleWorker(directory);
    const upstreamCalls = [];
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        ...worker,
        // No public API requests: unexpected destinations fail the check.
        outboundService(request) {
          assert.equal(new URL(request.url).origin, 'https://nominatim.openstreetmap.org');
          upstreamCalls.push(request);
          const body =
            new URL(request.url).pathname === '/search' ? [] : { address: { city: 'Boston' } };
          return Response.json(body);
        },
      }),
    );
    await checkGeocoding(runtime, upstreamCalls);
    console.log(
      'verify-worker-runtime: SQLite object, cache reuse, shared throttle, reverse rounding and missing secrets passed.',
    );
  } finally {
    try {
      await runtime?.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

await main().catch((error) => {
  console.error('verify-worker-runtime:', error);
  process.exitCode = 1;
});

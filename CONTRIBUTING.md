# Contributing to Wheely Weather

Thanks for contributing.

## Platforms

iOS comes first, the web app is the fallback, and Android is kept working but largely untested. Test changes on the iOS simulator first, then on web.

## Development setup

Requires Node 24+. iOS development needs Xcode: the app uses native WeatherKit and MapKit modules, so it runs in a development build, not Expo Go.

```bash
npm ci
cp .env.example .env   # optional: Sentry DSN
npm run web            # or: npm run ios / npm run android
```

- `npm run ios` builds, installs, and launches the iOS development build. `npm run ios:clean` regenerates the native project first; use it only after native changes or CocoaPods errors.
- Native builds are slow. JS/TS-only changes don't need one: keep the installed build and run `npm start -- --ios`. When nothing native has changed, `npm run ios` reinstalls a cached build instead of compiling.
- If Metro won't connect, restart the dev server with `npm start -- --tunnel`. Avoid `--host localhost`: Metro then listens only on IPv6, which the development build can't reach.

## Local iOS checks

Run `npm run preflight:ios` before Maestro. It checks Xcode, Java 17+, the
Maestro CLI (PATH or `~/.maestro/bin/maestro`), exactly one responsive booted
simulator, the installed development client's URL scheme, and Metro at
`127.0.0.1:8081/status`. Each subprocess has an eight-second deadline; Metro has
2.5 seconds. It never boots a simulator, builds an app, starts Metro, or launches
the Maestro driver. Passing preflight does not guarantee driver startup.

Start the existing development client with `npm start -- --ios`, then run
`npm run e2e:ios`. That command runs preflight automatically and passes the same
simulator UDID and discovered Maestro executable to the flows. For a particular
booted device, set `IOS_SIMULATOR_UDID`; for a single flow, use
`npm run e2e:ios -- .maestro/tabs.yaml`. `MAESTRO_RELEASE_BUILD=true` checks the
installed release app and skips dev-client/Metro requirements.

On Noah's 8 GB Mac, run one simulator and one heavy validation task at a time.
Do not run Maestro alongside web exports, coverage, browser tests, or native
builds. The known installed development client is on the iPhone 18 Pro / iOS 27.0
simulator; use the actual booted UDID rather than committing a machine-specific
identifier. Java 25 and Maestro were detected on this machine during setup.

If simulator launch or Maestro's driver times out once, stop the temporary
server/simulator and use the EAS path when native verification is needed:
`eas workflow:run .eas/workflows/e2e-ios.yml`. Run `npm run check` first. EAS uploads
the working tree, including uncommitted changes, and consumes one iOS build from
the monthly quota. Avoid repeated native rebuilds or longer driver timeouts for
JS-only changes. Background widget refresh must still be tested on a physical
device; simulators do not run iOS background tasks. Android remains untested.

## Worker runtime verification

`npm run verify:worker` bundles the current Worker with Wrangler and tests the
actual SQLite Durable Object and edge cache in a local workerd runtime. It
checks cache reuse, a global limit shared by search and reverse requests,
`Retry-After`, reverse-coordinate rounding, and operation without WeatherKit
secrets. All upstream calls are mocked, and unexpected destinations fail. The
command needs no `dist/`, Cloudflare login or API secrets and never deploys.
Temporary bundles, storage and runtime processes are cleaned up on completion.

The script deliberately resolves Miniflare through Wrangler so its version
matches the pinned toolchain. After Wrangler updates, run it to catch runtime or
adapter changes. It runs in `npm run check` and GitHub CI; Cloudflare's deployment
gate remains `npm run check:deploy`.

## Visual references

[Mobile web references](docs/visual-references/README.md) cover all five mock
scenarios in light and dark mode. Regenerate deliberately with
`npm run build:web` followed by `npm run references:web`; this is separate from
normal tests and does not silently overwrite reviewed images in CI. Use native
screenshots to assess native iOS behavior.

## Before you open a pull request

Run everything CI runs:

```bash
npm run check   # format, lint, types, coverage, web export verification, Expo Doctor, Worker runtime
npx playwright install chromium webkit   # once, or after a Playwright update
npm run test:web   # startup, navigation, settings persistence, accessible drawers
```

- Keep changes focused.
- Follow the conventions in [`AGENTS.md`](./AGENTS.md) (theme tokens, platform-specific service rules, testing).
- Add or update tests when behavior changes.
- Write commit messages with a conventional prefix and optional scope: `feat`, `fix`, `chore`, `docs`, `deps`, `ci` (for example `fix(forecast): …`).

Pushes to `main` deploy the web app automatically.

Cloudflare runs `npm run check:deploy` against the already exported `dist/` before
deployment. Browser smoke tests run in GitHub CI, where browser dependencies are
installed; Cloudflare's build environment does not install browsers.

Native compatibility uses the `fingerprint` runtime policy. Rebuild after native
dependency, plugin, Swift module or widget changes before publishing OTA updates.

## Security

Don't report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md) for private reporting.

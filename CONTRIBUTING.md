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
- Native builds are slow. JS/TS-only changes don't need one: keep the installed build and run `npx expo start`. When nothing native has changed, `npm run ios` reinstalls a cached build instead of compiling.
- If Metro won't connect, restart the dev server with `npx expo start --tunnel` (or `--host localhost`).

## Before you open a pull request

Run everything CI runs:

```bash
npm run check   # format, lint, typecheck, unit tests, web build
```

- Keep changes focused.
- Follow the conventions in [`AGENTS.md`](./AGENTS.md) (theme tokens, platform-specific service rules, testing).
- Add or update tests when behavior changes.
- Get maintainer approval before structural or logic changes to `src/domain/scoring.ts`.
- Write commit messages with a conventional prefix and optional scope: `feat`, `fix`, `chore`, `docs`, `deps`, `ci` (for example `fix(forecast): …`).

Pushes to `main` deploy the web app automatically.

## Security

Don't report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md) for private reporting.

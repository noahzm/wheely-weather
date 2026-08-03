# Contributing to Wheely Weather

Thanks for contributing.

## Development setup

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Start the app:
   ```bash
   npm run web
   ```
   Or use `npm run ios` / `npm run android` as needed.
   `npm run ios` builds/installs and launches the iOS development build using Expo defaults, and `npm run ios:clean` performs a clean native regeneration. If Metro connectivity is flaky, restart the dev server with `npx expo start --tunnel` (or `--host localhost`).

## Required quality gates

Run from the repository root in this order (matches CI):

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:web
```

## Pull request expectations

- Keep changes focused and scoped.
- Follow conventions in `.github/copilot-instructions.md` (theme tokens, platform-specific service rules, and testing expectations).
- Add or update tests when behavior changes.
- If changing files in `src/domain`, run `npm test`.
- If proposing structural or logic changes to `src/domain/scoring.ts`, get maintainer approval before merging.

## Security

Do not disclose vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md) for the private reporting process.

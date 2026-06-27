---
name: run-checks
description: Run the full local check suite that mirrors CI for Wheely Weather — format check, lint, typecheck, and unit tests, in the same order as .github/workflows/ci.yml. Use before pushing or opening a PR, or when asked to verify a change passes CI.
---

# run-checks

Run the same gates as CI (`.github/workflows/ci.yml`) locally, in order, and report a clear pass/fail summary. Stop-on-first-failure is NOT desired — run all four so the user sees every problem at once.

## Steps

Run each from the repo root (`/Users/noah/Projects/wheely-weather`):

1. **Format** — `npm run format:check`
2. **Lint** — `npm run lint` (ESLint, `--max-warnings 0`)
3. **Typecheck** — `npx tsc --noEmit`
4. **Unit tests** — `npm test` (`vitest run --project unit`)

Run them as independent Bash calls (they can go in parallel since none depends on another's output), then collect results.

## Notes

- This intentionally skips the `storybook` Vitest project and Playwright e2e, which need a browser (`npx playwright install`) and don't run in the CI `check` job. If the user explicitly wants e2e, run `npm run test:e2e` separately and note it needs Storybook running.
- If `format:check` fails, offer to run `npm run format` to auto-fix.
- If `lint` fails, note that many issues auto-fix via `npx eslint --fix` (the PostToolUse hook already does this per-file on edit).

## Output

Give a compact summary table: each gate with ✅/❌ and, for failures, the key error lines and the fix command. End with an overall "ready to push" / "not ready" verdict.

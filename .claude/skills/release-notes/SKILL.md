---
name: release-notes
description: Draft release notes for Wheely Weather from commits since the last tag (or a given range), grouped by conventional-commit type. Use when preparing a web deploy or app store release and asked to summarize what's changed.
---

# release-notes

Draft a release notes summary from git history, in this repo's existing commit style. Output a draft for review — do not write to a CHANGELOG file or tag a release unless the user explicitly asks.

## Steps

1. **Find the range.** `git tag --list --sort=-creatordate` for the most recent tag. If tags exist, use `<last-tag>..HEAD`. If none exist (true as of now — this repo has no tags), ask the user for a starting point (a date, commit SHA, or "since the last deploy") rather than guessing an arbitrary depth.
2. **Gather commits.** `git log <range> --oneline --no-merges`.
3. **Group by conventional-commit prefix** — this repo uses `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `style:`, `refactor:` (check `git log` for the actual prefixes in range; don't assume all of these appear). Map to reader-facing sections:
   - `feat:` → **New**
   - `fix:` → **Fixed**
   - everything else (`chore:`, `docs:`, `test:`, `style:`, `refactor:`) → collapse into a single **Other** section, or omit entirely if the audience is end users rather than contributors
4. **Rewrite for the audience.** Ask (or infer from context) whether this is for end users (App Store / Play Store "what's new", terse and benefit-focused, no internal jargon) or for maintainers (fuller technical changelog, can reference file paths). Don't just copy commit subjects verbatim — they're written for git log, not for readers.
5. **Present the draft as markdown** in the response. Only write it to a file (`CHANGELOG.md` or an EAS/App Store metadata file) or create a git tag if the user explicitly asks for that follow-up.

## Notes

- Commits with no meaningful user-facing content (pure `chore:`/`style:` housekeeping) usually don't belong in an end-user release note — use judgment, don't include every commit by default.
- For App Store/Play Store submissions, the `eas-app-stores` skill covers the actual metadata/submission flow — this skill only drafts the copy.

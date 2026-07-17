---
paths:
  - '**/*.ios.ts'
  - '**/*.ios.tsx'
  - '**/*.web.ts'
  - '**/*.web.tsx'
---

**Platform-specific service change (iOS/web/native differences):** inspect both the default and platform-specific files (`*.ios.ts*`, `*.web.ts*`) together; preserve the no-fallback rule for iOS weather/location native modules; for `weatherService.ios.ts` import shared parsing from `weatherParsing.ts` only; validate with `npx tsc --noEmit` plus targeted tests.

---
paths:
  - 'src/domain/**'
  - 'src/utils/**'
---

**Domain or utility logic change:** identify all call sites before editing; keep logic framework-agnostic in `src/domain`/`src/utils`; add/update colocated unit tests; run `npm test` afterward.

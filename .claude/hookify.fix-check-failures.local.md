---
name: fix-check-failures
enabled: true
event: bash
pattern: (format:check|prettier\s+--check|npm\s+run\s+lint|eslint\s|tsc\s+--noEmit|npm\s+test|vitest\s+run)
---

⚠️ **Before treating any failure from this check as acceptable to leave:**

If this command reports a failure (format, lint, typecheck, or test), fix it — even if the
affected file looks pre-existing, unrelated to the current task, or untouched by your recent
edits. Don't decide unilaterally to "leave it" or note it as out-of-scope; either fix it or ask
the user first.

(Based on a real correction: format:check failed on `.mcp.json`, a file unrelated to the task at
hand — the assistant said it would leave it, and was told to fix it instead.)

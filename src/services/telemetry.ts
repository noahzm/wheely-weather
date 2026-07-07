import * as Sentry from '@sentry/react-native';

// Set via EXPO_PUBLIC_SENTRY_DSN (see .env.example). Unset in local dev by
// default, so `initSentry` is a no-op until a DSN is configured — nothing
// here should ever throw or block app startup.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Call once from the root layout, before anything else renders. */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // The app handles precise location; never attach IP/device identifiers by default.
    sendDefaultPii: false,
  });
}

/**
 * Routes an otherwise-swallowed error to Sentry. Several persistence and
 * enrichment paths (AsyncStorage reads/writes, forecast cache, settings)
 * intentionally never reject — a flaky disk or network call should never
 * break the UI — but that means real bugs (storage corruption, a parsing
 * regression) were previously invisible. This keeps the existing fallback
 * behavior and just makes the failure visible in Sentry.
 *
 * Safe to call even when `initSentry` was skipped (no DSN) — `captureException`
 * no-ops without a configured client.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

import * as Sentry from '@sentry/react-native';

// Set via EXPO_PUBLIC_SENTRY_DSN (see .env.example). Dev builds never report,
// even with the DSN in .env: simulator App Hangs (the dev bundle is slow) and
// mid-edit errors made up most of the project's events and buried real ones.
const dsn: string | undefined =
  typeof process.env.EXPO_PUBLIC_SENTRY_DSN === 'string' &&
  process.env.EXPO_PUBLIC_SENTRY_DSN.length > 0
    ? process.env.EXPO_PUBLIC_SENTRY_DSN
    : undefined;

/**
 * Whether Sentry reports: a DSN is set and this isn't a dev build. The native
 * SDK (App Hangs, crashes) starts from `Sentry.init`, so this gates it too.
 * `Sentry.wrap` should only be applied when this is true — wrapping without a configured client leaves the
 * app-start profiler with nothing to report to, which logs a spurious
 * "Sentry.wrap was called before Sentry.init" warning on every launch.
 */
export const sentryEnabled = Boolean(dsn) && !__DEV__;

// Precise coordinates ride in request URLs (Open-Meteo latitude/longitude,
// Nominatim lat/lon, NWS /points/{lat},{lon}), and Sentry's default fetch/XHR
// breadcrumbs record full URLs — so an error captured near a weather fetch
// would carry the user's location to a third party even with sendDefaultPii
// off. Redact coordinates from breadcrumb URLs.
const COORD_QUERY = /([?&](?:lat|lon|latitude|longitude)=)[^&]*/gi;
const COORD_POINTS_PATH = /(\/points\/)[-0-9.,]+/gi;

/** Call once from the root layout, before anything else renders. */
export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    // The app handles precise location; never attach IP/device identifiers by default.
    // @sentry/core deprecates this for `dataCollection`, but the React Native SDK
    // leaves `dataCollection` out of its options and still gates IP inference,
    // route params and deep-link URLs on this flag, so it stays the switch here.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    sendDefaultPii: false,
    // Performance tracing (forecast load timing, see `traceAsync`). A fifth of
    // production sessions now that the app is public: enough timing data without
    // burning the Sentry quota.
    tracesSampleRate: 0.2,
    beforeBreadcrumb(breadcrumb) {
      const url: unknown = breadcrumb.data?.url;
      if (typeof url !== 'string') return breadcrumb;
      return {
        ...breadcrumb,
        data: {
          ...breadcrumb.data,
          url: url
            .replaceAll(COORD_QUERY, '$1<redacted>')
            .replaceAll(COORD_POINTS_PATH, '$1<redacted>'),
        },
      };
    },
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

/**
 * Times an async step as a Sentry span, nesting under any span already running
 * (so `forecast.load` shows its location check and WeatherKit calls). Needed for
 * native calls like WeatherKit, which automatic fetch tracing can't see. Runs
 * `fn` untouched when tracing is off.
 */
export function traceAsync<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name, op }, fn);
}

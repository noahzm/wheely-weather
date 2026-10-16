import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface InitOptions {
  dsn?: string;
  sendDefaultPii?: boolean;
  tracesSampleRate?: number;
  beforeBreadcrumb?: (breadcrumb: { data?: Record<string, unknown>; message?: string }) => unknown;
}

const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: InitOptions) => void>(),
  captureException: vi.fn(),
  startSpan: vi.fn((_opts: { name: string; op: string }, fn: () => unknown) => fn()),
}));

vi.mock('@sentry/react-native', () => sentry);

const ORIGINAL_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_DSN === undefined) {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  } else {
    process.env.EXPO_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
  }
});

describe('telemetry — disabled in dev or without a DSN', () => {
  it('stays disabled in __DEV__ even when a DSN is configured', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/123';
    vi.stubGlobal('__DEV__', true);

    const { initSentry, sentryEnabled } = await import('./telemetry');
    initSentry();

    expect(sentryEnabled).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('stays disabled when EXPO_PUBLIC_SENTRY_DSN is empty', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    vi.stubGlobal('__DEV__', false);

    const { initSentry, sentryEnabled } = await import('./telemetry');
    initSentry();

    expect(sentryEnabled).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });
});

describe('telemetry — production initialization and helpers', () => {
  it('initializes Sentry and redacts coordinates from fetch/XHR breadcrumb URLs', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/123';
    vi.stubGlobal('__DEV__', false);

    const { initSentry, sentryEnabled } = await import('./telemetry');
    expect(sentryEnabled).toBe(true);

    initSentry();
    expect(sentry.init).toHaveBeenCalledTimes(1);

    const options = sentry.init.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      dsn: 'https://example@sentry.io/123',
      sendDefaultPii: false,
      tracesSampleRate: 0.2,
    });

    const beforeBreadcrumb = options?.beforeBreadcrumb;
    expect(beforeBreadcrumb).toBeTypeOf('function');

    const redactedQuery = beforeBreadcrumb?.({
      data: {
        url: 'https://api.open-meteo.com/v1/forecast?latitude=35.78&longitude=-78.64&lat=35.78&lon=-78.64&hourly=temp',
        method: 'GET',
      },
    });
    expect(redactedQuery).toEqual({
      data: {
        url: 'https://api.open-meteo.com/v1/forecast?latitude=<redacted>&longitude=<redacted>&lat=<redacted>&lon=<redacted>&hourly=temp',
        method: 'GET',
      },
    });

    const redactedNwsPath = beforeBreadcrumb?.({
      data: {
        url: 'https://api.weather.gov/points/35.7796,-78.6382',
      },
    });
    expect(redactedNwsPath).toEqual({
      data: {
        url: 'https://api.weather.gov/points/<redacted>',
      },
    });

    const nonUrlBreadcrumb = { message: 'ui.click', data: { target: 'button' } };
    expect(beforeBreadcrumb?.(nonUrlBreadcrumb)).toBe(nonUrlBreadcrumb);
  });

  it('forwards captureError and traceAsync to Sentry', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/123';
    vi.stubGlobal('__DEV__', false);

    const { captureError, traceAsync } = await import('./telemetry');
    const err = new Error('disk full');

    captureError(err);
    expect(sentry.captureException).toHaveBeenCalledWith(err, undefined);

    captureError(err, { key: 'ww_location' });
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { key: 'ww_location' },
    });

    const result = await traceAsync('forecast.load', 'weather', () => Promise.resolve(42));
    expect(result).toBe(42);
    expect(sentry.startSpan).toHaveBeenCalledWith(
      { name: 'forecast.load', op: 'weather' },
      expect.any(Function),
    );
  });
});

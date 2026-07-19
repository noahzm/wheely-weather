import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout, REQUEST_TIMEOUT_ERROR, withTimeout } from './http';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the promise value when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('propagates the underlying rejection when it loses to the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('native failure')), 1000)).rejects.toThrow(
      'native failure',
    );
  });

  it('rejects with the timeout error when the promise never settles', async () => {
    const pending = withTimeout(new Promise<never>(vi.fn()), 1000);
    const assertion = expect(pending).rejects.toThrow(REQUEST_TIMEOUT_ERROR);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the response and forwards options when fetch wins the race', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithTimeout('https://example.test', { headers: { Accept: 'application/json' } }, 1000),
    ).resolves.toBe(response);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts and rejects with the timeout error when fetch never resolves', async () => {
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        seenSignal = init.signal ?? undefined;
        return new Promise<never>(vi.fn());
      }),
    );

    // Default timeout (2500 ms) path.
    const pending = fetchWithTimeout('https://example.test');
    const assertion = expect(pending).rejects.toThrow(REQUEST_TIMEOUT_ERROR);
    await vi.advanceTimersByTimeAsync(2500);
    await assertion;
    expect(seenSignal?.aborted).toBe(true);
  });

  it('does not surface an unhandled rejection when fetch fails after the timeout', async () => {
    let rejectFetch: (err: Error) => void = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<never>((_, reject) => {
            rejectFetch = reject;
          }),
      ),
    );

    const pending = fetchWithTimeout('https://example.test', {}, 100);
    const assertion = expect(pending).rejects.toThrow(REQUEST_TIMEOUT_ERROR);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    // The late AbortError-style rejection must be swallowed by the internal catch.
    rejectFetch(new Error('The operation was aborted'));
    await vi.runAllTimersAsync();
  });
});

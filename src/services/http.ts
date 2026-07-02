export const REQUEST_TIMEOUT_ERROR = 'Request timed out';

/** Wraps fetch with an abort timeout so slow secondary APIs fail predictably. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 2500,
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const fetchPromise = fetch(url, { ...options, signal: controller.signal });
    // Suppress the AbortError rejection that fires when the timeout wins the race.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    fetchPromise.catch(() => {});
    return await Promise.race([
      fetchPromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error(REQUEST_TIMEOUT_ERROR));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

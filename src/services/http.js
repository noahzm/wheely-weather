export const REQUEST_TIMEOUT_ERROR = "Request timed out";

/** Wraps fetch with an abort timeout so slow secondary APIs fail predictably. */
/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  let timeoutId;

  try {
    const fetchPromise = fetch(url, { ...options, signal: controller.signal });
    // Suppress the AbortError rejection that fires when the timeout wins the race.
    fetchPromise.catch(() => {});
    return await Promise.race([
      fetchPromise,
      new Promise((_, reject) => {
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

/**
 * Validates that an external URL uses a safe web protocol (http: or https:).
 * Rejects unsafe protocols such as javascript:, data:, file:, or malformed strings.
 */
export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

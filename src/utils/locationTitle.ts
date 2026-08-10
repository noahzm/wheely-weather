/** Header title helpers for the weather screen. */

/** First component of a "City, Region, Country" label. */
export function cityFromLocation(location: string | null | undefined): string {
  return location?.split(',')[0]?.trim() ?? '';
}

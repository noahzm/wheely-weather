/** Rounds a percentage value and clamps it between 0 and 100. */
export function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Formats a numeric value as a percentage string (e.g. 42 -> "42%"). */
export function formatPercent(value: number): string {
  return `${normalizePercent(value)}%`;
}

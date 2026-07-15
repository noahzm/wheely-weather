export function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatPercent(value: number): string {
  return `${normalizePercent(value)}%`;
}

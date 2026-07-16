/**
 * Derive a translucent rgba() string from a palette hex color, so tints and
 * scrims track the theme instead of hand-mixed rgba literals.
 * Accepts #rgb and #rrggbb.
 */
export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const expanded =
    raw.length === 3
      ? raw.charAt(0).repeat(2) + raw.charAt(1).repeat(2) + raw.charAt(2).repeat(2)
      : raw;
  if (expanded.length !== 6 || /[^0-9a-f]/i.test(expanded)) {
    throw new Error(`withAlpha: expected #rgb or #rrggbb hex color, got "${hex}"`);
  }
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

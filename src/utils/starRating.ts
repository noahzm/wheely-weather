/**
 * Pure helpers for the ride-score star rating. The domain score stays 0–10
 * (see src/domain/scoring.ts); this module only maps it onto a 0–5 display
 * scale in half-star steps so the UI stays a pure function of the score.
 */

/** How much of a single star is filled. */
export type StarFill = 'full' | 'half' | 'empty';

/** Number of stars shown in a rating row. */
export const STAR_COUNT = 5;

/**
 * Converts the 0–10 ride score to a 0–5 star rating. Because the domain
 * score is an integer, the result is always an exact half step
 * (e.g. 9 → 4.5). Out-of-range input is clamped defensively.
 */
export function scoreToStars(score: number): number {
  const clamped = Math.min(10, Math.max(0, score));
  return clamped / 2;
}

/**
 * Fill state of the star at `index` (0-based) for a 0–5 rating.
 * Any remainder >= 1 fills the star, >= 0.5 half-fills it.
 */
export function starFillAt(index: number, rating: number): StarFill {
  const remaining = rating - index;
  if (remaining >= 1) return 'full';
  if (remaining >= 0.5) return 'half';
  return 'empty';
}

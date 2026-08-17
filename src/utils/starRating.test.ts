import { describe, expect, it } from 'vitest';

import { scoreToStars, starFillAt, STAR_COUNT } from './starRating';

describe('scoreToStars', () => {
  it('maps the 0–10 score onto 0–5', () => {
    expect(scoreToStars(10)).toBe(5);
    expect(scoreToStars(8)).toBe(4);
    expect(scoreToStars(5)).toBe(2.5);
    expect(scoreToStars(1)).toBe(0.5);
    expect(scoreToStars(0)).toBe(0);
  });

  it('keeps odd scores on exact half steps', () => {
    expect(scoreToStars(9)).toBe(4.5);
    expect(scoreToStars(3)).toBe(1.5);
  });

  it('clamps out-of-range scores', () => {
    expect(scoreToStars(12)).toBe(5);
    expect(scoreToStars(-2)).toBe(0);
  });
});

describe('starFillAt', () => {
  it('fills whole stars first', () => {
    expect(starFillAt(0, 4)).toBe('full');
    expect(starFillAt(3, 4)).toBe('full');
    expect(starFillAt(4, 4)).toBe('empty');
  });

  it('half-fills the star the rating lands on', () => {
    expect(starFillAt(2, 2.5)).toBe('half');
    expect(starFillAt(0, 0.5)).toBe('half');
    expect(starFillAt(4, 4.5)).toBe('half');
  });

  it('leaves stars beyond the rating empty', () => {
    expect(starFillAt(3, 2.5)).toBe('empty');
    expect(starFillAt(0, 0)).toBe('empty');
  });

  it('fills every star for a perfect rating', () => {
    for (let i = 0; i < STAR_COUNT; i++) {
      expect(starFillAt(i, STAR_COUNT)).toBe('full');
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEST_DAYS_MESSAGES } from './copy';

// `pick()` is intentionally `arr[new Date().getHours() % arr.length]` — stable
// within an hour, NOT random (see AGENTS.md / the inline warning in copy.js).
// We exercise it through BEST_DAYS_MESSAGES.NONE(), which has 4 variants.
describe('copy pick() variant selection', () => {
  const atHour = (h: number) => vi.setSystemTime(new Date(2026, 5, 22, h, 30, 0));

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is deterministic within the same hour (not random)', () => {
    atHour(9);
    const first = BEST_DAYS_MESSAGES.NONE();
    for (let i = 0; i < 10; i++) {
      expect(BEST_DAYS_MESSAGES.NONE()).toBe(first);
    }
  });

  it('cycles with a period equal to the number of variants (4)', () => {
    const results = Array.from({ length: 8 }, (_, h) => {
      atHour(h);
      return BEST_DAYS_MESSAGES.NONE();
    });

    // Period of 4: hour h and hour h+4 select the same variant.
    for (let h = 0; h < 4; h++) {
      expect(results[h]).toBe(results[h + 4]);
    }
    // And the first four hours cover four distinct variants.
    expect(new Set(results.slice(0, 4)).size).toBe(4);
  });
});

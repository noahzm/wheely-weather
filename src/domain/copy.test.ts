import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERT_MESSAGES,
  BEST_DAYS_MESSAGES,
  GEAR_TIPS,
  STATUS_MESSAGES,
  getVerdictLabel,
} from './copy';

// `pick()` is intentionally `arr[new Date().getHours() % arr.length]` — stable
// within an hour, NOT random (see the inline warning in copy.js).
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

describe('verdict labels', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a stable label for the same status and location seed', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    expect(getVerdictLabel('yes', 'Philadelphia')).toBe(getVerdictLabel('yes', 'Philadelphia'));
  });

  it('returns a non-empty label for every status', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    expect(getVerdictLabel('yes', 'A')).not.toBe('');
    expect(getVerdictLabel('maybe', 'A')).not.toBe('');
    expect(getVerdictLabel('no', 'A')).not.toBe('');
  });

  it('does not reuse the hero opener phrase as a no-status badge label', () => {
    const locations = ['Philadelphia', 'A', 'B', 'Berlin', 'Sydney'];
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        vi.setSystemTime(new Date(2026, 6, day, hour, 0, 0));
        for (const location of locations) {
          expect(getVerdictLabel('no', location)).not.toBe('Sit this one out');
        }
      }
    }
  });
});

describe('status messaging helpers', () => {
  it('formats issue lists and extra issue tails', () => {
    expect(STATUS_MESSAGES.MAYBE_ISSUES(['wind'])).toContain('wind');
    expect(STATUS_MESSAGES.MAYBE_ISSUES(['wind', 'rain'])).toContain('wind and rain');

    const message = STATUS_MESSAGES.NO_ISSUES(['wind', 'rain', 'heat'], 2);
    expect(message).toContain('wind, rain, and heat');
    expect(message).toContain('plus 2 more');
  });

  it('formats rain and alert copy with dynamic values', () => {
    expect(STATUS_MESSAGES.LATER_GOOD('6 PM')).toContain('6 PM');
    expect(STATUS_MESSAGES.CLEAR_UP('7 PM')).toContain('7 PM');
    expect(ALERT_MESSAGES.HEAT_EXTREME('109°F')).toContain('109°F');
    expect(ALERT_MESSAGES.HEAT_WARNING('98°F')).toContain('98°F');
  });
});

describe('gear tip variants', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('formats pro swing and wind pickup qualifiers', () => {
    const tempSwing = GEAR_TIPS.PRO.TEMP_SWING('55°F', '72°F');
    const windPickup = GEAR_TIPS.PRO.WIND_PICKUP(24);

    expect(tempSwing.items[0]?.qualifier).toBe('55°F to 72°F across the window');
    expect(windPickup.items[0]?.qualifier).toBe('Wind builds to 24 mph');
  });

  it('alternates UV extreme qualifier by hour and includes support item', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 8, 0, 0));
    const early = GEAR_TIPS.CASUAL.UV_EXTREME();
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    const later = GEAR_TIPS.CASUAL.UV_EXTREME();

    expect(['Very high UV', 'Extreme UV']).toContain(early.items[0]?.qualifier);
    expect(['Very high UV', 'Extreme UV']).toContain(later.items[0]?.qualifier);
    expect(early.items[0]?.qualifier).not.toBe(later.items[0]?.qualifier);
    expect(early.items[1]).toEqual({ icon: 'Glasses', label: 'Sunglasses' });
  });
});

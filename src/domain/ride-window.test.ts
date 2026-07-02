import { describe, expect, it } from 'vitest';
import { getBestRideWindow } from './weather';

describe('Best Ride Window', () => {
  it("returns 'Best now' when the current hour is good", () => {
    const hourly = [{ hour: 10, condition: 'good' }];
    expect(getBestRideWindow(hourly)).toBe('Best now');
  });

  it("returns 'Improves around X' when a later fair-or-better window exists", () => {
    const hourly = [
      { hour: 10, condition: 'bad' },
      { hour: 11, condition: 'bad' },
      { hour: 12, condition: 'fair' },
    ];
    expect(getBestRideWindow(hourly)).toBe('Improves around 12pm');
  });

  it("returns 'No clear window' when conditions never improve", () => {
    const hourly = [
      { hour: 10, condition: 'bad' },
      { hour: 11, condition: 'poor' },
      { hour: 12, condition: 'bad' },
    ];
    expect(getBestRideWindow(hourly)).toBe('No clear window in the next 24 hours');
  });

  it('handles empty hourly', () => {
    expect(getBestRideWindow([])).toBeNull();
  });

  it('prefers good over fair when current is fair', () => {
    const hourly = [
      { hour: 10, condition: 'fair' },
      { hour: 11, condition: 'fair' },
      { hour: 12, condition: 'good' },
    ];
    expect(getBestRideWindow(hourly)).toBe('Improves around 12pm');
  });
});

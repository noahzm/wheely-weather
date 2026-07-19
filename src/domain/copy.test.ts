import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALERT_MESSAGES, ISSUE_PHRASES, STATUS_MESSAGES, getVerdictLabel } from './copy';

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

  it('never hedges a no-status badge label', () => {
    const locations = ['Philadelphia', 'A', 'B', 'Berlin', 'Sydney'];
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        vi.setSystemTime(new Date(2026, 6, day, hour, 0, 0));
        for (const location of locations) {
          expect(getVerdictLabel('no', location)).not.toBe('Probably shouldn’t');
        }
      }
    }
  });
});

describe('status messaging helpers', () => {
  it('formats rain and alert copy with dynamic values', () => {
    expect(STATUS_MESSAGES.LATER_GOOD('6 PM')).toContain('6 PM');
    expect(STATUS_MESSAGES.CLEAR_UP('7 PM')).toContain('7 PM');
    expect(ALERT_MESSAGES.HEAT_EXTREME('109°F')).toContain('109°F');
    expect(ALERT_MESSAGES.HEAT_WARNING('98°F')).toContain('98°F');
  });
});

describe('shared issue phrases', () => {
  it('varies phrasing by severity tier', () => {
    expect(ISSUE_PHRASES.WIND(24, 'bad')).toBe('Very windy (24 mph)');
    expect(ISSUE_PHRASES.WIND(16, 'marginal')).toBe('Breezy (16 mph)');
    expect(ISSUE_PHRASES.RAIN('65%', 'bad')).toBe('Rain likely (65%)');
    expect(ISSUE_PHRASES.HEAT('97°F', 'bad')).toBe('Dangerous heat (97°F)');
    expect(ISSUE_PHRASES.COLD('30°F', 'bad')).toBe('Freezing (30°F)');
    expect(ISSUE_PHRASES.HUMIDITY('76°F', 'bad')).toBe('Oppressive humidity (dew 76°F)');
    expect(ISSUE_PHRASES.HUMIDITY('62°F', 'marginal')).toBe('Muggy (dew 62°F)');
    expect(ISSUE_PHRASES.AQI(160, 'poor')).toBe('Poor air (AQI 160)');
    expect(ISSUE_PHRASES.AQI(80, 'marginal')).toBe('Hazy (AQI 80)');
  });
});

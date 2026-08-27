import { describe, it, expect } from 'vitest';
import { formatUpdatedAgo, fullHourLabel } from './timeFormat';

describe('fullHourLabel', () => {
  it('formats midnight as 12 AM', () => {
    expect(fullHourLabel(0)).toBe('12 AM');
    expect(fullHourLabel(24)).toBe('12 AM');
  });
  it('formats noon as 12 PM', () => {
    expect(fullHourLabel(12)).toBe('12 PM');
  });
  it('formats AM hours with space', () => {
    expect(fullHourLabel(7)).toBe('7 AM');
  });
  it('formats PM hours with space', () => {
    expect(fullHourLabel(15)).toBe('3 PM');
    expect(fullHourLabel(23)).toBe('11 PM');
  });
});

describe('formatUpdatedAgo', () => {
  const NOW = new Date('2024-06-01T15:04:30');
  const ago = (ms: number) => new Date(NOW.getTime() - ms);

  it('reads "just now" under a minute, including slight clock skew', () => {
    expect(formatUpdatedAgo(ago(20_000), NOW)).toBe('Updated just now');
    // A future lastUpdated (device clock ahead) clamps instead of going negative.
    expect(formatUpdatedAgo(ago(-30_000), NOW)).toBe('Updated just now');
  });

  it('uses singular for exactly one minute', () => {
    expect(formatUpdatedAgo(ago(60_000), NOW)).toBe('Updated 1 min ago');
  });

  it('reads minutes up to the hour boundary', () => {
    expect(formatUpdatedAgo(ago(25 * 60_000), NOW)).toBe('Updated 25 min ago');
    expect(formatUpdatedAgo(ago(59 * 60_000), NOW)).toBe('Updated 59 min ago');
  });

  it('falls back to the absolute fetch time past an hour', () => {
    expect(formatUpdatedAgo(ago(61 * 60_000), NOW)).toBe('Updated 2:03 PM');
    expect(formatUpdatedAgo(ago(12 * 3_600_000), NOW)).toBe('Updated 3:04 AM');
    const noon = new Date('2024-06-01T12:15:00');
    const midnight = new Date('2024-06-01T00:15:00');
    expect(formatUpdatedAgo(noon, NOW)).toBe('Updated 12:15 PM');
    expect(formatUpdatedAgo(midnight, NOW)).toBe('Updated 12:15 AM');
  });
});

import { describe, it, expect } from 'vitest';
import { fullHourLabel } from './timeFormat';

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

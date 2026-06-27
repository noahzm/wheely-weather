import { describe, it, expect } from 'vitest';
import { hourLabel, fullHourLabel } from './timeFormat';

describe('hourLabel', () => {
  it('formats midnight as 12AM', () => {
    expect(hourLabel(0)).toBe('12AM');
    expect(hourLabel(24)).toBe('12AM');
  });
  it('formats noon as 12PM', () => {
    expect(hourLabel(12)).toBe('12PM');
  });
  it('formats AM hours', () => {
    expect(hourLabel(1)).toBe('1AM');
    expect(hourLabel(11)).toBe('11AM');
  });
  it('formats PM hours', () => {
    expect(hourLabel(13)).toBe('1PM');
    expect(hourLabel(23)).toBe('11PM');
  });
});

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
  });
});

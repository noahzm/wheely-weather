import { describe, expect, it } from 'vitest';

import { abbreviateTrailingUSState, abbreviateUSState } from './us-states';

describe('abbreviateUSState', () => {
  it('abbreviates a full state name', () => {
    expect(abbreviateUSState('California')).toBe('CA');
  });

  it('abbreviates a multi-word state name', () => {
    expect(abbreviateUSState('North Carolina')).toBe('NC');
  });

  it('covers District of Columbia', () => {
    expect(abbreviateUSState('District of Columbia')).toBe('DC');
  });

  it('passes through a non-US region unchanged', () => {
    expect(abbreviateUSState('Bavaria')).toBe('Bavaria');
  });

  it('passes an existing abbreviation through unchanged', () => {
    expect(abbreviateUSState('IA')).toBe('IA');
  });
});

describe('abbreviateTrailingUSState', () => {
  it('rewrites a trailing full state name', () => {
    expect(abbreviateTrailingUSState('San Francisco, California')).toBe('San Francisco, CA');
  });

  it('leaves an already-abbreviated label alone', () => {
    expect(abbreviateTrailingUSState('Iowa City, IA')).toBe('Iowa City, IA');
  });

  it('leaves a country-suffixed label alone', () => {
    expect(abbreviateTrailingUSState('Berlin, Germany')).toBe('Berlin, Germany');
  });

  it('leaves a label without a region segment alone', () => {
    expect(abbreviateTrailingUSState('Tokyo')).toBe('Tokyo');
  });

  it('rewrites only the trailing segment, not an earlier match', () => {
    expect(abbreviateTrailingUSState('Georgia, Vermont')).toBe('Georgia, VT');
  });
});

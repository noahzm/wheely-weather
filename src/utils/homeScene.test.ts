import { describe, expect, it } from 'vitest';

import { isSkyUnderStatusBar } from './homeScene';

describe('isSkyUnderStatusBar', () => {
  const topInset = 62;

  it('is true at rest and while pulled down', () => {
    expect(isSkyUnderStatusBar(-160, topInset)).toBe(true);
    expect(isSkyUnderStatusBar(-260, topInset)).toBe(true);
  });

  it('turns false once content reaches the compact bar', () => {
    expect(isSkyUnderStatusBar(-106, topInset)).toBe(false);
    expect(isSkyUnderStatusBar(400, topInset)).toBe(false);
  });
});

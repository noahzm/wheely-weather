import { describe, expect, it } from 'vitest';

import { foldRestOffset, largeTitleTopOffset } from './largeTitleScroll';

describe('foldRestOffset', () => {
  it('starts from the first offset', () => {
    expect(foldRestOffset(null, -160)).toBe(-160);
  });

  it('keeps the lowest offset as the inset settles', () => {
    expect(foldRestOffset(0, -62)).toBe(-62);
    expect(foldRestOffset(-62, -160)).toBe(-160);
    expect(foldRestOffset(-160, -106)).toBe(-160);
  });
});

describe('largeTitleTopOffset', () => {
  const topInset = 62;

  it('uses the measured rest offset', () => {
    expect(largeTitleTopOffset(-158, topInset)).toBe(-158);
  });

  it('estimates the expanded inset without a usable measurement', () => {
    expect(largeTitleTopOffset(null, topInset)).toBe(-160);
    expect(largeTitleTopOffset(0, topInset)).toBe(-160);
  });
});

import { describe, expect, it } from 'vitest';
import { measureSafeAreaEnvInsets, sameInsets } from '@/components/wheely/safe-area-env-insets';

/** Minimal Document stub: one shared probe element whose computed paddings are fixed. */
function fakeDocument(padding: { top: string; bottom: string; left: string; right: string }) {
  const removed: unknown[] = [];
  const style: Record<string, string> = {};
  const probe = {
    style,
    remove() {
      removed.push(probe);
    },
  };
  const doc = {
    createElement: () => probe,
    body: {
      // The stub never inspects the appended probe.
      append: () => true,
    },
    defaultView: {
      getComputedStyle: () => ({
        paddingTop: padding.top,
        paddingBottom: padding.bottom,
        paddingLeft: padding.left,
        paddingRight: padding.right,
      }),
    },
  };
  return { doc: doc as unknown as Document, style, removed };
}

describe('measureSafeAreaEnvInsets', () => {
  it('reads the resolved env() paddings as pixel insets', () => {
    const { doc, removed } = fakeDocument({
      top: '59px',
      bottom: '34px',
      left: '0px',
      right: '44.5px',
    });
    expect(measureSafeAreaEnvInsets(doc)).toEqual({ top: 59, bottom: 34, left: 0, right: 44.5 });
    // The probe is removed from the document after measuring.
    expect(removed).toHaveLength(1);
  });

  it('falls back to zero for unparseable or unresolved values', () => {
    const { doc } = fakeDocument({
      top: 'env(safe-area-inset-top)',
      bottom: '',
      left: 'NaN',
      right: '12.5',
    });
    expect(measureSafeAreaEnvInsets(doc)).toEqual({ top: 0, bottom: 0, left: 0, right: 12.5 });
  });
});

describe('sameInsets', () => {
  const base = { top: 59, bottom: 34, left: 0, right: 0 };

  it('is true when every edge matches', () => {
    expect(sameInsets(base, { ...base })).toBe(true);
  });

  it('is false when any edge differs', () => {
    expect(sameInsets(base, { ...base, top: 0 })).toBe(false);
    expect(sameInsets(base, { ...base, bottom: 0 })).toBe(false);
    expect(sameInsets(base, { ...base, left: 44 })).toBe(false);
    expect(sameInsets(base, { ...base, right: 44 })).toBe(false);
  });
});

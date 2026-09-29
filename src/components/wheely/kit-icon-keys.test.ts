import { describe, expect, it } from 'vitest';

import { GEAR_TIPS } from '@/domain/copy';

import { resolveKitIcon } from './kit-icon-keys';

const allTipIcons = Object.values(GEAR_TIPS).flatMap((mode) =>
  Object.values(mode).flatMap((tip) => tip.items.map((item) => item.icon)),
);

describe('resolveKitIcon', () => {
  it('draws every icon key the gear tips use', () => {
    const unresolved = allTipIcons.filter((icon) => resolveKitIcon(icon).kind === 'unknown');
    expect(unresolved).toEqual([]);
  });

  it('resolves kit glyphs, shared drawings and weather tips', () => {
    expect(resolveKitIcon('BibShorts')).toEqual({ kind: 'kit', name: 'BibShorts' });
    expect(resolveKitIcon('Layers')).toEqual({ kind: 'kit', name: 'Gilet' });
    expect(resolveKitIcon('Thermometer')).toEqual({ kind: 'weather', key: 'Thermometer' });
    expect(resolveKitIcon('Unicycle')).toEqual({ kind: 'unknown' });
  });
});

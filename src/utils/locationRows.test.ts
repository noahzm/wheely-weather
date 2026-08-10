import { describe, expect, it } from 'vitest';

import {
  buildSections,
  homeAccessibilityLabel,
  isActive,
  isHome,
  isPinned,
  isSavablePlace,
  pinAccessibilityLabel,
  placeKey,
  resolveSuggestedPlace,
  sameCoords,
} from './locationRows';

const PORTLAND = { lat: 45.5, lon: -122.6, label: 'Portland' };
const AUSTIN = { lat: 30.3, lon: -97.7, label: 'Austin' };
const DENVER = { lat: 39.7, lon: -105, label: 'Denver' };

const ids = (sections: ReturnType<typeof buildSections>) => sections.map((s) => s.id);

describe('sameCoords', () => {
  it('matches on coordinates alone and tolerates a missing other side', () => {
    expect(sameCoords(PORTLAND, { lat: 45.5, lon: -122.6 })).toBe(true);
    expect(sameCoords(PORTLAND, AUSTIN)).toBe(false);
    expect(sameCoords(PORTLAND, null)).toBe(false);
    // Callers pass an optional field straight through, so a missing value must
    // read as "no match" rather than throwing.
    const absent = undefined as { lat: number; lon: number } | undefined;
    expect(sameCoords(PORTLAND, absent)).toBe(false);
  });

  it('backs both the home and active-location checks', () => {
    expect(isHome(PORTLAND, PORTLAND)).toBe(true);
    expect(isHome(PORTLAND, null)).toBe(false);
    expect(isActive(PORTLAND, { lat: 45.5, lon: -122.6 })).toBe(true);
    expect(isActive(PORTLAND, null)).toBe(false);
  });
});

describe('isPinned', () => {
  it('matches on coordinates, not on label', () => {
    expect(isPinned(PORTLAND, [AUSTIN, PORTLAND])).toBe(true);
    expect(isPinned(PORTLAND, [AUSTIN])).toBe(false);
    expect(isPinned(PORTLAND, [])).toBe(false);
    // A renamed pin is still the same place.
    expect(isPinned(PORTLAND, [{ lat: 45.5, lon: -122.6, label: 'PDX' }])).toBe(true);
  });

  it('does not treat a half-match as pinned', () => {
    expect(isPinned(PORTLAND, [{ lat: 45.5, lon: -97.7, label: 'Neither' }])).toBe(false);
  });
});

describe('placeKey', () => {
  it('keys real places by coordinate pair', () => {
    expect(placeKey(PORTLAND)).toBe('45.5--122.6');
    // Distinct places must not collide.
    expect(placeKey(PORTLAND)).not.toBe(placeKey(AUSTIN));
  });

  it('keys the synthetic device row by its kind', () => {
    expect(placeKey({ lat: 0, lon: 0, label: 'Use Current Location', _kind: 'device' })).toBe(
      'device',
    );
  });

  it('keys unresolved suggestions by completion id, not their placeholder coords', () => {
    // Every iOS suggestion shares 0,0 until it is resolved, so coordinates
    // cannot tell two of them apart — the ids have to.
    const springfieldMO = { lat: 0, lon: 0, label: 'Springfield, MO', _completionId: 'a' };
    const springfieldIL = { lat: 0, lon: 0, label: 'Springfield, IL', _completionId: 'b' };
    expect(placeKey(springfieldMO)).toBe('a');
    expect(placeKey(springfieldMO)).not.toBe(placeKey(springfieldIL));
  });

  it('prefers the device kind when both markers are somehow present', () => {
    expect(
      placeKey({
        lat: 0,
        lon: 0,
        label: 'Use Current Location',
        _kind: 'device',
        _completionId: 'a',
      }),
    ).toBe('device');
  });
});

describe('isSavablePlace', () => {
  it('accepts a real place', () => {
    expect(isSavablePlace(PORTLAND)).toBe(true);
  });

  it('rejects the device action row and unresolved suggestions', () => {
    // Pinning either one would store a location that is nowhere: the device row
    // is an action, and a suggestion still holds placeholder 0,0 coordinates.
    expect(isSavablePlace({ lat: 0, lon: 0, label: 'Use Current Location', _kind: 'device' })).toBe(
      false,
    );
    expect(isSavablePlace({ lat: 0, lon: 0, label: 'Springfield, MO', _completionId: 'a' })).toBe(
      false,
    );
  });
});

describe('resolveSuggestedPlace', () => {
  const reject = () => Promise.reject(new Error('resolver must not be called'));

  it('passes an already-placed row straight through without resolving', async () => {
    await expect(resolveSuggestedPlace(PORTLAND, reject)).resolves.toEqual(PORTLAND);
  });

  it('swaps a suggestion placeholder for the resolved coordinates, keeping its names', async () => {
    const suggestion = {
      lat: 0,
      lon: 0,
      label: 'Springfield, MO',
      displayName: 'United States',
      _completionId: 'a',
    };
    await expect(
      resolveSuggestedPlace(suggestion, () => Promise.resolve({ lat: 37.2, lon: -93.3 })),
    ).resolves.toEqual({
      lat: 37.2,
      lon: -93.3,
      label: 'Springfield, MO',
      displayName: 'United States',
    });
  });

  it('resolves with the id it was given', async () => {
    const seen: string[] = [];
    await resolveSuggestedPlace({ lat: 0, lon: 0, label: 'X', _completionId: 'abc' }, (id) => {
      seen.push(id);
      return Promise.resolve({ lat: 1, lon: 2 });
    });
    expect(seen).toEqual(['abc']);
  });

  it('returns null when the suggestion cannot be placed', async () => {
    // The caller must leave the current location alone rather than save 0,0.
    await expect(
      resolveSuggestedPlace({ lat: 0, lon: 0, label: 'X', _completionId: 'a' }, () =>
        Promise.resolve(null),
      ),
    ).resolves.toBeNull();
  });
});

describe('accessibility labels', () => {
  it('describes the action the press performs, not the current state', () => {
    expect(homeAccessibilityLabel(true)).toBe('Clear home location');
    expect(homeAccessibilityLabel(false)).toBe('Set as home location');
    expect(pinAccessibilityLabel(true)).toBe('Unpin location');
    expect(pinAccessibilityLabel(false)).toBe('Pin location');
  });
});

describe('buildSections', () => {
  it('puts Home above Pinned and Recent', () => {
    const sections = buildSections(false, [], [AUSTIN], [DENVER], PORTLAND);
    expect(ids(sections)).toEqual(['home', 'pinned', 'recent', 'options']);
    expect(sections[0]?.data).toEqual([PORTLAND]);
  });

  it('lists a home that is also pinned or recent only once, under Home', () => {
    const sections = buildSections(false, [], [PORTLAND, AUSTIN], [PORTLAND, DENVER], PORTLAND);
    expect(sections.find((s) => s.id === 'home')?.data).toEqual([PORTLAND]);
    expect(sections.find((s) => s.id === 'pinned')?.data).toEqual([AUSTIN]);
    expect(sections.find((s) => s.id === 'recent')?.data).toEqual([DENVER]);
  });

  it('drops the Pinned section when home was its only entry', () => {
    const sections = buildSections(false, [], [PORTLAND], [], PORTLAND);
    expect(ids(sections)).toEqual(['home', 'options']);
  });

  it('omits Home when none is set, leaving the previous ordering intact', () => {
    const sections = buildSections(false, [], [AUSTIN], [DENVER], null);
    expect(ids(sections)).toEqual(['pinned', 'recent', 'options']);
  });

  it('defaults to no home when the argument is omitted entirely', () => {
    const sections = buildSections(false, [], [AUSTIN], [DENVER]);
    expect(ids(sections)).toEqual(['pinned', 'recent', 'options']);
  });

  it('shows only results while searching, never Home', () => {
    const sections = buildSections(true, [AUSTIN], [AUSTIN], [DENVER], PORTLAND);
    expect(ids(sections)).toEqual(['results']);
  });

  it('shows nothing at all while searching with no results', () => {
    // Options is deliberately withheld mid-search: the list is a result set then.
    expect(buildSections(true, [], [AUSTIN], [DENVER], PORTLAND)).toEqual([]);
  });

  it('still excludes pinned entries from Recent', () => {
    const sections = buildSections(false, [], [AUSTIN], [AUSTIN, DENVER], null);
    expect(sections.find((s) => s.id === 'recent')?.data).toEqual([DENVER]);
  });
});

import { describe, expect, it } from 'vitest';

import { buildSections, isActive, isHome, sameCoords } from './location-search-list.types';

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

  it('shows only results while searching, never Home', () => {
    const sections = buildSections(true, [AUSTIN], [AUSTIN], [DENVER], PORTLAND);
    expect(ids(sections)).toEqual(['results']);
  });

  it('still excludes pinned entries from Recent', () => {
    const sections = buildSections(false, [], [AUSTIN], [AUSTIN, DENVER], null);
    expect(sections.find((s) => s.id === 'recent')?.data).toEqual([DENVER]);
  });
});

import { describe, expect, it } from 'vitest';

import { LOCATION_FOLLOW_THRESHOLD_M, distanceMeters, hasMovedSignificantly } from './geo';

const TORONTO = { lat: 43.6532, lon: -79.3832 };
const HAMILTON = { lat: 43.2557, lon: -79.8711 };

describe('distanceMeters', () => {
  it('returns zero for the same point', () => {
    expect(distanceMeters(TORONTO, TORONTO)).toBe(0);
  });

  it('matches the known great-circle distance between two cities', () => {
    // Toronto -> Hamilton is ~59.2 km.
    expect(distanceMeters(TORONTO, HAMILTON)).toBeCloseTo(59_200, -3);
  });

  it('is symmetric', () => {
    expect(distanceMeters(TORONTO, HAMILTON)).toBeCloseTo(distanceMeters(HAMILTON, TORONTO), 6);
  });

  it('measures across the antimeridian without wrapping the long way round', () => {
    // 0.2 degrees of longitude at 60N is ~11 km, not ~half the planet.
    const distance = distanceMeters({ lat: 60, lon: 179.9 }, { lat: 60, lon: -179.9 });
    expect(distance).toBeGreaterThan(10_000);
    expect(distance).toBeLessThan(12_000);
  });
});

describe('hasMovedSignificantly', () => {
  it('treats a missing previous fix as moved', () => {
    expect(hasMovedSignificantly(null, TORONTO)).toBe(true);
    expect(hasMovedSignificantly(undefined, TORONTO)).toBe(true);
  });

  it('ignores drift below the threshold', () => {
    // ~1.1 km north of Toronto.
    expect(hasMovedSignificantly(TORONTO, { lat: TORONTO.lat + 0.01, lon: TORONTO.lon })).toBe(
      false,
    );
  });

  it('reports a move past the threshold', () => {
    // ~3.3 km north of Toronto.
    expect(hasMovedSignificantly(TORONTO, { lat: TORONTO.lat + 0.03, lon: TORONTO.lon })).toBe(
      true,
    );
  });

  it('honours a custom threshold', () => {
    const nearby = { lat: TORONTO.lat + 0.01, lon: TORONTO.lon };
    expect(hasMovedSignificantly(TORONTO, nearby, 500)).toBe(true);
    expect(hasMovedSignificantly(TORONTO, nearby, LOCATION_FOLLOW_THRESHOLD_M)).toBe(false);
  });
});

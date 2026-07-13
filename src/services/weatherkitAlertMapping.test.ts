import { describe, expect, it } from 'vitest';

import { mapWeatherKitAlert } from './weatherkitAlertMapping';

describe('mapWeatherKitAlert', () => {
  it('maps WeatherKit alert metadata into UI details fields', () => {
    const mapped = mapWeatherKitAlert({
      summary: 'Heat Advisory',
      severity: 'severe',
      source: 'NWS',
      region: 'Wake County',
      detailsURL: 'https://alerts.example.com/heat-advisory',
      expirationDate: '2026-07-12T16:00:00Z',
    });

    expect(mapped).toEqual({
      type: 'weatherkit',
      severity: 'extreme',
      event: 'Heat Advisory',
      headline: 'Heat Advisory',
      description: 'NWS • Wake County',
      message: 'Heat Advisory',
      expires: '2026-07-12T16:00:00Z',
      detailsUrl: 'https://alerts.example.com/heat-advisory',
    });
  });

  it('falls back to warning severity for unknown values', () => {
    const mapped = mapWeatherKitAlert({
      summary: 'Special Weather Statement',
      severity: 'new-severity-value',
      source: 'NWS',
      region: null,
      detailsURL: 'https://alerts.example.com/special-weather',
      expirationDate: '2026-07-12T18:00:00Z',
    });

    expect(mapped.severity).toBe('warning');
    expect(mapped.description).toBe('NWS');
  });
});

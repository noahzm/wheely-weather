import { describe, it, expect } from 'vitest';

import {
  DEFAULT_SETTINGS,
  normalizeLocationRecord,
  parseAppearance,
  parseExposureLevel,
  parseGearMode,
  parseHomeLocation,
  parseHomeLocationAuto,
  parseHomeLocationChosen,
  parseTempUnit,
} from './settingsCodec';

describe('setting parsers', () => {
  it('parses known values and falls back to defaults otherwise', () => {
    expect(parseGearMode('pro')).toBe('pro');
    expect(parseGearMode('casual')).toBe('casual');
    expect(parseGearMode('nonsense')).toBe('casual');
    expect(parseGearMode(null)).toBe('casual');

    expect(parseAppearance('light')).toBe('light');
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('nonsense')).toBe('system');
    expect(parseAppearance(null)).toBe('system');

    expect(parseTempUnit('fahrenheit')).toBe('fahrenheit');
    expect(parseTempUnit('celsius')).toBe('celsius');
    expect(parseTempUnit('nonsense')).toBe('auto');
    expect(parseTempUnit(null)).toBe('auto');
  });

  it('exposes defaults matching the parser fallbacks', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      gearMode: parseGearMode(null),
      appearance: parseAppearance(null),
      homeLocation: parseHomeLocation(null),
      homeLocationChosen: parseHomeLocationChosen(null),
      homeLocationAuto: parseHomeLocationAuto(null),
      tempUnit: parseTempUnit(null),
      exposureLevel: parseExposureLevel(null),
    });
  });
});

describe('parseHomeLocationChosen', () => {
  it('treats a stored location or a cleared marker as chosen', () => {
    expect(parseHomeLocationChosen(null)).toBe(false);
    expect(parseHomeLocationChosen('{"version":1,"cleared":true}')).toBe(true);
    expect(parseHomeLocationChosen('{"version":1,"lat":1,"lon":2}')).toBe(true);
  });

  it('reads the provisional marker only on a real home', () => {
    expect(parseHomeLocationAuto('{"version":1,"lat":1,"lon":2,"auto":true}')).toBe(true);
    expect(parseHomeLocationAuto('{"version":1,"lat":1,"lon":2}')).toBe(false);
    expect(parseHomeLocationAuto('{"version":1,"cleared":true,"auto":true}')).toBe(false);
    expect(parseHomeLocationAuto('{not json')).toBe(false);
  });

  it('reads a cleared marker as no home', () => {
    expect(parseHomeLocation('{"version":1,"cleared":true}')).toBeNull();
  });
});

describe('parseHomeLocation', () => {
  it('round-trips a stored location and tolerates the version field', () => {
    const stored = JSON.stringify({ version: 1, lat: 45.5, lon: -122.6, name: 'Portland' });
    expect(parseHomeLocation(stored)).toEqual({
      lat: 45.5,
      lon: -122.6,
      name: 'Portland',
      source: 'manual',
    });
  });

  it('returns null for missing, corrupt, or invalid payloads', () => {
    expect(parseHomeLocation(null)).toBeNull();
    expect(parseHomeLocation('not json{')).toBeNull();
    expect(parseHomeLocation('{"lat": 999, "lon": 0}')).toBeNull();
    expect(parseHomeLocation('"just a string"')).toBeNull();
  });
});

describe('normalizeLocationRecord', () => {
  it('coerces numeric strings, trims/caps names, and defaults the source', () => {
    expect(normalizeLocationRecord({ lat: '45.5', lon: '-122.6', name: '  Portland  ' })).toEqual({
      lat: 45.5,
      lon: -122.6,
      name: 'Portland',
      source: 'manual',
    });
    expect(normalizeLocationRecord({ lat: 1, lon: 2, name: '', source: 'device' })).toEqual({
      lat: 1,
      lon: 2,
      name: null,
      source: 'device',
    });
  });

  it('rejects out-of-range and non-numeric coordinates', () => {
    expect(normalizeLocationRecord({ lat: 91, lon: 0 })).toBeNull();
    expect(normalizeLocationRecord({ lat: 0, lon: -181 })).toBeNull();
    expect(normalizeLocationRecord({ lat: 'x', lon: 0 })).toBeNull();
    expect(normalizeLocationRecord(null)).toBeNull();
  });
});

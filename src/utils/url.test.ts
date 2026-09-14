import { describe, expect, it } from 'vitest';

import { isSafeExternalUrl } from './url';

describe('isSafeExternalUrl', () => {
  it('accepts valid https URLs', () => {
    expect(isSafeExternalUrl('https://wheelyweather.app')).toBe(true);
    expect(isSafeExternalUrl('https://api.weather.gov/alerts/active?point=40,-74')).toBe(true);
  });

  it('accepts valid http URLs', () => {
    expect(isSafeExternalUrl('http://example.com/advisory')).toBe(true);
  });

  it('rejects dangerous pseudo-protocols and schemes', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('blob:https://wheelyweather.app/uuid')).toBe(false);
    expect(isSafeExternalUrl('ftp://ftp.example.com/file')).toBe(false);
  });

  it('rejects relative, malformed, or falsy values', () => {
    expect(isSafeExternalUrl('/relative/path')).toBe(false);
    expect(isSafeExternalUrl('//schemeless.org')).toBe(false);
    expect(isSafeExternalUrl('not-a-url')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
    expect(isSafeExternalUrl()).toBe(false);
  });
});

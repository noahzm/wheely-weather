import { describe, it, expect, vi, afterEach } from 'vitest';
import worker, { type Env } from './index';

// API routes must never fall through to static assets.
const apiEnv: Env = {
  ASSETS: {
    fetch: () => Promise.reject(new Error('API route reached ASSETS')),
  },
};

describe('Cloudflare Worker geocode proxy', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('OPTIONS preflight', () => {
    it('returns 204 with CORS headers', async () => {
      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston', {
        method: 'OPTIONS',
      });
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://wheelyweather.app');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });

  describe('/api/geocode/search', () => {
    it('rejects unsupported HTTP methods with 405', async () => {
      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston', {
        method: 'POST',
      });
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Method not allowed' });
    });

    it('rejects missing q parameter with 400', async () => {
      const request = new Request('https://wheelyweather.app/api/geocode/search');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Missing q parameter' });
    });

    it('rejects overly long queries with 400', async () => {
      const longQuery = 'a'.repeat(201);
      const request = new Request(`https://wheelyweather.app/api/geocode/search?q=${longQuery}`);
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Query too long' });
    });

    it('proxies valid search and applies cache headers on 200', async () => {
      const mockNominatimResponse = [{ lat: '42.36', lon: '-71.05', display_name: 'Boston, MA' }];
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockNominatimResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://wheelyweather.app');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe(
        'camera=(), microphone=(), geolocation=(self)',
      );
      const data: unknown = await response.json();
      expect(data).toEqual(mockNominatimResponse);
    });

    it('handles 429 rate limit with no-store', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response('Too Many Requests', { status: 429 }));

      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(429);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Rate limited. Try again shortly.' });
    });

    it('sets no-store on upstream server errors (e.g. 500)', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(500);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('catches network exceptions and returns 502 with no-store', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection reset'));

      const request = new Request('https://wheelyweather.app/api/geocode/search?q=Boston');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(502);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Geocoding service unavailable' });
    });
  });

  describe('/api/geocode/reverse', () => {
    it('rejects missing lat or lon with 400', async () => {
      const request = new Request('https://wheelyweather.app/api/geocode/reverse?lat=42.36');
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Missing lat or lon parameter' });
    });

    it('rejects invalid coordinates with 400', async () => {
      const request = new Request(
        'https://wheelyweather.app/api/geocode/reverse?lat=invalid&lon=-71.05',
      );
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Invalid coordinates' });
    });

    it('rejects out of range coordinates with 400', async () => {
      const request = new Request(
        'https://wheelyweather.app/api/geocode/reverse?lat=95&lon=-71.05',
      );
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(400);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: 'Invalid coordinates' });
    });

    it('proxies valid reverse geocode and applies cache headers on 200', async () => {
      const mockResult = { address: { city: 'Boston', state: 'Massachusetts' } };
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const request = new Request(
        'https://wheelyweather.app/api/geocode/reverse?lat=42.36&lon=-71.05',
      );
      const response = await worker.fetch(request, apiEnv);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
      const data: unknown = await response.json();
      expect(data).toEqual(mockResult);
    });
  });

  describe('other paths', () => {
    it('hands non-geocode requests to the static assets unchanged', async () => {
      const assetResponse = new Response('<!DOCTYPE html><html></html>', { status: 200 });
      const fakeAssetFetch = vi.fn().mockResolvedValue(assetResponse);

      const request = new Request('https://wheelyweather.app/api/unknown');
      const response = await worker.fetch(request, { ASSETS: { fetch: fakeAssetFetch } });
      expect(fakeAssetFetch).toHaveBeenCalledWith(request);
      expect(response).toBe(assetResponse);
    });
  });
});

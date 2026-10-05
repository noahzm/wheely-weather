const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'WheelyWeather/1.0 (https://wheelyweather.app; contact@wheelyweather.app)';

const SEARCH_CACHE_CONTROL = 'public, max-age=3600';
const REVERSE_CACHE_CONTROL = 'public, max-age=86400';

// Only the app's own origin may read proxied responses cross-origin. Native
// clients call Nominatim directly, so the proxy only serves the web app.
const ALLOWED_ORIGIN = 'https://wheelyweather.app';
// Nominatim place queries are short; cap input size to blunt proxy abuse.
const MAX_QUERY_LENGTH = 200;

/** Bindings from wrangler.jsonc. */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/geocode/search') {
      return handleGeocode(request, buildSearchUrl(url), SEARCH_CACHE_CONTROL);
    }
    if (url.pathname === '/api/geocode/reverse') {
      return handleGeocode(request, buildReverseUrl(url), REVERSE_CACHE_CONTROL);
    }

    // Only /api/* runs the Worker first (wrangler.jsonc); pages and files are
    // served from dist/ directly, with headers from public/_headers. An unknown
    // /api/ path falls through to the assets' SPA fallback.
    return env.ASSETS.fetch(request);
  },
};

/** The Nominatim URL to proxy, or why the request can't be proxied. */
type GeocodeTarget = { url: string } | { error: string };

function buildSearchUrl(url: URL): GeocodeTarget {
  const q = url.searchParams.get('q')?.trim();
  if (!q) return { error: 'Missing q parameter' };
  if (q.length > MAX_QUERY_LENGTH) return { error: 'Query too long' };
  return {
    url: `${NOMINATIM_SEARCH}?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`,
  };
}

function buildReverseUrl(url: URL): GeocodeTarget {
  const latStr = url.searchParams.get('lat');
  const lonStr = url.searchParams.get('lon');
  if (!latStr || !lonStr) return { error: 'Missing lat or lon parameter' };
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return { error: 'Invalid coordinates' };
  }
  return { url: `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json` };
}

async function handleGeocode(
  request: Request,
  target: GeocodeTarget,
  cacheControl: string,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...jsonHeaders(),
        'Cache-Control': 'no-store',
        Allow: 'GET, OPTIONS',
      },
    });
  }
  if ('error' in target) return badRequest(target.error);

  try {
    const res = await fetch(target.url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limited. Try again shortly.' }), {
        status: 429,
        headers: {
          ...jsonHeaders(),
          'Cache-Control': 'no-store',
        },
      });
    }

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        ...jsonHeaders(),
        'Cache-Control': res.ok ? cacheControl : 'no-store',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Geocoding service unavailable' }), {
      status: 502,
      headers: {
        ...jsonHeaders(),
        'Cache-Control': 'no-store',
      },
    });
  }
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: jsonHeaders(),
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...SECURITY_HEADERS,
  };
}

function jsonHeaders() {
  return {
    ...corsHeaders(),
    'Content-Type': 'application/json',
  };
}

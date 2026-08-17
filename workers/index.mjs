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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/geocode/search') {
      return handleGeocode(request, buildSearchUrl(url), SEARCH_CACHE_CONTROL);
    }
    if (url.pathname === '/api/geocode/reverse') {
      return handleGeocode(request, buildReverseUrl(url), REVERSE_CACHE_CONTROL);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status === 200) {
      const pathname = url.pathname;
      if (pathname.includes('/_expo/static/') || pathname.includes('/assets/')) {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } else if (isHtmlShellRequest(pathname)) {
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
    return response;
  },
};

/**
 * HTML shell requests must not be heuristically cached, or a returning user can
 * be served a stale app shell after a deploy. Extensionless paths (/location,
 * /settings) reach here as SPA-fallback index.html responses, so treat any path
 * whose last segment has no file extension as a shell request too.
 * @param {string} pathname
 */
function isHtmlShellRequest(pathname) {
  if (pathname === '/') return true;
  if (
    pathname.endsWith('.html') ||
    pathname.endsWith('robots.txt') ||
    pathname.endsWith('favicon.ico')
  ) {
    return true;
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !lastSegment.includes('.');
}

/** @param {URL} url */
function buildSearchUrl(url) {
  const q = url.searchParams.get('q')?.trim();
  if (!q) return badRequest('Missing q parameter');
  if (q.length > MAX_QUERY_LENGTH) return badRequest('Query too long');
  return `${NOMINATIM_SEARCH}?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;
}

/** @param {URL} url */
function buildReverseUrl(url) {
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  if (!lat || !lon) return badRequest('Missing lat or lon parameter');
  return (
    `${NOMINATIM_REVERSE}?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}&format=json`
  );
}

/**
 * @param {Request} request
 * @param {string | Response} nominatimUrl URL to proxy, or an error Response from the builder
 * @param {string} cacheControl
 */
async function handleGeocode(request, nominatimUrl, cacheControl) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (nominatimUrl instanceof Response) return nominatimUrl;

  const res = await fetch(nominatimUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (res.status === 429) {
    return new Response(JSON.stringify({ error: 'Rate limited. Try again shortly.' }), {
      status: 429,
      headers: jsonHeaders(),
    });
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      ...jsonHeaders(),
      'Cache-Control': cacheControl,
    },
  });
}

/** @param {string} message */
function badRequest(message) {
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
  };
}

function jsonHeaders() {
  return {
    ...corsHeaders(),
    'Content-Type': 'application/json',
  };
}

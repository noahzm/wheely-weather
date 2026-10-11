import { fetchAqi, type ForecastBundle } from '../src/services/weatherFetch';
import {
  fetchWeatherKitForecast,
  hasWeatherKitCredentials,
  type WeatherKitSecrets,
} from './weatherkit';

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'WheelyWeather/1.0 (https://wheelyweather.app; contact@wheelyweather.app)';

const SEARCH_CACHE_CONTROL = 'public, max-age=3600';
const REVERSE_CACHE_CONTROL = 'public, max-age=86400';
// Nominatim's usage policy requires caching results. Its answers are cached at
// the edge for as long as browsers keep them, so a place looked up by one rider
// is answered from the cache for the next.
const SEARCH_EDGE_TTL_S = 3600;
const REVERSE_EDGE_TTL_S = 86_400;
// Reverse lookups only name the town: round to ~100 m so nearby riders share
// cache entries and Nominatim never sees a precise position.
const REVERSE_COORD_DECIMALS = 3;
// Forecasts change slowly; a shared edge cache keeps WeatherKit calls within
// the developer-account quota. A bundle missing its AQI (Open-Meteo timed out)
// is kept only briefly so the next visitor gets another try.
const FORECAST_CACHE_CONTROL = 'public, max-age=600';
const PARTIAL_FORECAST_CACHE_CONTROL = 'public, max-age=60';
// Those TTLs are for the edge only. Cloudflare's zone Browser Cache TTL (4 h
// by default) raises any shorter max-age on a response read back from the
// cache, which pinned browsers to one bundle for hours: reloads, stale
// refreshes and pull-to-refresh all got it back. Browsers revalidate instead,
// and the edge cache answers.
const BROWSER_FORECAST_CACHE_CONTROL = 'no-cache';

// Only the app's own origin may read proxied responses cross-origin. Native
// clients call Nominatim and WeatherKit directly, so the API only serves the
// web app.
const ALLOWED_ORIGIN = 'https://wheelyweather.app';
// Nominatim place queries are short; cap input size to blunt proxy abuse.
const MAX_QUERY_LENGTH = 200;

/** The part of the Workers `ExecutionContext` the API uses. */
interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

/** Bindings from wrangler.jsonc, plus the WeatherKit secrets. */
export interface Env extends WeatherKitSecrets {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};

export default {
  async fetch(request: Request, env: Env, ctx?: Context): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/geocode/search') {
      return handleGeocode(request, buildSearchUrl(url), {
        cacheControl: SEARCH_CACHE_CONTROL,
        edgeTtl: SEARCH_EDGE_TTL_S,
      });
    }
    if (url.pathname === '/api/geocode/reverse') {
      return handleGeocode(request, buildReverseUrl(url), {
        cacheControl: REVERSE_CACHE_CONTROL,
        edgeTtl: REVERSE_EDGE_TTL_S,
      });
    }
    if (url.pathname === '/api/forecast') {
      return handleForecast(request, url, env, ctx);
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

type Coordinates = { lat: number; lon: number } | { error: string };

function parseCoordinates(url: URL): Coordinates {
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
  return { lat, lon };
}

function buildReverseUrl(url: URL): GeocodeTarget {
  const coords = parseCoordinates(url);
  if ('error' in coords) return coords;
  const lat = coords.lat.toFixed(REVERSE_COORD_DECIMALS);
  const lon = coords.lon.toFixed(REVERSE_COORD_DECIMALS);
  return { url: `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json` };
}

/** `fetch` options plus the Workers-only `cf` cache controls. */
type EdgeCachedInit = RequestInit & {
  cf: { cacheEverything: boolean; cacheTtlByStatus: Record<string, number> };
};

/** Workers' shared edge cache; absent outside the Workers runtime (tests). */
function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default ?? null;
}

/**
 * One response with everything the web app's forecast needs: WeatherKit's
 * forecast and alerts (a single Apple request) plus Open-Meteo's AQI, fetched
 * side by side at the edge and cached together.
 */
async function handleForecast(
  request: Request,
  url: URL,
  env: Env,
  ctx?: Context,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
  const coords = parseCoordinates(url);
  if ('error' in coords) return badRequest(coords.error);
  if (!hasWeatherKitCredentials(env)) {
    return errorResponse(503, 'WeatherKit is not configured');
  }

  // Round to ~1 km so nearby riders share cache entries; WeatherKit's grid
  // is coarser than that anyway.
  const lat = Math.round(coords.lat * 100) / 100;
  const lon = Math.round(coords.lon * 100) / 100;
  const cacheKey = new Request(`${url.origin}/api/forecast?lat=${lat}&lon=${lon}`);
  const cache = edgeCache();
  const cached = await cache?.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('Cache-Control', BROWSER_FORECAST_CACHE_CONTROL);
    return response;
  }

  try {
    // AQI never rejects; it resolves null on failure or after its timeout.
    const [{ forecast, alerts }, aqi] = await Promise.all([
      fetchWeatherKitForecast(env, lat, lon),
      fetchAqi(lat, lon),
    ]);
    const bundle: ForecastBundle = { forecast, alerts, aqi };
    const body = JSON.stringify(bundle);
    if (cache) {
      const edgeCacheControl =
        aqi == null ? PARTIAL_FORECAST_CACHE_CONTROL : FORECAST_CACHE_CONTROL;
      const stored = cache.put(
        cacheKey,
        new Response(body, { headers: { ...jsonHeaders(), 'Cache-Control': edgeCacheControl } }),
      );
      // Store after responding; outside the Workers runtime there's no context.
      if (ctx) ctx.waitUntil(stored);
      else await stored;
    }
    return new Response(body, {
      headers: { ...jsonHeaders(), 'Cache-Control': BROWSER_FORECAST_CACHE_CONTROL },
    });
  } catch (error) {
    console.error('WeatherKit forecast failed', error);
    return errorResponse(502, 'Weather service unavailable');
  }
}

async function handleGeocode(
  request: Request,
  target: GeocodeTarget,
  { cacheControl, edgeTtl }: { cacheControl: string; edgeTtl: number },
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
  if ('error' in target) return badRequest(target.error);

  try {
    const init: EdgeCachedInit = {
      headers: { 'User-Agent': USER_AGENT },
      // JSON isn't cached by default; only successful answers are kept.
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': edgeTtl, '300-599': -1 } },
    };
    const res = await fetch(target.url, init);

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

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      ...jsonHeaders(),
      'Cache-Control': 'no-store',
      Allow: 'GET, OPTIONS',
    },
  });
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...jsonHeaders(), 'Cache-Control': 'no-store' },
  });
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

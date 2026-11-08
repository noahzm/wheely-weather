import { fetchWithTimeout } from '../src/services/http';

interface ObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: number): Promise<void>;
  };
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

const INTERVAL_MS = 1100;
const USER_AGENT = 'WheelyWeather/1.0 (https://wheelyweather.app; contact@wheelyweather.app)';

/** One named object serializes all app traffic to the public geocoder. */
export class NominatimProxy {
  constructor(private readonly state: ObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      request.method !== 'GET' ||
      url.origin !== 'https://nominatim.openstreetmap.org' ||
      !['/search', '/reverse'].includes(url.pathname)
    ) {
      return new Response(null, { status: 400 });
    }
    // Keep the upstream request inside the lock. Independent edge locations
    // cannot overlap requests, and the timestamp survives object eviction.
    return this.state.blockConcurrencyWhile(async () => {
      const nextAllowed = (await this.state.storage.get<number>('nextAllowed')) ?? 0;
      if (Date.now() < nextAllowed) {
        return new Response(null, { status: 429, headers: { 'Retry-After': '2' } });
      }
      await this.state.storage.put('nextAllowed', Date.now() + INTERVAL_MS);
      try {
        return await fetchWithTimeout(
          url.toString(),
          { headers: { 'User-Agent': USER_AGENT } },
          6000,
        );
      } finally {
        // Space from completion too: slow storage or network must never let
        // two actual upstream starts bunch together after the initial grant.
        await this.state.storage.put('nextAllowed', Date.now() + INTERVAL_MS);
      }
    });
  }
}

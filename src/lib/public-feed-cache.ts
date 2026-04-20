type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function readCachedJson<T>(url: string): T | null {
  const cached = responseCache.get(url) as CacheEntry<T> | undefined;
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(url);
    return null;
  }

  return cached.data;
}

export async function fetchCachedJson<T>(url: string, ttlMs = 15_000): Promise<T> {
  const cached = readCachedJson<T>(url);
  if (cached !== null) {
    return cached;
  }

  const inFlight = inFlightRequests.get(url) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const request = fetch(url)
    .then(async (res) => {
      const json = (await res.json()) as T & { error?: string };

      if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }

      responseCache.set(url, {
        data: json,
        expiresAt: Date.now() + ttlMs,
      });

      return json as T;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, request);
  return request;
}

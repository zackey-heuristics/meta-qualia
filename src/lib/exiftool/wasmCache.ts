// The ExifTool WASM binary is ~25MB uncompressed. The library re-fetches it every
// time its in-memory instance is garbage-collected (it's only held via WeakRef),
// so without this layer a returning visitor could pay for the download again even
// within the same browser session. The Cache Storage API persists it across page
// reloads and browser restarts, independent of the library's own lifecycle.
const CACHE_PREFIX = "exiftool-wasm-";
const CACHE_NAME = `${CACHE_PREFIX}v1.0.9`; // bump when the @uswriting/exiftool version changes

async function pruneOldCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
  );
}

async function fetchWithCache(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof caches === "undefined") {
    return fetch(input, init);
  }
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(input);
    if (cached) return cached;

    const response = await fetch(input, init);
    if (response.ok) {
      await cache.put(input, response.clone());
      void pruneOldCaches();
    }
    return response;
  } catch {
    return fetch(input, init);
  }
}

/**
 * Drop-in fetch replacement (matching @uswriting/exiftool's loosely-typed `FetchLike`)
 * that persists the response in Cache Storage so the wasm is only downloaded once per browser.
 */
export const cachedFetch = (...args: unknown[]): Promise<Response> =>
  fetchWithCache(args[0] as RequestInfo | URL, args[1] as RequestInit | undefined);

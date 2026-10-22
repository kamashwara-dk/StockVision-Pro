/**
 * lib/searchCache.ts — In-memory 60-second cache for search queries.
 *
 * Keyed by the normalised query string (trimmed, lowercased).
 * Entries expire after CACHE_TTL_MS. Cache is per-process (best-effort
 * in serverless; Vercel may run multiple instances).
 */

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  results: SearchSuggestion[];
  cachedAt: number;
}

export interface SearchSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const cache = new Map<string, CacheEntry>();

export function getCached(query: string): SearchSuggestion[] | null {
  const key = query.trim().toLowerCase();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

export function setCached(query: string, results: SearchSuggestion[]): void {
  const key = query.trim().toLowerCase();
  cache.set(key, { results, cachedAt: Date.now() });
}

/** Visible for testing only. */
export function clearCache(): void {
  cache.clear();
}

import 'server-only'
// ── Server-side cache for geographic / reference data ──────────────────────
//
// Hitting the Census API on every Scout search would be wasteful —
// municipality lists change on the order of months, not minutes. This is a
// simple in-memory Map-backed cache that honors the stale thresholds from
// dataIntegrity.ts. On a serverless cold start the cache is empty and the
// next request warms it; subsequent requests hit memory.
//
// In production on Vercel Fluid Compute, instances are reused across
// requests for their lifetime, so this is useful. If you want cache to
// survive cold starts, swap the Map for a KV store (Vercel KV, Upstash,
// or a Supabase table). The `getCached` / `setCache` surface is stable so
// the backing store can change without touching callers.

import { isStale, type VerifiedDataSource, type StaleThresholdKey } from './dataIntegrity'

// ── Storage primitive ───────────────────────────────────────────────────────
// Kept behind a wrapper so it's easy to replace with KV later.
const memory = new Map<string, VerifiedDataSource>()

export function getCached(
  key: string,
  category: StaleThresholdKey
): VerifiedDataSource | null {
  const entry = memory.get(key)
  if (!entry) return null
  if (isStale(entry.fetched_at, category)) {
    memory.delete(key)
    return null
  }
  return entry
}

export function setCache(key: string, value: VerifiedDataSource): void {
  memory.set(key, value)
}

export function clearCache(): void {
  memory.clear()
}

// Convenience: single-shot "give me this, or fetch it now" helper.
// Generic over the shape of the payload so callers get proper types back.
export async function getOrFetch<T extends VerifiedDataSource>(
  key: string,
  category: StaleThresholdKey,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCached(key, category)
  if (cached) return cached as T
  const fresh = await fetcher()
  setCache(key, fresh)
  return fresh
}

// ── Cache key builders ──────────────────────────────────────────────────────
// Centralized so two callers never accidentally create different keys for
// the same dataset (which would double the API load without anyone noticing).
export const cacheKeys = {
  places: (state: string, incorporatedOnly = false) =>
    `places:${state.toUpperCase()}${incorporatedOnly ? ':inc' : ''}`,
  counties: (state: string) => `counties:${state.toUpperCase()}`,
  zips: (state: string) => `zips:${state.toUpperCase()}`,
  gbpCategories: () => 'gbp:categories',
  naicsCodes: () => 'industry:naics',
}

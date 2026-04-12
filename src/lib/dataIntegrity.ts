import 'server-only'
// ── Koto Platform 11 — Universal Data Integrity Standard ─────────────────────
//
// Every data lookup in the platform that touches the real world (geography,
// industry, business listings, reviews, rankings) must pass through this
// standard. The rule: Koto never uses recalled, hardcoded, or AI-generated
// data as if it were ground truth. Every piece of displayed data carries a
// provenance record — where it came from, when it was fetched, and when
// it goes stale.
//
// See also:
//   - src/lib/dataSources.ts   — registry of authoritative source URLs
//   - src/lib/geoLookup.ts     — Census API wrappers for states/counties/places
//   - src/lib/geoCache.ts      — server-side cache with expiry
//   - src/components/DataSourceBadge.jsx — UI provenance display
//   - CLAUDE.md                 — permanent project rules
// ─────────────────────────────────────────────────────────────────────────────

export type DataSourceType =
  | 'government-federal'     // census.gov, data.gov, USPS, OSHA, etc.
  | 'government-state'       // state government databases
  | 'government-county'      // county databases
  | 'government-municipal'   // city/town databases
  | 'google-api'             // Google Maps Places, GBP, etc.
  | 'industry-registry'      // NAICS, SIC, industry associations
  | 'third-party-verified'   // Yelp, BBB, Moz, BrightLocal
  | 'user-provided'          // data the agency user entered themselves
  | 'ai-generated'           // synthesized by Claude — must be flagged in UI

export type Confidence =
  | 'verified'         // cross-referenced across 2+ independent authoritative sources
  | 'cross-referenced' // verified against a secondary source
  | 'single-source'    // single authoritative source, no cross-reference yet
  | 'ai-inferred'      // produced by an LLM — show AI warning in UI

export interface VerifiedDataSource {
  source_url: string       // exact URL the data came from
  source_name: string      // human-readable name of the source
  source_type: DataSourceType
  fetched_at: string       // ISO 8601 timestamp
  expires_at: string       // ISO 8601 — refetch after this
  cross_referenced: boolean
  ai_generated: boolean
  confidence: Confidence
}

// Maximum allowed age of data by category. Fresher is always better; these
// are the ceilings, not the targets. Derived by asking: "how fast can the
// real-world fact change?" Geographic boundaries shift slowly; Google rankings
// shift by the hour.
export const STALE_THRESHOLDS_MS = {
  // Geographic / administrative — changes rarely but must still be verified
  'geo-state':        365 * 24 * 60 * 60 * 1000,   // 1 year
  'geo-county':       365 * 24 * 60 * 60 * 1000,   // 1 year
  'geo-municipality': 180 * 24 * 60 * 60 * 1000,   // 6 months (incorporations happen)
  'geo-zip':          180 * 24 * 60 * 60 * 1000,   // 6 months (USPS updates quarterly)

  // Industry classifications
  'industry-naics':   365 * 24 * 60 * 60 * 1000,   // 1 year
  'industry-sic':     365 * 24 * 60 * 60 * 1000,   // 1 year
  'gbp-categories':    90 * 24 * 60 * 60 * 1000,   // 90 days (Google updates)

  // Business data — changes regularly
  'business-listing':  30 * 24 * 60 * 60 * 1000,   // 30 days
  'business-contact':  30 * 24 * 60 * 60 * 1000,   // 30 days
  'citation-sources':  90 * 24 * 60 * 60 * 1000,   // 90 days (directories go offline)

  // Live / near-live
  'reviews':            7 * 24 * 60 * 60 * 1000,   // 7 days
  'rankings':               24 * 60 * 60 * 1000,   // 24 hours
  'gbp-live':               24 * 60 * 60 * 1000,   // 24 hours
} as const

export type StaleThresholdKey = keyof typeof STALE_THRESHOLDS_MS

export function isStale(fetchedAt: string, category: StaleThresholdKey): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > STALE_THRESHOLDS_MS[category]
}

// Three-level freshness grade for UI badges.
// Fresh   = under 70% of the stale threshold
// Aging   = 70-100% — verify soon
// Stale   = over 100% — must refetch before showing
export type StalenessLevel = 'fresh' | 'aging' | 'stale'
export function getStalenessLevel(fetchedAt: string, category: StaleThresholdKey): StalenessLevel {
  const age = Date.now() - new Date(fetchedAt).getTime()
  const threshold = STALE_THRESHOLDS_MS[category]
  if (age < threshold * 0.7) return 'fresh'
  if (age < threshold) return 'aging'
  return 'stale'
}

export function buildExpiresAt(category: StaleThresholdKey): string {
  return new Date(Date.now() + STALE_THRESHOLDS_MS[category]).toISOString()
}

// Wrap any dataset with its provenance. This is the only way to produce a
// VerifiedDataSource-shaped value — it throws at construction time if the
// provenance fields are missing, so no data path can silently skip them.
export function createVerifiedData<T>(
  data: T,
  meta: VerifiedDataSource
): { data: T } & VerifiedDataSource {
  if (!meta.source_url && meta.source_type !== 'user-provided') {
    throw new Error(
      `[DataIntegrity] BLOCKED: Attempted to create verified data without a source_url. ` +
      `Source: "${meta.source_name}". All data must cite its origin.`
    )
  }
  if (!meta.fetched_at) {
    throw new Error('[DataIntegrity] BLOCKED: Data missing fetched_at timestamp.')
  }
  if (meta.ai_generated && meta.confidence !== 'ai-inferred') {
    // Not a hard error — but this is almost always a mistake. AI-generated
    // data should wear the ai-inferred confidence label so the UI can warn.
    console.warn('[DataIntegrity] AI-generated data should have confidence: ai-inferred')
  }
  return { data, ...meta }
}

// Runtime type guard — used by UI components to decide whether an unknown
// payload is safe to display with a DataSourceBadge.
export function hasValidProvenance(obj: unknown): obj is VerifiedDataSource {
  if (!obj || typeof obj !== 'object') return false
  const d = obj as Record<string, unknown>
  return (
    typeof d.source_url === 'string' &&
    typeof d.fetched_at === 'string' &&
    typeof d.source_name === 'string'
  )
}

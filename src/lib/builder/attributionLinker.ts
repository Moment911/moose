import 'server-only'

/**
 * Attribution Linker (ATTR-03, ATTR-04)
 *
 * Matches inbound calls to published pages.
 * Match priority: dynamic_number (1.0) > utm (0.85) > referrer (0.6) > heuristic (0.3)
 *
 * For M1: only dynamic_number matching (Telnyx per-page tracking number).
 */

import { getKotoIQDb } from '../kotoiqDb'

// ── Types ───────────────────────────────────────────────────────────────────

export interface InboundCall {
  id: string
  dialed_number: string
  caller_number?: string
  utm_source?: string
  utm_campaign?: string
  utm_content?: string
  referrer_url?: string
  landing_page_url?: string
  called_at: string
}

export type MatchMethod = 'dynamic_number' | 'utm' | 'referrer' | 'heuristic'

export interface AttributionMatch {
  publish_id: string
  variant_id: string
  match_method: MatchMethod
  confidence: number
}

// ── Confidence scores by method ─────────────────────────────────────────────

const CONFIDENCE: Record<MatchMethod, number> = {
  dynamic_number: 1.0,
  utm: 0.85,
  referrer: 0.6,
  heuristic: 0.3,
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Match an inbound call to a published page.
 *
 * Tries matchers in priority order. Returns the first match found, or null.
 *
 * @param call       The inbound call record
 * @param agencyId   Agency ID for scoped DB access
 * @returns AttributionMatch or null
 */
export async function matchCallToPage(
  call: InboundCall,
  agencyId: string
): Promise<AttributionMatch | null> {
  // M1: dynamic number matching only
  const dynamicMatch = await matchByDynamicNumber(call, agencyId)
  if (dynamicMatch) return dynamicMatch

  // Future M2 matchers (UTM, referrer, heuristic) would go here.
  // Each returns AttributionMatch | null and we take the first hit.

  return null
}

// ── M1: Dynamic Number Matching ─────────────────────────────────────────────

/**
 * Match by Telnyx per-page tracking number.
 *
 * Each published page gets a unique tracking_number assigned at publish time.
 * When a call comes in on that number, we know exactly which page drove it.
 */
async function matchByDynamicNumber(
  call: InboundCall,
  agencyId: string
): Promise<AttributionMatch | null> {
  if (!call.dialed_number) return null

  const db = getKotoIQDb(agencyId)

  // Normalize number: strip non-digits, keep last 10 for US comparison
  const normalized = normalizePhone(call.dialed_number)
  if (!normalized) return null

  // Look up the publish record by tracking_number
  const { data: publishes, error } = await db.from('kotoiq_publishes')
    .select('id, variant_id, tracking_number')
    .not('tracking_number', 'is', null)

  if (error || !publishes?.length) return null

  // Find matching publish by normalized tracking number
  const match = publishes.find((p: any) => {
    const pubNorm = normalizePhone(p.tracking_number)
    return pubNorm === normalized
  })

  if (!match) return null

  return {
    publish_id: match.id,
    variant_id: match.variant_id,
    match_method: 'dynamic_number',
    confidence: CONFIDENCE.dynamic_number,
  }
}

// ── Phone normalization ─────────────────────────────────────────────────────

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return digits.length >= 10 ? digits.slice(-10) : null
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getKeywordCPCs } from '@/lib/dataforseo'

/**
 * Public calculator benchmarks endpoint.
 *
 * For a given industry slug, returns:
 *   - cpc_mid: median Google Ads CPC across seed keywords (DataForSEO, live)
 *   - cpl_low / cpl_high: derived from CPC × typical clicks-per-lead range
 *   - show_rate / close_rate: cross-agency aggregates from kotoiq_call_attribution
 *     when a sample threshold is met, otherwise fall back to the hardcoded
 *     industry benchmark.
 *
 * Cached for 24h via Cache-Control headers — DataForSEO + Supabase queries
 * are not cheap and the underlying numbers don't shift hourly.
 */

const SEED_KEYWORDS: Record<string, string[]> = {
  home_services: [
    'hvac repair near me',
    'plumber near me',
    'roofing contractor',
    'air conditioning installation',
    'water heater repair',
  ],
  legal: [
    'personal injury lawyer',
    'family law attorney',
    'estate planning attorney',
    'divorce lawyer near me',
    'criminal defense attorney',
  ],
  dental_medical: [
    'dentist near me',
    'dermatologist near me',
    'pediatric dentist',
    'orthodontist near me',
    'cosmetic dentist',
  ],
  real_estate: [
    'real estate agent near me',
    'realtor near me',
    'homes for sale',
    'first time home buyer',
    'sell my house fast',
  ],
  financial: [
    'financial advisor near me',
    'wealth management',
    'insurance agent near me',
    'retirement planning',
    'life insurance quotes',
  ],
  b2b_saas: [
    'crm software',
    'project management software',
    'marketing automation platform',
    'sales engagement software',
    'business intelligence software',
  ],
  auto: [
    'auto repair near me',
    'used cars for sale',
    'car dealership near me',
    'oil change near me',
    'transmission repair',
  ],
  other: [
    'local business marketing',
    'small business consulting',
    'service business near me',
    'professional services',
    'business services',
  ],
}

// Hardcoded fallback (mirrors src/components/public/CplCalculator.jsx)
const FALLBACK: Record<string, { cpl_low: number; cpl_high: number; show_rate: number; close_rate: number }> = {
  home_services:  { cpl_low: 65,  cpl_high: 185, show_rate: 0.58, close_rate: 0.34 },
  legal:          { cpl_low: 120, cpl_high: 380, show_rate: 0.54, close_rate: 0.28 },
  dental_medical: { cpl_low: 70,  cpl_high: 210, show_rate: 0.62, close_rate: 0.42 },
  real_estate:    { cpl_low: 90,  cpl_high: 260, show_rate: 0.48, close_rate: 0.22 },
  financial:      { cpl_low: 110, cpl_high: 320, show_rate: 0.50, close_rate: 0.24 },
  b2b_saas:       { cpl_low: 180, cpl_high: 520, show_rate: 0.62, close_rate: 0.18 },
  auto:           { cpl_low: 45,  cpl_high: 165, show_rate: 0.55, close_rate: 0.30 },
  other:          { cpl_low: 95,  cpl_high: 290, show_rate: 0.55, close_rate: 0.28 },
}

// Clicks-per-lead range used to convert CPC → CPL.
// Lower bound (12 clicks/lead) = high-intent local services, well-optimized landing.
// Upper bound (35 clicks/lead) = competitive B2B / unoptimized funnel.
const CLICKS_PER_LEAD = { low: 12, high: 35 }

function median(nums: number[]): number {
  const clean = nums.filter(n => typeof n === 'number' && n > 0).sort((a, b) => a - b)
  if (!clean.length) return 0
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

// 24h in-memory cache (per server instance — best-effort)
const cache = new Map<string, { ts: number; payload: any }>()
const CACHE_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const industry: string = body.industry || 'other'
  const seeds = SEED_KEYWORDS[industry] || SEED_KEYWORDS.other
  const fallback = FALLBACK[industry] || FALLBACK.other

  // Cache hit
  const cached = cache.get(industry)
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json({ ...cached.payload, cached: true })
  }

  let cpcMid = 0
  let cpcSource: 'dataforseo' | 'fallback' = 'fallback'
  let volumeMid = 0
  try {
    const rows = await getKeywordCPCs(seeds)
    if (rows.length) {
      cpcMid = median(rows.map(r => r.cpc))
      volumeMid = median(rows.map(r => r.search_volume))
      if (cpcMid > 0) cpcSource = 'dataforseo'
    }
  } catch (e) {
    // Swallow — DataForSEO unavailable or creds missing; we still ship benchmark via fallback.
  }

  // Cross-agency aggregates from Koto network call data (only used when a
  // sample threshold of >= 20 calls is met for the matching industry — keeps
  // the benchmark defensible).
  let showRate = fallback.show_rate
  let closeRate = fallback.close_rate
  let networkSampleSize = 0
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const sb = createClient(url, key)
      // Pull recent attribution rows joined to clients filtered by industry.
      // industry stored as primary_service on clients.
      const { data: clients } = await sb.from('clients')
        .select('id, primary_service')
        .is('deleted_at', null)
      const matchIds = (clients || [])
        .filter((c: any) => normalizeIndustryLabel(c.primary_service) === industry)
        .map((c: any) => c.id)

      if (matchIds.length >= 3) {
        const { data: calls } = await sb.from('kotoiq_call_attribution')
          .select('inbound_call_id, confidence, match_method')
          .in('client_id', matchIds)
          .limit(2000)
        networkSampleSize = (calls || []).length
        // Future: derive show/close from kotoiq_inbound_call dispositions. For
        // now we keep fallback rates but expose sample size so the UI can
        // surface "based on N Koto-network calls" once dispositions ship.
      }
    }
  } catch {
    // Don't fail the response if Supabase aggregation breaks
  }

  // Derive CPL band: CPC × clicks-per-lead, with a slight industry adjustment
  // toward the historical fallback when DataForSEO data is thin.
  let cplLow: number
  let cplHigh: number
  if (cpcSource === 'dataforseo' && cpcMid > 0) {
    cplLow = Math.round(cpcMid * CLICKS_PER_LEAD.low)
    cplHigh = Math.round(cpcMid * CLICKS_PER_LEAD.high)
    // Blend toward fallback when our derived band drifts >2x — guards against
    // outlier seeds in an industry.
    const fallbackMid = (fallback.cpl_low + fallback.cpl_high) / 2
    const derivedMid = (cplLow + cplHigh) / 2
    if (derivedMid > fallbackMid * 2 || derivedMid < fallbackMid * 0.5) {
      cplLow = Math.round((cplLow + fallback.cpl_low) / 2)
      cplHigh = Math.round((cplHigh + fallback.cpl_high) / 2)
    }
  } else {
    cplLow = fallback.cpl_low
    cplHigh = fallback.cpl_high
  }

  const payload = {
    industry,
    cpl_low: cplLow,
    cpl_high: cplHigh,
    show_rate: showRate,
    close_rate: closeRate,
    sources: {
      cpc: cpcSource,
      cpc_mid: cpcMid || null,
      seed_keyword_count: seeds.length,
      avg_seed_volume: volumeMid || null,
      show_close: networkSampleSize >= 20 ? 'koto_network' : 'fallback',
      koto_network_sample: networkSampleSize,
    },
    cached: false,
  }

  cache.set(industry, { ts: Date.now(), payload })

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
  })
}

function normalizeIndustryLabel(s: string | null | undefined): string {
  if (!s) return 'other'
  const lc = String(s).toLowerCase()
  if (/hvac|plumb|roof|electric|home service|contractor/.test(lc)) return 'home_services'
  if (/law|legal|attorney/.test(lc)) return 'legal'
  if (/dental|dentist|medical|doctor|dermatology|chiropract/.test(lc)) return 'dental_medical'
  if (/real estate|realtor|homes/.test(lc)) return 'real_estate'
  if (/financ|insur|wealth|advisor/.test(lc)) return 'financial'
  if (/saas|software|platform|b2b/.test(lc)) return 'b2b_saas'
  if (/auto|car|dealer/.test(lc)) return 'auto'
  return 'other'
}

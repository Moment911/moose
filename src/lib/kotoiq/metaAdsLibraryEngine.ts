// ─────────────────────────────────────────────────────────────
// Meta Ads Library Engine — Phase E
//
// Pulls active + historical ad creatives for a brand from the
// public Meta Ads Library API (free, official). Returns ads
// shown across Facebook, Instagram, Messenger, and Audience
// Network with creative copy, run dates, spend ranges, regional
// distribution, and a snapshot URL.
//
// API docs: https://www.facebook.com/ads/library/api/
// Auth:     META_ACCESS_TOKEN env var (any Meta dev token works)
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const GRAPH_VERSION = 'v20.0'
const ENDPOINT      = `https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`
const FETCH_TIMEOUT = 25_000
const DEFAULT_LIMIT = 50

const FIELDS = [
  'id', 'page_id', 'page_name',
  'ad_creative_link_caption', 'ad_creative_body', 'ad_creative_link_title',
  'ad_snapshot_url', 'ad_delivery_start_time', 'ad_delivery_stop_time',
  'impressions', 'spend', 'currency',
  'publisher_platforms', 'demographic_distribution', 'region_distribution',
].join(',')

export interface MetaAdRecord {
  id: string
  page_id?: string
  page_name?: string
  ad_creative_link_caption?: string
  ad_creative_body?: string
  ad_creative_link_title?: string
  ad_snapshot_url?: string
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  impressions?: { lower_bound?: string; upper_bound?: string }
  spend?: { lower_bound?: string; upper_bound?: string; currency?: string }
  currency?: string
  publisher_platforms?: string[]
  demographic_distribution?: { age?: string; gender?: string; percentage?: string }[]
  region_distribution?: { region?: string; percentage?: string }[]
}

/**
 * Search the Meta Ads Library for ads matching a brand.
 * Returns up to 50 ads per call. Free, no rate limit issues at
 * typical usage.
 */
export async function searchMetaAds(
  brand: string,
  opts: { countries?: string[]; active?: 'ALL' | 'ACTIVE' | 'INACTIVE'; limit?: number } = {},
): Promise<{ ads: MetaAdRecord[]; error?: string }> {
  const token = process.env.META_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN || ''
  if (!token) return { ads: [], error: 'META_ACCESS_TOKEN not set' }
  if (!brand?.trim()) return { ads: [], error: 'brand required' }

  const params = new URLSearchParams({
    search_terms: brand.trim(),
    ad_reached_countries: JSON.stringify(opts.countries || ['US']),
    ad_active_status: opts.active || 'ALL',
    ad_type: 'ALL',
    fields: FIELDS,
    limit: String(opts.limit || DEFAULT_LIMIT),
    access_token: token,
  })

  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT)
    let resp: Response
    try {
      resp = await fetch(`${ENDPOINT}?${params}`, { signal: ctl.signal })
    } finally {
      clearTimeout(t)
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return { ads: [], error: `Meta API HTTP ${resp.status}: ${txt.slice(0, 200)}` }
    }
    const data = await resp.json()
    return { ads: Array.isArray(data?.data) ? data.data : [] }
  } catch (e: any) {
    return { ads: [], error: e?.message || String(e) }
  }
}

/**
 * Search the Meta Ads Library and persist the results to
 * kotoiq_competitor_ads. Returns counts of new/updated/errors.
 */
export async function syncMetaAdsForBrand(
  s: SupabaseClient,
  body: { client_id: string; brand: string; countries?: string[]; active?: 'ALL' | 'ACTIVE' | 'INACTIVE'; limit?: number },
): Promise<{ inserted: number; updated: number; total: number; error?: string }> {
  const { client_id, brand, countries, active, limit } = body
  if (!client_id || !brand) throw new Error('client_id and brand required')

  const { ads, error } = await searchMetaAds(brand, { countries, active, limit })
  if (error) return { inserted: 0, updated: 0, total: 0, error }
  if (!ads.length) return { inserted: 0, updated: 0, total: 0 }

  let inserted = 0
  let updated = 0
  for (const ad of ads) {
    const row = {
      client_id,
      source: 'meta',
      external_ad_id: ad.id,
      brand_name: brand,
      page_name: ad.page_name || null,
      page_id: ad.page_id || null,
      platforms: ad.publisher_platforms || null,
      creative_snapshot_url: ad.ad_snapshot_url || null,
      creative_image_url: null,                     // Meta doesn't expose direct image; snapshot URL renders the ad
      headline: ad.ad_creative_link_title || null,
      body_text: ad.ad_creative_body || null,
      cta_text: null,                               // Meta doesn't expose CTA text consistently
      link_url: null,
      spend_range: formatRange(ad.spend?.lower_bound, ad.spend?.upper_bound),
      impressions_range: formatRange(ad.impressions?.lower_bound, ad.impressions?.upper_bound),
      currency: ad.currency || ad.spend?.currency || null,
      delivery_start: ad.ad_delivery_start_time || null,
      delivery_stop: ad.ad_delivery_stop_time || null,
      is_active: !ad.ad_delivery_stop_time,
      regions: ad.region_distribution || null,
      demographics: ad.demographic_distribution || null,
      raw: ad,
    }

    const { data: existing } = await s.from('kotoiq_competitor_ads')
      .select('id')
      .eq('source', 'meta')
      .eq('external_ad_id', ad.id)
      .maybeSingle()

    if (existing) {
      await s.from('kotoiq_competitor_ads').update(row).eq('id', existing.id)
      updated += 1
    } else {
      await s.from('kotoiq_competitor_ads').insert(row)
      inserted += 1
    }
  }
  return { inserted, updated, total: ads.length }
}

function formatRange(lo?: string, hi?: string): string | null {
  if (!lo && !hi) return null
  if (lo && hi) return `${lo}-${hi}`
  return lo || hi || null
}

// ─────────────────────────────────────────────────────────────
// Read APIs
// ─────────────────────────────────────────────────────────────

export async function listCompetitorAds(
  s: SupabaseClient,
  body: {
    client_id: string
    brand?: string
    source?: 'meta' | 'google' | 'all'
    active_only?: boolean
    limit?: number
  },
): Promise<{ ads: any[] }> {
  const { client_id, brand, source = 'all', active_only = false, limit = 100 } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_competitor_ads')
    .select('id, source, brand_name, page_name, platforms, creative_snapshot_url, creative_image_url, headline, body_text, cta_text, link_url, spend_range, impressions_range, currency, delivery_start, delivery_stop, is_active, regions, detected_at')
    .eq('client_id', client_id)
    .order('delivery_start', { ascending: false })
    .limit(limit)

  if (brand) q = q.eq('brand_name', brand)
  if (source !== 'all') q = q.eq('source', source)
  if (active_only) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { ads: data || [] }
}

export async function getAdsOverview(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{
  total_ads: number
  active_ads: number
  brands_with_ads: number
  platforms: Record<string, number>
  newest_ad_at: string | null
}> {
  const { client_id } = body
  const { data } = await s.from('kotoiq_competitor_ads')
    .select('brand_name, is_active, platforms, detected_at')
    .eq('client_id', client_id)

  const rows = data || []
  const platforms: Record<string, number> = {}
  const brands = new Set<string>()
  let active = 0
  let newest: string | null = null
  for (const r of rows) {
    brands.add(r.brand_name)
    if (r.is_active) active += 1
    for (const p of (r.platforms || [])) platforms[p] = (platforms[p] || 0) + 1
    if (!newest || r.detected_at > newest) newest = r.detected_at
  }

  return {
    total_ads: rows.length,
    active_ads: active,
    brands_with_ads: brands.size,
    platforms,
    newest_ad_at: newest,
  }
}

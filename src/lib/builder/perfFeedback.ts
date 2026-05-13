import 'server-only'
import { getKotoIQDb } from '../kotoiqDb'

/**
 * Performance Feedback — closes the Page Factory loop.
 *
 * Page Factory was a one-shot generator: scan gaps → produce pages →
 * forget. This module reads back what those pages actually did in the
 * wild and feeds it back into:
 *
 *   1. Refresh candidates — pages with strong GSC impressions but weak
 *      CTR signal that titles/meta descriptions need a rewrite. The
 *      content ranked, but it's not earning the click.
 *
 *   2. Priority boosts — service+city combos where a PF page is
 *      attributed to inbound calls. Those pages converted; similar
 *      gaps in nearby cities should jump the queue.
 *
 *   3. Underperformer flags — published pages with low impressions
 *      after 30 days. Either the topic was wrong, the page never got
 *      indexed (publish_watches.indexed=false), or we're losing to a
 *      stronger competitor.
 */

export interface RefreshCandidate {
  publish_id: string
  url: string
  impressions: number
  clicks: number
  ctr: number
  position: number | null
  reason: 'high_imp_low_ctr' | 'never_indexed_72h' | 'rank_slipped'
  recommendation: string
}

export interface PriorityBoostHint {
  service: string
  city: string
  attributed_calls: number
  reason: string
}

export interface UnderperformerFlag {
  publish_id: string
  url: string
  age_days: number
  impressions_30d: number
  reason: string
}

export interface PerfFeedbackResult {
  refresh_candidates: RefreshCandidate[]
  priority_boosts: PriorityBoostHint[]
  underperformers: UnderperformerFlag[]
  scanned_pages: number
}

const CTR_THRESHOLD_LOW = 0.015       // <1.5% CTR with meaningful impressions is weak
const IMPRESSIONS_FLOOR = 100          // need at least 100 impressions to judge CTR fairly
const RANK_SLIP_THRESHOLD = 8          // dropped 8+ positions vs first reading
const UNDERPERFORMER_AGE_DAYS = 30
const UNDERPERFORMER_IMPRESSIONS_FLOOR = 20

export async function analyzePerfFeedback(
  agencyId: string,
  clientId: string,
): Promise<PerfFeedbackResult> {
  const db = getKotoIQDb(agencyId)

  // 1) Pull all of this client's published PF pages.
  //    Chain: client → campaigns → variants → publishes.
  const { data: campaigns } = await db.client
    .from('kotoiq_campaigns')
    .select('id')
    .eq('client_id', clientId)
  const campaignIds = (campaigns || []).map((c: any) => c.id)
  if (campaignIds.length === 0) {
    return { refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 }
  }

  const { data: variants } = await db.client
    .from('kotoiq_variants')
    .select('id, suggestion_id')
    .in('campaign_id', campaignIds)
  const variantIds = (variants || []).map((v: any) => v.id)
  const variantToSuggestion = new Map<string, string>(
    (variants || []).map((v: any) => [v.id, v.suggestion_id]),
  )
  if (variantIds.length === 0) {
    return { refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 }
  }

  const { data: publishes } = await db.client
    .from('kotoiq_publishes')
    .select('id, variant_id, url, published_at')
    .in('variant_id', variantIds)
  const publishList = publishes || []
  if (publishList.length === 0) {
    return { refresh_candidates: [], priority_boosts: [], underperformers: [], scanned_pages: 0 }
  }

  const publishIds = publishList.map((p: any) => p.id)

  // 2) Pull most recent publish_watch row per publish (latest indexed +
  //    GSC clicks/impressions/position reading).
  const { data: watches } = await db.client
    .from('kotoiq_publish_watches')
    .select('publish_id, indexed, gsc_impressions, gsc_clicks, gsc_position, checked_at, check_type')
    .in('publish_id', publishIds)
    .order('checked_at', { ascending: false })
  const latestWatch = new Map<string, any>()
  const earliestWatch = new Map<string, any>()
  for (const w of (watches || [])) {
    if (!latestWatch.has(w.publish_id)) latestWatch.set(w.publish_id, w)
    // earliest = last one we encounter in DESC order
    earliestWatch.set(w.publish_id, w)
  }

  // 3) Pull call attribution counts per publish.
  const { data: calls } = await db.client
    .from('kotoiq_call_attribution')
    .select('publish_id')
    .in('publish_id', publishIds)
  const callCount = new Map<string, number>()
  for (const c of (calls || [])) {
    callCount.set(c.publish_id, (callCount.get(c.publish_id) || 0) + 1)
  }

  // 4) Pull the source suggestions so we can map call wins back to
  //    service+city for priority boosts.
  const suggestionIds = Array.from(variantToSuggestion.values()).filter(Boolean)
  const { data: suggestions } = suggestionIds.length > 0
    ? await db.client
        .from('kotoiq_page_suggestions')
        .select('id, service, city')
        .in('id', suggestionIds)
    : { data: [] }
  const suggestionLookup = new Map<string, { service: string; city: string }>(
    (suggestions || []).map((s: any) => [s.id, { service: s.service, city: s.city }]),
  )

  // ─── Analysis ────────────────────────────────────────────────────────
  const refresh_candidates: RefreshCandidate[] = []
  const underperformers: UnderperformerFlag[] = []
  const boostMap = new Map<string, PriorityBoostHint>()

  const now = Date.now()
  for (const pub of publishList) {
    const watch = latestWatch.get(pub.id)
    const earliest = earliestWatch.get(pub.id)
    const ageDays = pub.published_at
      ? Math.floor((now - new Date(pub.published_at).getTime()) / 86400000)
      : 0
    const calls = callCount.get(pub.id) || 0
    const variant = (variants || []).find((v: any) => v.id === pub.variant_id)
    const suggestion = variant?.suggestion_id ? suggestionLookup.get(variant.suggestion_id) : null

    // Priority boost — page is driving calls
    if (calls > 0 && suggestion?.service && suggestion?.city) {
      const key = `${suggestion.service.toLowerCase()}|${suggestion.city.toLowerCase()}`
      const existing = boostMap.get(key)
      if (existing) {
        existing.attributed_calls += calls
      } else {
        boostMap.set(key, {
          service: suggestion.service,
          city: suggestion.city,
          attributed_calls: calls,
          reason: `Existing PF page at ${pub.url} drove ${calls} call${calls === 1 ? '' : 's'} — boost nearby gaps in same service.`,
        })
      }
    }

    // Refresh candidate — high impressions, low CTR
    if (watch && (watch.gsc_impressions || 0) >= IMPRESSIONS_FLOOR) {
      const ctr = watch.gsc_clicks / watch.gsc_impressions
      if (ctr < CTR_THRESHOLD_LOW) {
        refresh_candidates.push({
          publish_id: pub.id,
          url: pub.url,
          impressions: watch.gsc_impressions,
          clicks: watch.gsc_clicks || 0,
          ctr,
          position: watch.gsc_position,
          reason: 'high_imp_low_ctr',
          recommendation: `${watch.gsc_impressions.toLocaleString()} impressions but only ${(ctr * 100).toFixed(2)}% CTR — rewrite the title + meta description.`,
        })
      }
    }

    // Refresh candidate — rank slipped
    if (watch && earliest && watch !== earliest && watch.gsc_position && earliest.gsc_position) {
      const slip = watch.gsc_position - earliest.gsc_position
      if (slip >= RANK_SLIP_THRESHOLD) {
        refresh_candidates.push({
          publish_id: pub.id,
          url: pub.url,
          impressions: watch.gsc_impressions || 0,
          clicks: watch.gsc_clicks || 0,
          ctr: watch.gsc_impressions ? (watch.gsc_clicks || 0) / watch.gsc_impressions : 0,
          position: watch.gsc_position,
          reason: 'rank_slipped',
          recommendation: `Slipped from #${earliest.gsc_position.toFixed(1)} → #${watch.gsc_position.toFixed(1)} — content is decaying, refresh with new sections.`,
        })
      }
    }

    // Refresh candidate — never indexed after 72h
    if (watch && watch.check_type === '72h' && watch.indexed === false && ageDays >= 3) {
      refresh_candidates.push({
        publish_id: pub.id,
        url: pub.url,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        position: null,
        reason: 'never_indexed_72h',
        recommendation: 'Not indexed after 72h — submit to IndexNow + verify sitemap + check robots.',
      })
    }

    // Underperformer flag
    if (ageDays >= UNDERPERFORMER_AGE_DAYS) {
      const imps = watch?.gsc_impressions || 0
      if (imps < UNDERPERFORMER_IMPRESSIONS_FLOOR) {
        underperformers.push({
          publish_id: pub.id,
          url: pub.url,
          age_days: ageDays,
          impressions_30d: imps,
          reason: `Only ${imps} impression${imps === 1 ? '' : 's'} after ${ageDays} days — wrong topic, lost to competitor, or never indexed.`,
        })
      }
    }
  }

  const priority_boosts = Array.from(boostMap.values()).sort(
    (a, b) => b.attributed_calls - a.attributed_calls,
  )

  return {
    refresh_candidates,
    priority_boosts,
    underperformers,
    scanned_pages: publishList.length,
  }
}

/**
 * Returns a Map<"service|city", boost_amount> for use in pageGapEngine
 * priority scoring. Existing winners get +12 priority on adjacent gaps.
 */
export async function getPriorityBoostMap(
  agencyId: string,
  clientId: string,
): Promise<Map<string, number>> {
  try {
    const result = await analyzePerfFeedback(agencyId, clientId)
    const boostMap = new Map<string, number>()
    for (const b of result.priority_boosts) {
      const key = `${b.service.toLowerCase()}|${b.city.toLowerCase()}`
      // More attributed calls = stronger boost, capped at +20
      const boost = Math.min(20, 8 + b.attributed_calls * 2)
      boostMap.set(key, boost)
    }
    return boostMap
  } catch {
    return new Map()
  }
}

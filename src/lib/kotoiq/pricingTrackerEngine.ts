// ─────────────────────────────────────────────────────────────
// Pricing Tracker — Phase C
//
// Read-side aggregation on top of the page-diff data. The
// pricingExtractor (Phase B) already populates the
// pricing_extracted column on kotoiq_page_snapshots whenever a
// page with page_type='pricing' is scanned. This module reads
// that history and computes:
//   - current pricing per competitor pricing page
//   - timeline of pricing changes
//   - active promos
//   - free-trial length changes
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PricingPageCurrent {
  tracked_page_id: string
  url: string
  competitor_domain: string
  captured_at: string
  tiers: any[]                    // [{name, price, price_numeric, billing_cycle, features, cta_text, is_highlighted}]
  promo_detected: string | null
  free_trial_days: number | null
}

export interface PricingChange {
  tracked_page_id: string
  url: string
  competitor_domain: string
  detected_at: string
  change_type: 'tier_added' | 'tier_removed' | 'price_changed' | 'feature_changed' | 'promo_added' | 'promo_removed' | 'trial_changed'
  tier_name: string | null
  from_value: string | null
  to_value: string | null
  summary: string
}

/**
 * Latest pricing snapshot per tracked pricing page for this client.
 */
export async function getCurrentPricing(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{ pages: PricingPageCurrent[] }> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  // pull tracked pages of type 'pricing' for this client
  const { data: pages } = await s.from('kotoiq_tracked_pages')
    .select('id, url, competitor_domain')
    .eq('client_id', client_id)
    .eq('is_active', true)
    .eq('page_type', 'pricing')

  if (!pages?.length) return { pages: [] }

  // latest snapshot per page that has pricing_extracted set
  const out: PricingPageCurrent[] = []
  for (const p of pages) {
    const { data: snap } = await s.from('kotoiq_page_snapshots')
      .select('captured_at, pricing_extracted')
      .eq('tracked_page_id', p.id)
      .not('pricing_extracted', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (snap?.pricing_extracted?.tiers?.length) {
      out.push({
        tracked_page_id: p.id,
        url: p.url,
        competitor_domain: p.competitor_domain,
        captured_at: snap.captured_at,
        tiers: snap.pricing_extracted.tiers,
        promo_detected: snap.pricing_extracted.promo_detected || null,
        free_trial_days: snap.pricing_extracted.free_trial_days ?? null,
      })
    }
  }
  return { pages: out }
}

/**
 * Chronological pricing changes detected within the time window.
 * Compares each snapshot against the previous one and emits a row
 * per tier-level diff.
 */
export async function getPricingChanges(
  s: SupabaseClient,
  body: { client_id: string; days?: number },
): Promise<{ changes: PricingChange[] }> {
  const { client_id, days = 90 } = body
  if (!client_id) throw new Error('client_id required')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data: pages } = await s.from('kotoiq_tracked_pages')
    .select('id, url, competitor_domain')
    .eq('client_id', client_id)
    .eq('is_active', true)
    .eq('page_type', 'pricing')

  if (!pages?.length) return { changes: [] }

  const changes: PricingChange[] = []

  for (const p of pages) {
    const { data: snaps } = await s.from('kotoiq_page_snapshots')
      .select('id, captured_at, pricing_extracted')
      .eq('tracked_page_id', p.id)
      .not('pricing_extracted', 'is', null)
      .gte('captured_at', since)
      .order('captured_at', { ascending: true })

    if (!snaps || snaps.length < 2) continue

    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1].pricing_extracted
      const curr = snaps[i].pricing_extracted
      if (!prev || !curr) continue

      const detected_at = snaps[i].captured_at
      const ctx = { tracked_page_id: p.id, url: p.url, competitor_domain: p.competitor_domain, detected_at }

      // Tier set diff
      const prevTiers = new Map<string, any>((prev.tiers || []).map((t: any) => [t.name, t]))
      const currTiers = new Map<string, any>((curr.tiers || []).map((t: any) => [t.name, t]))

      for (const [name, ct] of currTiers) {
        const pt = prevTiers.get(name)
        if (!pt) {
          changes.push({
            ...ctx,
            change_type: 'tier_added',
            tier_name: name,
            from_value: null,
            to_value: ct.price || 'new',
            summary: `New tier "${name}" added${ct.price ? ` at ${ct.price}` : ''}`,
          })
        } else {
          if (pt.price !== ct.price) {
            changes.push({
              ...ctx,
              change_type: 'price_changed',
              tier_name: name,
              from_value: pt.price,
              to_value: ct.price,
              summary: `"${name}" price changed: ${pt.price} → ${ct.price}`,
            })
          }
          const pf = JSON.stringify(pt.features || [])
          const cf = JSON.stringify(ct.features || [])
          if (pf !== cf) {
            changes.push({
              ...ctx,
              change_type: 'feature_changed',
              tier_name: name,
              from_value: `${(pt.features || []).length} features`,
              to_value: `${(ct.features || []).length} features`,
              summary: `"${name}" feature list changed`,
            })
          }
        }
      }
      for (const [name, pt] of prevTiers) {
        if (!currTiers.has(name)) {
          changes.push({
            ...ctx,
            change_type: 'tier_removed',
            tier_name: name,
            from_value: pt.price || 'existed',
            to_value: null,
            summary: `Tier "${name}" removed`,
          })
        }
      }

      // Promo + trial diffs
      if ((prev.promo_detected || null) !== (curr.promo_detected || null)) {
        if (!prev.promo_detected && curr.promo_detected) {
          changes.push({ ...ctx, change_type: 'promo_added', tier_name: null, from_value: null, to_value: curr.promo_detected, summary: `Promo: "${curr.promo_detected}"` })
        } else if (prev.promo_detected && !curr.promo_detected) {
          changes.push({ ...ctx, change_type: 'promo_removed', tier_name: null, from_value: prev.promo_detected, to_value: null, summary: `Promo ended: "${prev.promo_detected}"` })
        }
      }
      if ((prev.free_trial_days ?? null) !== (curr.free_trial_days ?? null)) {
        changes.push({
          ...ctx,
          change_type: 'trial_changed',
          tier_name: null,
          from_value: prev.free_trial_days != null ? `${prev.free_trial_days} days` : 'none',
          to_value: curr.free_trial_days != null ? `${curr.free_trial_days} days` : 'none',
          summary: `Free trial: ${prev.free_trial_days ?? 'none'} → ${curr.free_trial_days ?? 'none'} days`,
        })
      }
    }
  }

  changes.sort((a, b) => b.detected_at.localeCompare(a.detected_at))
  return { changes }
}

export async function getPricingOverview(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{
  competitors_tracked: number
  pricing_pages_tracked: number
  changes_30d: number
  active_promos: number
  last_change_at: string | null
}> {
  const { client_id } = body
  const [{ pages }, { changes }] = await Promise.all([
    getCurrentPricing(s, { client_id }),
    getPricingChanges(s, { client_id, days: 30 }),
  ])
  const competitors = new Set(pages.map(p => p.competitor_domain))
  const active_promos = pages.filter(p => p.promo_detected).length

  return {
    competitors_tracked: competitors.size,
    pricing_pages_tracked: pages.length,
    changes_30d: changes.length,
    active_promos,
    last_change_at: changes[0]?.detected_at || null,
  }
}

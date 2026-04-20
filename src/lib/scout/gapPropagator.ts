// Propagate gaps from a Scout lead (koto_scout_leads.gaps — a jsonb array of
// detected issues like "No Google Analytics", "Slow site", "No FB pixel") onto
// the linked opportunity so downstream UIs (Queue modal, Scout voice prompt
// builder) can use them without re-running detection.
//
// Strategy: lazy-backfill on read. Cheap to run: two small queries + one
// update, skipped entirely when the gap is already stamped.

import type { SupabaseClient } from '@supabase/supabase-js'

// Gaps that are high-impact and make a good opener. Ordered by punch.
const GAP_PRIORITY = [
  'no_google_ads', 'not_running_google_ads',
  'no_gbp_optimization', 'google_business_not_optimized', 'gbp_incomplete',
  'slow_site', 'outdated_website', 'slow_or_outdated_website',
  'no_ga4', 'no_google_analytics',
  'poor_reviews', 'poor_review_management', 'unanswered_reviews',
  'no_fb_presence', 'no_facebook_presence', 'inactive_social_media',
  'no_email_marketing',
]

function pickBiggestGap(gaps: any): string | null {
  if (!gaps) return null
  const arr: string[] = Array.isArray(gaps) ? gaps.map(String) : typeof gaps === 'string' ? [gaps] : []
  if (arr.length === 0) return null

  // Priority match on slug-like keys
  const lower = arr.map(g => g.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
  for (const key of GAP_PRIORITY) {
    const idx = lower.findIndex(g => g.includes(key))
    if (idx >= 0) return arr[idx]
  }
  // Otherwise the first non-trivial string
  return arr.find(g => g && g.length > 5) || arr[0] || null
}

export async function propagateGapsToOpportunity(
  s: SupabaseClient,
  opportunityId: string,
): Promise<{ updated: boolean; biggest_gap?: string | null }> {
  // 1. Read the opportunity
  const { data: opp } = await s
    .from('koto_opportunities')
    .select('id, scout_lead_id, intel, pain_point')
    .eq('id', opportunityId)
    .maybeSingle()
  if (!opp) return { updated: false }

  // Skip if already stamped (idempotent)
  const currentGap = (opp.intel as any)?.biggest_gap
  if (currentGap && String(currentGap).length > 3) {
    return { updated: false, biggest_gap: currentGap }
  }

  // 2. Resolve a scout lead to read gaps from
  let gaps: any = null
  if (opp.scout_lead_id) {
    const { data: lead } = await s
      .from('koto_scout_leads')
      .select('gaps')
      .eq('id', opp.scout_lead_id)
      .maybeSingle()
    gaps = lead?.gaps
  }

  const biggest = pickBiggestGap(gaps)
  if (!biggest) return { updated: false }

  // 3. Write into intel jsonb (preserve other intel keys)
  const nextIntel = { ...((opp.intel as any) || {}), biggest_gap: biggest, gaps: gaps || [] }
  const patch: Record<string, any> = { intel: nextIntel }
  if (!opp.pain_point) patch.pain_point = biggest

  const { error } = await s.from('koto_opportunities').update(patch).eq('id', opportunityId)
  if (error) return { updated: false }

  return { updated: true, biggest_gap: biggest }
}

// Backfill across all opportunities for an agency. Safe to run repeatedly —
// opportunities with a biggest_gap already set are skipped.
export async function backfillAgencyGaps(
  s: SupabaseClient,
  agencyId: string,
  limit = 200,
): Promise<{ scanned: number; updated: number }> {
  const { data: opps } = await s
    .from('koto_opportunities')
    .select('id')
    .eq('agency_id', agencyId)
    .not('scout_lead_id', 'is', null)
    .limit(limit)
  const ids = (opps || []).map((o: any) => o.id)
  let updated = 0
  for (const id of ids) {
    const r = await propagateGapsToOpportunity(s, id)
    if (r.updated) updated += 1
  }
  return { scanned: ids.length, updated }
}

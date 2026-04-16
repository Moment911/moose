// ─────────────────────────────────────────────────────────────
// AI Visibility Engine — unified top KPI for KotoIQ
// Rolls up: Topical Authority, Brand SERP, E-E-A-T, AEO
// Weighted formula: 0.35 topical + 0.20 brand_serp + 0.25 eeat + 0.20 aeo
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
type Trend = 'up' | 'flat' | 'down'

interface Component {
  score: number
  weight: number
  value: any
}

function gradeFor(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function labelFor(key: string): string {
  return ({
    topical_authority: 'Topical Authority',
    brand_serp: 'Brand SERP',
    eeat: 'E-E-A-T',
    aeo: 'AEO',
  } as Record<string, string>)[key] || key
}

// Pick latest row for a table/client
async function latest<T = any>(s: SupabaseClient, table: string, clientId: string, orderBy: string, extraFilter?: (q: any) => any): Promise<T | null> {
  let q = s.from(table).select('*').eq('client_id', clientId).order(orderBy, { ascending: false }).limit(1)
  if (extraFilter) q = extraFilter(q)
  const { data } = await q
  return (data && data[0]) || null
}

// ── Calculate AI Visibility ─────────────────────────────────────────────────
export async function calculateAIVisibility(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  // 1. Topical Authority — from kotoiq_topical_maps (latest)
  const topicalMap = await latest<any>(s, 'kotoiq_topical_maps', client_id, 'updated_at')
  const topicalAuthority = numClip(
    topicalMap?.overall_authority_score ?? topicalMap?.topical_coverage_score ?? null
  )

  // 2. Brand SERP — from kotoiq_brand_serp (latest)
  const brandSerpRow = await latest<any>(s, 'kotoiq_brand_serp', client_id, 'scanned_at')
  const brandSerp = numClip(brandSerpRow?.brand_serp_score ?? null)

  // 3. E-E-A-T — latest site-wide (url is null)
  const eeatRow = await latest<any>(s, 'kotoiq_eeat_audit', client_id, 'scanned_at', (q) => q.is('url', null))
  const eeatFallback = eeatRow || await latest<any>(s, 'kotoiq_eeat_audit', client_id, 'scanned_at')
  const eeat = numClip(eeatFallback?.overall_eeat_score ?? null)

  // 4. AEO — avg across kotoiq_keywords.aeo_score OR fallback to % of keywords ranking top 10
  const { data: keywords } = await s.from('kotoiq_keywords').select('aeo_score, sc_avg_position, position').eq('client_id', client_id)
  let aeo: number | null = null
  if (keywords && keywords.length) {
    const withAeo = keywords.filter((k: any) => typeof k.aeo_score === 'number' && k.aeo_score !== null)
    if (withAeo.length) {
      aeo = withAeo.reduce((sum: number, k: any) => sum + Number(k.aeo_score), 0) / withAeo.length
    } else {
      const pos = keywords.map((k: any) => k.sc_avg_position ?? k.position).filter((p: any) => typeof p === 'number' && p > 0)
      if (pos.length) {
        const top10 = pos.filter((p: number) => p <= 10).length
        aeo = (top10 / pos.length) * 100
      }
    }
  }
  aeo = numClip(aeo)

  // ── Build components (use fallback defaults for missing data) ──
  const DEFAULT_MISSING = 30 // neutral starting point — not zero so one missing tool doesn't tank the score

  const components = {
    topical_authority: {
      score: topicalAuthority ?? DEFAULT_MISSING,
      weight: 0.35,
      value: topicalMap ? {
        coverage: topicalMap.topical_coverage_score,
        authority: topicalMap.overall_authority_score,
        covered_nodes: topicalMap.covered_nodes,
        total_nodes: topicalMap.total_nodes,
      } : null,
    },
    brand_serp: {
      score: brandSerp ?? DEFAULT_MISSING,
      weight: 0.20,
      value: brandSerpRow ? {
        owned_results: brandSerpRow.owned_results,
        total_results: brandSerpRow.total_results,
        has_knowledge_panel: brandSerpRow.has_knowledge_panel,
        has_ai_overview: brandSerpRow.has_ai_overview,
      } : null,
    },
    eeat: {
      score: eeat ?? DEFAULT_MISSING,
      weight: 0.25,
      value: eeatFallback ? {
        grade: eeatFallback.grade,
        experience: eeatFallback.experience_score,
        expertise: eeatFallback.expertise_score,
        authority: eeatFallback.authority_score,
        trust: eeatFallback.trust_score,
      } : null,
    },
    aeo: {
      score: aeo ?? DEFAULT_MISSING,
      weight: 0.20,
      value: keywords?.length ? {
        total_keywords: keywords.length,
        method: (keywords.some((k: any) => k.aeo_score != null)) ? 'aeo_score_avg' : 'top10_percentage',
      } : null,
    },
  } as Record<string, Component>

  // ── Weighted score ──
  const rawScore =
    components.topical_authority.score * components.topical_authority.weight +
    components.brand_serp.score * components.brand_serp.weight +
    components.eeat.score * components.eeat.weight +
    components.aeo.score * components.aeo.weight

  const aiVisibilityScore = Math.round(rawScore * 10) / 10
  const grade = gradeFor(aiVisibilityScore)

  // ── Trend vs 30 days ago ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: priorSnaps } = await s
    .from('kotoiq_ai_visibility_snapshots')
    .select('ai_visibility_score, captured_at')
    .eq('client_id', client_id)
    .lte('captured_at', thirtyDaysAgo)
    .order('captured_at', { ascending: false })
    .limit(1)

  let trendDirection: Trend = 'flat'
  let trendPct = 0
  if (priorSnaps && priorSnaps.length && priorSnaps[0].ai_visibility_score) {
    const prior = Number(priorSnaps[0].ai_visibility_score)
    if (prior > 0) {
      trendPct = Math.round(((aiVisibilityScore - prior) / prior) * 1000) / 10
      if (trendPct > 2) trendDirection = 'up'
      else if (trendPct < -2) trendDirection = 'down'
      else trendDirection = 'flat'
    }
  }

  // ── Next focus — top 2 lowest-scoring components ──
  const ranked = Object.entries(components)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 2)
    .map(([k]) => labelFor(k))

  // ── Save snapshot ──
  try {
    await s.from('kotoiq_ai_visibility_snapshots').insert({
      client_id,
      ai_visibility_score: aiVisibilityScore,
      grade,
      topical_authority: components.topical_authority.score,
      brand_serp: components.brand_serp.score,
      eeat: components.eeat.score,
      aeo: components.aeo.score,
      components,
      next_focus: ranked,
    })
  } catch { /* non-blocking */ }

  return {
    ai_visibility_score: aiVisibilityScore,
    grade,
    components,
    trend_direction: trendDirection,
    trend_pct: trendPct,
    next_focus: ranked,
    last_updated: new Date().toISOString(),
  }
}

// ── Get AI Visibility History ───────────────────────────────────────────────
export async function getAIVisibilityHistory(
  s: SupabaseClient,
  body: { client_id: string; days?: number }
) {
  const { client_id, days = 90 } = body
  if (!client_id) throw new Error('client_id required')

  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data } = await s
    .from('kotoiq_ai_visibility_snapshots')
    .select('ai_visibility_score, grade, topical_authority, brand_serp, eeat, aeo, captured_at')
    .eq('client_id', client_id)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })

  return { history: data || [], days }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function numClip(n: any): number | null {
  if (n == null || n === '' || isNaN(Number(n))) return null
  const v = Number(n)
  if (v < 0) return 0
  if (v > 100) return 100
  return Math.round(v * 10) / 10
}

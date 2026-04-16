// ─────────────────────────────────────────────────────────────
// Industry Benchmark Engine
// Aggregates anonymous metrics across all clients by industry
// Published with a minimum sample-size floor for privacy.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

const MIN_SAMPLE_SIZE = 10

function median(nums: number[]): number {
  const clean = nums.filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n))
  if (clean.length === 0) return 0
  const sorted = [...clean].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function avg(nums: number[]): number {
  const clean = nums.filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n))
  if (clean.length === 0) return 0
  return clean.reduce((a, b) => a + b, 0) / clean.length
}

function percentile(value: number, nums: number[]): number {
  const clean = nums.filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n)).sort((a, b) => a - b)
  if (clean.length === 0) return 0
  const below = clean.filter(n => n < value).length
  return Math.round((below / clean.length) * 100)
}

function normalizeIndustry(s: string | null): string {
  if (!s) return 'other'
  return String(s).toLowerCase().trim().slice(0, 60) || 'other'
}

// ── Calculate + persist benchmarks for every industry ───────────────────────
export async function calculateIndustryBenchmarks(s: SupabaseClient, _ai?: Anthropic) {
  const { data: clients } = await s.from('clients')
    .select('id, primary_service')
    .is('deleted_at', null)

  if (!clients?.length) return { calculated: 0, industries: [] }

  // Group clients by industry
  const industryMap = new Map<string, string[]>() // industry -> client ids
  for (const c of clients) {
    const ind = normalizeIndustry(c.primary_service)
    if (!industryMap.has(ind)) industryMap.set(ind, [])
    industryMap.get(ind)!.push(c.id)
  }

  const results: any[] = []

  for (const [industry, clientIds] of industryMap.entries()) {
    if (clientIds.length < MIN_SAMPLE_SIZE) continue

    // Pull per-client metrics in parallel
    const [
      topicalMaps,
      eeat,
      contentInv,
      backlinks,
      schema,
    ] = await Promise.all([
      s.from('kotoiq_topical_maps').select('client_id, authority_score, meta').in('client_id', clientIds),
      s.from('kotoiq_eeat_audit').select('client_id, overall_score').in('client_id', clientIds),
      s.from('kotoiq_content_inventory').select('client_id, published_date, last_modified, url').in('client_id', clientIds),
      s.from('kotoiq_backlink_profile').select('client_id, domain_authority, total_backlinks').in('client_id', clientIds),
      s.from('kotoiq_schema_audit').select('client_id, coverage_pct').in('client_id', clientIds),
    ])

    // Topical authority
    const authScores = (topicalMaps.data || []).map((m: any) => Number(m.authority_score) || 0).filter(n => n > 0)

    // E-E-A-T
    const eeatScores = (eeat.data || []).map((m: any) => Number(m.overall_score) || 0).filter(n => n > 0)

    // Content refresh & publishing velocity per client
    const refreshDays: number[] = []
    const publishVelocity: number[] = []
    const byClientContent = new Map<string, any[]>()
    for (const row of contentInv.data || []) {
      if (!byClientContent.has(row.client_id)) byClientContent.set(row.client_id, [])
      byClientContent.get(row.client_id)!.push(row)
    }
    const now = Date.now()
    for (const rows of byClientContent.values()) {
      // avg days since last_modified
      const ages = rows
        .map(r => r.last_modified ? (now - new Date(r.last_modified).getTime()) / 86400000 : null)
        .filter((n): n is number => n !== null && n > 0 && n < 3650)
      if (ages.length > 0) refreshDays.push(avg(ages))

      // pages published in the last 90 days → per month
      const since90 = now - 90 * 86400000
      const recent = rows.filter(r => r.published_date && new Date(r.published_date).getTime() >= since90)
      publishVelocity.push(recent.length / 3) // per month over 3 months
    }

    // Backlinks
    const das = (backlinks.data || []).map((b: any) => Number(b.domain_authority) || 0).filter(n => n > 0)
    const blCounts = (backlinks.data || []).map((b: any) => Number(b.total_backlinks) || 0).filter(n => n > 0)

    // Schema coverage
    const schemaCoverages = (schema.data || []).map((m: any) => Number(m.coverage_pct) || 0).filter(n => n >= 0)

    const row = {
      industry,
      sample_size: clientIds.length,
      median_authority_score: Number(median(authScores).toFixed(2)),
      avg_authority_score: Number(avg(authScores).toFixed(2)),
      median_eeat_score: Number(median(eeatScores).toFixed(2)),
      median_content_refresh_days: Number(median(refreshDays).toFixed(2)),
      median_publishing_velocity_per_month: Number(median(publishVelocity).toFixed(2)),
      median_schema_coverage_pct: Number(median(schemaCoverages).toFixed(2)),
      median_da: Number(median(das).toFixed(2)),
      median_backlink_count: Math.round(median(blCounts)),
      benchmarks_json: {
        raw: {
          authority_scores: authScores,
          eeat_scores: eeatScores,
          refresh_days: refreshDays,
          publishing_velocity: publishVelocity,
          schema_coverages: schemaCoverages,
          das,
          backlink_counts: blCounts,
        },
        computed_at: new Date().toISOString(),
      },
      calculated_at: new Date().toISOString(),
    }

    // Replace prior row for this industry
    await s.from('kotoiq_industry_benchmarks').delete().eq('industry', industry)
    await s.from('kotoiq_industry_benchmarks').insert(row)

    results.push({ industry, sample_size: clientIds.length })
  }

  return {
    calculated: results.length,
    industries: results,
    skipped_for_small_sample: Array.from(industryMap.entries()).filter(([_, ids]) => ids.length < MIN_SAMPLE_SIZE).map(([ind, ids]) => ({ industry: ind, sample_size: ids.length })),
  }
}

// ── Get benchmark for one client (with percentiles) ─────────────────────────
export async function getBenchmarkForClient(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data: client } = await s.from('clients').select('primary_service, website').eq('id', client_id).single()
  if (!client) throw new Error('client not found')

  const industry = normalizeIndustry(client.primary_service)

  const { data: benchmark } = await s.from('kotoiq_industry_benchmarks')
    .select('*')
    .eq('industry', industry)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!benchmark) {
    return {
      industry,
      available: false,
      reason: `Industry '${industry}' has fewer than ${MIN_SAMPLE_SIZE} clients — benchmark not published.`,
    }
  }

  // Pull this client's values
  const [topical, eeat, content, bl, schema] = await Promise.all([
    s.from('kotoiq_topical_maps').select('authority_score').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_eeat_audit').select('overall_score').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_content_inventory').select('published_date, last_modified').eq('client_id', client_id),
    s.from('kotoiq_backlink_profile').select('domain_authority, total_backlinks').eq('client_id', client_id).maybeSingle(),
    s.from('kotoiq_schema_audit').select('coverage_pct').eq('client_id', client_id).maybeSingle(),
  ])

  // Compute client metrics
  const now = Date.now()
  const ages = (content.data || [])
    .map((r: any) => r.last_modified ? (now - new Date(r.last_modified).getTime()) / 86400000 : null)
    .filter((n: any): n is number => n !== null && n > 0 && n < 3650)
  const clientRefreshDays = ages.length > 0 ? avg(ages) : 0

  const since90 = now - 90 * 86400000
  const recent = (content.data || []).filter((r: any) => r.published_date && new Date(r.published_date).getTime() >= since90)
  const clientPublishVelocity = recent.length / 3

  const clientMetrics = {
    authority_score: Number(topical.data?.authority_score) || 0,
    eeat_score: Number(eeat.data?.overall_score) || 0,
    content_refresh_days: clientRefreshDays,
    publishing_velocity: clientPublishVelocity,
    schema_coverage_pct: Number(schema.data?.coverage_pct) || 0,
    domain_authority: Number(bl.data?.domain_authority) || 0,
    backlink_count: Number(bl.data?.total_backlinks) || 0,
  }

  // Percentile rankings using distribution stored in benchmarks_json.raw
  const raw = (benchmark.benchmarks_json as any)?.raw || {}
  const percentiles = {
    authority_score: percentile(clientMetrics.authority_score, raw.authority_scores || []),
    eeat_score: percentile(clientMetrics.eeat_score, raw.eeat_scores || []),
    // Lower refresh_days is better — invert
    content_freshness: 100 - percentile(clientMetrics.content_refresh_days, raw.refresh_days || []),
    publishing_velocity: percentile(clientMetrics.publishing_velocity, raw.publishing_velocity || []),
    schema_coverage: percentile(clientMetrics.schema_coverage_pct, raw.schema_coverages || []),
    domain_authority: percentile(clientMetrics.domain_authority, raw.das || []),
    backlink_count: percentile(clientMetrics.backlink_count, raw.backlink_counts || []),
  }

  return {
    available: true,
    industry,
    sample_size: benchmark.sample_size,
    benchmark: {
      median_authority_score: benchmark.median_authority_score,
      avg_authority_score: benchmark.avg_authority_score,
      median_eeat_score: benchmark.median_eeat_score,
      median_content_refresh_days: benchmark.median_content_refresh_days,
      median_publishing_velocity_per_month: benchmark.median_publishing_velocity_per_month,
      median_schema_coverage_pct: benchmark.median_schema_coverage_pct,
      median_da: benchmark.median_da,
      median_backlink_count: benchmark.median_backlink_count,
    },
    client_metrics: clientMetrics,
    percentiles,
    calculated_at: benchmark.calculated_at,
  }
}

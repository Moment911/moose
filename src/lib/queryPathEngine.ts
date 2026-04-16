import 'server-only'
// ── Query Path / Session Analyzer Engine ───────────────────────────────────
// Groups keywords into clusters based on topical, intent, and sequential
// relationships. Uses Claude to identify search journey patterns.
// Called from /api/kotoiq route via action: analyze_query_paths / get_query_clusters.

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ───────────────────────────────────────────────────────────────────
interface ClusterQuery {
  keyword: string
  volume: number | null
  position: number | null
  relationship: string // 'seed' | 'variation' | 'refinement' | 'related' | 'long_tail'
}

interface QueryCluster {
  cluster_name: string
  cluster_type: string // 'correlative' | 'sequential' | 'topical' | 'intent'
  seed_query: string
  queries: ClusterQuery[]
  common_next_queries: string[]
  common_prev_queries: string[]
  avg_session_depth: number
  covered_queries: number
  total_queries: number
  coverage_pct: number
  gap_queries: string[]
}

// ── Main analysis function ─────────────────────────────────────────────────
export async function analyzeQueryPaths(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string }
) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  // Get all keywords for this client
  const { data: keywords, error: kwErr } = await s.from('kotoiq_keywords')
    .select('keyword, fingerprint, sc_avg_position, sc_clicks, sc_impressions, sc_ctr, sc_top_page, intent, category, kp_monthly_volume, opportunity_score')
    .eq('client_id', client_id)
    .order('sc_impressions', { ascending: false })
    .limit(500)

  if (kwErr) return { error: `Failed to load keywords: ${kwErr.message}` }
  if (!keywords || keywords.length < 3) return { error: 'Need at least 3 keywords to analyze query paths. Run a keyword scan first.' }

  // Get historical snapshots for trend context
  const fingerprints = keywords.map(k => k.fingerprint).filter(Boolean)
  const { data: snapshots } = await s.from('kotoiq_snapshots')
    .select('keyword_fingerprint, sc_position, sc_clicks, created_at')
    .in('keyword_fingerprint', fingerprints.slice(0, 200))
    .order('created_at', { ascending: false })
    .limit(1000)

  // Build keyword summary for Claude
  const kwSummary = keywords.slice(0, 300).map(k => ({
    keyword: k.keyword,
    volume: k.kp_monthly_volume || 0,
    position: k.sc_avg_position ? Math.round(k.sc_avg_position) : null,
    clicks: k.sc_clicks || 0,
    impressions: k.sc_impressions || 0,
    intent: k.intent || 'unknown',
    top_page: k.sc_top_page || null,
    category: k.category || null,
  }))

  // Trending keywords (have snapshots showing movement)
  const trendMap: Record<string, string> = {}
  if (snapshots && snapshots.length > 0) {
    const byFp: Record<string, any[]> = {}
    for (const snap of snapshots) {
      if (!byFp[snap.keyword_fingerprint]) byFp[snap.keyword_fingerprint] = []
      byFp[snap.keyword_fingerprint].push(snap)
    }
    for (const [fp, snaps] of Object.entries(byFp)) {
      if (snaps.length >= 2) {
        const recent = snaps[0].sc_position
        const older = snaps[snaps.length - 1].sc_position
        if (recent && older) {
          trendMap[fp] = recent < older ? 'improving' : recent > older ? 'declining' : 'stable'
        }
      }
    }
  }

  const prompt = `You are KotoIQ, an expert search behavior analyst. Analyze these keywords and group them into query clusters.

KEYWORDS (${kwSummary.length} total):
${JSON.stringify(kwSummary, null, 1)}

${Object.keys(trendMap).length > 0 ? `TREND DATA (keyword fingerprint → trend): ${JSON.stringify(trendMap)}` : ''}

GROUP these keywords into clusters. Each cluster represents a related search journey or topic area.

CLUSTER TYPES:
- "topical" — keywords about the same entity, service, or topic
- "intent" — keywords sharing the same user intent/goal
- "sequential" — keywords that represent query refinement (broad → specific)
- "correlative" — keywords users commonly search together in one session

FOR EACH CLUSTER provide:
- cluster_name: descriptive name (2-4 words)
- cluster_type: one of the types above
- seed_query: the most representative/broad keyword in the cluster
- queries: array of {keyword, volume, position, relationship} where relationship is "seed", "variation", "refinement", "related", or "long_tail"
- common_next_queries: 3-5 queries users likely search AFTER these (even if not in our data)
- common_prev_queries: 3-5 queries users likely searched BEFORE these
- avg_session_depth: estimated number of queries in a typical session for this cluster (1-8)

Rules:
- Each keyword should appear in exactly ONE cluster
- Create 3-15 clusters depending on keyword count
- Aim for 3-30 keywords per cluster
- Focus on actionable groupings that reveal content opportunities
- Include keywords with null position (not ranking) — these are gap opportunities

Return ONLY valid JSON array of cluster objects, no markdown fences.`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as any).text || ''

  // Log token usage
  try {
    await logTokenUsage({
      feature: 'kotoiq_query_paths',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: body.agency_id || undefined,
    })
  } catch { /* non-critical */ }

  // Parse Claude response
  let clusters: any[]
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    clusters = JSON.parse(cleaned)
    if (!Array.isArray(clusters)) throw new Error('Expected array')
  } catch {
    return { error: 'Failed to parse cluster analysis. Try again.' }
  }

  // Build page coverage lookup
  const pagesWithContent = new Set(
    keywords.filter(k => k.sc_top_page).map(k => k.keyword.toLowerCase().trim())
  )

  // Enrich clusters with coverage stats
  const enrichedClusters: QueryCluster[] = clusters.map((c: any) => {
    const queries: ClusterQuery[] = (c.queries || []).map((q: any) => ({
      keyword: q.keyword,
      volume: q.volume || null,
      position: q.position || null,
      relationship: q.relationship || 'related',
    }))

    const covered = queries.filter(q => pagesWithContent.has(q.keyword.toLowerCase().trim())).length
    const gaps = queries
      .filter(q => !pagesWithContent.has(q.keyword.toLowerCase().trim()))
      .map(q => q.keyword)

    return {
      cluster_name: c.cluster_name || 'Unnamed Cluster',
      cluster_type: c.cluster_type || 'topical',
      seed_query: c.seed_query || queries[0]?.keyword || '',
      queries,
      common_next_queries: (c.common_next_queries || []).slice(0, 5),
      common_prev_queries: (c.common_prev_queries || []).slice(0, 5),
      avg_session_depth: c.avg_session_depth || 3,
      covered_queries: covered,
      total_queries: queries.length,
      coverage_pct: queries.length > 0 ? Math.round((covered / queries.length) * 100) : 0,
      gap_queries: gaps,
    }
  })

  // Save clusters to DB
  await s.from('kotoiq_query_clusters').delete().eq('client_id', client_id)

  if (enrichedClusters.length > 0) {
    const rows = enrichedClusters.map(c => ({
      client_id,
      agency_id: body.agency_id || null,
      cluster_name: c.cluster_name,
      cluster_type: c.cluster_type,
      seed_query: c.seed_query,
      queries: c.queries,
      common_next_queries: c.common_next_queries,
      common_prev_queries: c.common_prev_queries,
      avg_session_depth: c.avg_session_depth,
      covered_queries: c.covered_queries,
      total_queries: c.total_queries,
      coverage_pct: c.coverage_pct,
      gap_queries: c.gap_queries,
      updated_at: new Date().toISOString(),
    }))

    const { error: insertErr } = await s.from('kotoiq_query_clusters').insert(rows)
    if (insertErr) return { error: `DB save failed: ${insertErr.message}` }
  }

  // Overall stats
  const totalQueries = enrichedClusters.reduce((sum, c) => sum + c.total_queries, 0)
  const totalCovered = enrichedClusters.reduce((sum, c) => sum + c.covered_queries, 0)
  const avgCoverage = totalQueries > 0 ? Math.round((totalCovered / totalQueries) * 100) : 0

  return {
    success: true,
    clusters: enrichedClusters,
    total_clusters: enrichedClusters.length,
    total_queries: totalQueries,
    avg_coverage_pct: avgCoverage,
    all_gaps: enrichedClusters.flatMap(c => c.gap_queries).slice(0, 100),
  }
}

// ── Get existing clusters ──────────────────────────────────────────────────
export async function getQueryClusters(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  const { data } = await s.from('kotoiq_query_clusters')
    .select('*')
    .eq('client_id', client_id)
    .order('coverage_pct', { ascending: true })

  if (!data || data.length === 0) return { success: true, empty: true }

  const totalQueries = data.reduce((sum, c) => sum + (c.total_queries || 0), 0)
  const totalCovered = data.reduce((sum, c) => sum + (c.covered_queries || 0), 0)
  const avgCoverage = totalQueries > 0 ? Math.round((totalCovered / totalQueries) * 100) : 0

  return {
    success: true,
    clusters: data,
    total_clusters: data.length,
    total_queries: totalQueries,
    avg_coverage_pct: avgCoverage,
    all_gaps: data.flatMap(c => (c.gap_queries || [])).slice(0, 100),
  }
}

// ─────────────────────────────────────────────────────────────
// Portal Engine — powers the public white-label Client Portal
//
// Read-only, high-level KPI view of a client's KotoIQ data.
// No raw data, no PII, no internal notes. Safe to expose publicly.
// ─────────────────────────────────────────────────────────────

export interface PortalData {
  client: {
    id: string
    name: string
    website: string | null
    logo_url: string | null
  }
  agency: {
    id: string | null
    name: string
    logo_url: string | null
    primary_color: string
    secondary_color: string
    support_email: string | null
  }
  ai_visibility: {
    score: number | null
    grade: string | null
    trend: string | null
    last_updated: string | null
  }
  kpis: {
    total_keywords: number
    top10_rankings: number
    topical_authority: number | null
    eeat_grade: string | null
  }
  recent_wins: Array<{ keyword: string; from_position: number; to_position: number; volume: number | null }>
  top_opportunities: Array<{ keyword: string; position: number | null; volume: number | null; opportunity_score: number | null }>
  content_this_month: Array<{ title: string; url: string | null; published_at: string | null; target_keyword: string | null }>
  competitor_summary: Array<{ domain: string; our_position: number | null; their_position: number | null; gap_keywords: number }>
  next_actions: Array<{ title: string; detail: string; priority: string | null; category: string | null }>
  generated_at: string
}

export async function getPortalData(s: any, clientId: string): Promise<PortalData> {
  if (!clientId) throw new Error('clientId required')

  // Fetch client + agency in parallel
  const { data: client } = await s
    .from('clients')
    .select('id, name, website, logo_url, agency_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (!client) throw new Error('Client not found')

  const agencyId = client.agency_id

  // Parallel fetch of every piece the portal needs
  const [
    agencyRes,
    visibilityRes,
    keywordsCountRes,
    top10CountRes,
    topicalRes,
    eeatRes,
    snapshotsRes,
    opportunitiesRes,
    contentRes,
    scorecardRes,
    quickWinsRes,
  ] = await Promise.all([
    agencyId
      ? s
          .from('agencies')
          .select('id, name, brand_logo_url, primary_color, secondary_color, support_email, white_label_enabled, metadata')
          .eq('id', agencyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    s
      .from('kotoiq_ai_visibility_snapshots')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    s
      .from('kotoiq_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId),

    s
      .from('kotoiq_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .not('sc_avg_position', 'is', null)
      .lte('sc_avg_position', 10),

    s
      .from('kotoiq_topical_maps')
      .select('topical_coverage_score, vastness_score, depth_score, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    s
      .from('kotoiq_eeat_audit')
      .select('overall_grade, overall_score, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Recent wins: compare last snapshot to 30d-ago snapshot
    s
      .from('kotoiq_snapshots')
      .select('keyword, position, snapshot_date')
      .eq('client_id', clientId)
      .gte('snapshot_date', new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })
      .limit(500),

    s
      .from('kotoiq_keywords')
      .select('keyword, sc_avg_position, kp_monthly_volume, opportunity_score, category')
      .eq('client_id', clientId)
      .eq('category', 'striking_distance')
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .limit(5),

    s
      .from('kotoiq_content_calendar')
      .select('title, url, published_at, target_keyword, status')
      .eq('client_id', clientId)
      .eq('status', 'published')
      .gte('published_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .order('published_at', { ascending: false })
      .limit(10),

    s
      .from('kotoiq_scorecards')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    s
      .from('kotoiq_quick_win_queue')
      .select('title, detail, priority, category, recommendation_type')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .limit(5),
  ])

  const agency = agencyRes?.data
  const visibility = visibilityRes?.data
  const topical = topicalRes?.data
  const eeat = eeatRes?.data
  const scorecard = scorecardRes?.data

  // Compute recent wins: keywords that moved up into top 10
  const snapshots = snapshotsRes?.data || []
  const byKeyword: Record<string, { recent: any; old: any }> = {}
  for (const snap of snapshots) {
    const k = (snap.keyword || '').toLowerCase()
    if (!k) continue
    const daysAgo = Math.floor((Date.now() - new Date(snap.snapshot_date).getTime()) / 86400000)
    if (!byKeyword[k]) byKeyword[k] = { recent: null, old: null }
    if (daysAgo <= 7 && !byKeyword[k].recent) byKeyword[k].recent = snap
    if (daysAgo >= 25 && daysAgo <= 45 && !byKeyword[k].old) byKeyword[k].old = snap
  }
  const recentWins = Object.values(byKeyword)
    .filter((v) => v.recent && v.old && v.recent.position <= 10 && v.old.position > 10)
    .map((v) => ({
      keyword: v.recent.keyword,
      from_position: Math.round(v.old.position),
      to_position: Math.round(v.recent.position),
      volume: null,
    }))
    .slice(0, 5)

  // Competitor summary from scorecard
  const competitors: Array<{ domain: string; our_position: number | null; their_position: number | null; gap_keywords: number }> = []
  try {
    const compData = scorecard?.competitor_breakdown || scorecard?.competitors || []
    const arr = Array.isArray(compData) ? compData : []
    for (const c of arr.slice(0, 3)) {
      competitors.push({
        domain: c.domain || c.competitor_domain || 'Unknown',
        our_position: c.client_avg_position ?? c.our_position ?? null,
        their_position: c.competitor_avg_position ?? c.their_position ?? null,
        gap_keywords: c.gap_count ?? c.gap_keywords ?? 0,
      })
    }
  } catch {}

  // Resolve agency branding (white-label) with Koto fallback
  const agencyMeta = agency?.metadata || {}
  const brandingLogo = agency?.brand_logo_url || agencyMeta.logo_url || null
  const primaryColor = agency?.primary_color || agencyMeta.primary_color || '#00C2CB'
  const secondaryColor = agency?.secondary_color || agencyMeta.secondary_color || '#111111'

  return {
    client: {
      id: client.id,
      name: client.name,
      website: client.website || null,
      logo_url: client.logo_url || null,
    },
    agency: {
      id: agency?.id || null,
      name: agency?.name || 'Koto',
      logo_url: brandingLogo,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      support_email: agency?.support_email || null,
    },
    ai_visibility: {
      score: visibility?.overall_score ?? visibility?.score ?? null,
      grade: visibility?.grade || null,
      trend: visibility?.trend || null,
      last_updated: visibility?.created_at || null,
    },
    kpis: {
      total_keywords: keywordsCountRes?.count || 0,
      top10_rankings: top10CountRes?.count || 0,
      topical_authority: topical?.topical_coverage_score ?? null,
      eeat_grade: eeat?.overall_grade || null,
    },
    recent_wins: recentWins,
    top_opportunities: (opportunitiesRes?.data || []).map((k: any) => ({
      keyword: k.keyword,
      position: k.sc_avg_position ? Math.round(k.sc_avg_position) : null,
      volume: k.kp_monthly_volume || null,
      opportunity_score: k.opportunity_score || null,
    })),
    content_this_month: (contentRes?.data || []).map((c: any) => ({
      title: c.title,
      url: c.url,
      published_at: c.published_at,
      target_keyword: c.target_keyword,
    })),
    competitor_summary: competitors,
    next_actions: (quickWinsRes?.data || []).map((q: any) => ({
      title: q.title,
      detail: q.detail,
      priority: q.priority,
      category: q.category || q.recommendation_type,
    })),
    generated_at: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter (per-IP, per-minute)
// 30 requests/min cap for the public portal endpoint
// ─────────────────────────────────────────────────────────────
const rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map()

export function checkPortalRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now()
  const existing = rateLimitMap.get(ip)
  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count++
  return true
}

export async function logPortalView(s: any, clientId: string, ip: string, userAgent: string) {
  try {
    await s.from('kotoiq_portal_views').insert({
      client_id: clientId,
      viewer_ip: ip,
      viewer_user_agent: userAgent,
    })
  } catch {}
}

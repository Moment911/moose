// ─────────────────────────────────────────────────────────────
// Today / Action Center Engine
//
// Computes:
//  - Initial-setup checklist (auto-detected from system state)
//  - Daily / weekly / monthly routines + completion state
//  - Live attention items (auto-fixes pending, high-severity
//    Pulse events, new reviews, etc.)
//
// Routines are defined as code (a catalog) and stored as
// completions in kotoiq_routine_completions. Completion expires
// based on cadence — daily resets at midnight UTC, weekly on
// Monday, monthly on the 1st.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUnifiedEventsFeed } from './unifiedEventsEngine'

export type Cadence = 'initial' | 'daily' | 'weekly' | 'monthly'

export interface RoutineDef {
  id: string
  cadence: Cadence
  label: string
  description: string
  tab: string                    // tab key to navigate to
  why: string                    // why this matters
  estimate_minutes?: number
}

export interface RoutineState extends RoutineDef {
  completed: boolean
  completed_at: string | null
  // for initial: auto-detected from system state, not user-marked
  auto_status?: 'done' | 'pending' | 'partial'
  auto_detail?: string
}

// ─────────────────────────────────────────────────────────────
// Routine catalog
// ─────────────────────────────────────────────────────────────
export const ROUTINES: RoutineDef[] = [
  // ── Initial setup ──────────────────────────────────────────
  {
    id: 'setup_client_website',
    cadence: 'initial',
    label: 'Add client website',
    description: 'Save the client\'s primary domain so audits, rank tracking, and AEO scans know where to look.',
    tab: 'connect',
    why: 'Everything else depends on this.',
    estimate_minutes: 1,
  },
  {
    id: 'setup_google_connections',
    cadence: 'initial',
    label: 'Connect Google (Search Console, GA4, Ads, GBP)',
    description: 'Authorize Koto to pull Google data so rankings, traffic, and ads intel populate.',
    tab: 'connect',
    why: 'Core data flows depend on this. ~50% of features are richer with it.',
    estimate_minutes: 3,
  },
  {
    id: 'setup_aeo_prompts',
    cadence: 'initial',
    label: 'Set up AEO Visibility',
    description: 'Seed 40 prompts and add competitor brands so we track how often the client appears in ChatGPT, Claude, Gemini, Perplexity, and Google AIO.',
    tab: 'aeo_visibility',
    why: 'The single biggest 2026 SEO surface. Profound charges $499/mo for this.',
    estimate_minutes: 2,
  },
  {
    id: 'setup_competitor_pages',
    cadence: 'initial',
    label: 'Track competitor pages',
    description: 'Auto-discover the top 5 pages per competitor (home, pricing, features, about, blog) so we diff them daily.',
    tab: 'competitor_pages',
    why: 'Foundation for Pricing, Tech Stack, and Pulse.',
    estimate_minutes: 3,
  },
  {
    id: 'setup_wordpress',
    cadence: 'initial',
    label: 'Connect client WordPress',
    description: 'Install the Koto WP plugin so we can publish briefs directly without copy-paste.',
    tab: 'connect',
    why: 'Closes the brief → write → publish loop.',
    estimate_minutes: 5,
  },
  {
    id: 'setup_alerts',
    cadence: 'initial',
    label: 'Configure Slack or email alerts',
    description: 'Pick where you want competitor-watch alerts delivered.',
    tab: 'integrations',
    why: 'Nobody wants to check the dashboard hourly. Push the important stuff.',
    estimate_minutes: 2,
  },
  {
    id: 'setup_budget',
    cadence: 'initial',
    label: 'Set monthly ad budget',
    description: 'Lets Budget & Forecast track pacing and warn when spend will exceed budget.',
    tab: 'budget_forecast',
    why: 'Prevent surprise overspend.',
    estimate_minutes: 1,
  },

  // ── Daily ──────────────────────────────────────────────────
  {
    id: 'review_pulse',
    cadence: 'daily',
    label: 'Review Competitor Pulse',
    description: 'Scan everything that changed across competitor pages, pricing, ads, YouTube, and email in the last 24 hours.',
    tab: 'competitor_pulse',
    why: 'The daily standup. Catches what would take hours to find manually.',
    estimate_minutes: 3,
  },
  {
    id: 'check_rank_movement',
    cadence: 'daily',
    label: 'Check rank movement',
    description: 'See which keywords moved up or down today.',
    tab: 'ranks',
    why: 'Early warning on algorithm shifts or competitor wins.',
    estimate_minutes: 2,
  },
  {
    id: 'reply_to_reviews',
    cadence: 'daily',
    label: 'Reply to new GMB reviews',
    description: 'Use AI-drafted responses to keep response time under 24 hours.',
    tab: 'reviews',
    why: 'Response rate directly affects local pack ranking.',
    estimate_minutes: 5,
  },
  {
    id: 'approve_autofixes',
    cadence: 'daily',
    label: 'Approve pending auto-fixes',
    description: 'Review proposed schema, content, and internal-link fixes the system found.',
    tab: 'autopilot',
    why: 'Compounds. A few minutes a day = audit issues resolved automatically.',
    estimate_minutes: 4,
  },

  // ── Weekly ─────────────────────────────────────────────────
  {
    id: 'review_aeo_share',
    cadence: 'weekly',
    label: 'Review AEO Share of Voice',
    description: 'Check this week\'s share-of-voice shift across the 5 AI engines.',
    tab: 'aeo_visibility',
    why: 'Slow-moving signal; weekly cadence catches drift.',
    estimate_minutes: 5,
  },
  {
    id: 'plan_content',
    cadence: 'weekly',
    label: 'Plan next week\'s content',
    description: 'Open PageIQ Writer, pull from Quick Wins + Competitor gaps, generate 2-3 briefs.',
    tab: 'briefs',
    why: 'Consistent content shipping is the #1 predictor of rank growth.',
    estimate_minutes: 30,
  },
  {
    id: 'review_competitor_wins',
    cadence: 'weekly',
    label: 'Review competitor wins',
    description: 'See what competitors changed this week — content, pricing, ads — and decide if we should respond.',
    tab: 'competitor_pulse',
    why: 'Strategic catch-up.',
    estimate_minutes: 10,
  },
  {
    id: 'client_report',
    cadence: 'weekly',
    label: 'Send weekly client report',
    description: 'Generate the white-labeled report from Reports tab and email it.',
    tab: 'reports',
    why: 'Retention. Clients who see weekly progress stay.',
    estimate_minutes: 10,
  },

  // ── Monthly ────────────────────────────────────────────────
  {
    id: 'refresh_content',
    cadence: 'monthly',
    label: 'Refresh decaying content',
    description: 'Review Content Decay predictions and update the highest-priority pages.',
    tab: 'content_decay',
    why: 'Half-life of top content is shorter than you think.',
    estimate_minutes: 30,
  },
  {
    id: 'strategic_plan',
    cadence: 'monthly',
    label: 'Update strategic plan',
    description: 'Review attack/defend/abandon priorities and weekly action plan.',
    tab: 'strategy',
    why: 'Quarterly outcomes start with monthly recalibration.',
    estimate_minutes: 20,
  },
  {
    id: 'review_audit',
    cadence: 'monthly',
    label: 'Run technical SEO audit',
    description: 'Full crawl + schema audit. Compare to last month\'s health score.',
    tab: 'technical_deep',
    why: 'Technical debt accumulates. Monthly catches drift before it hurts.',
    estimate_minutes: 15,
  },
]

// ─────────────────────────────────────────────────────────────
// Period bounds (UTC)
// ─────────────────────────────────────────────────────────────
function startOfPeriod(cadence: Cadence): Date {
  const now = new Date()
  if (cadence === 'daily') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  if (cadence === 'weekly') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = d.getUTCDay() || 7  // 1=Mon, 7=Sun
    d.setUTCDate(d.getUTCDate() - (day - 1))
    return d
  }
  if (cadence === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }
  // 'initial' — never resets; use epoch
  return new Date(0)
}

// ─────────────────────────────────────────────────────────────
// Auto-detect initial setup status from system state
// ─────────────────────────────────────────────────────────────
async function autoDetectInitial(
  s: SupabaseClient,
  client_id: string,
  routineId: string,
): Promise<{ status: 'done' | 'pending' | 'partial'; detail: string }> {
  switch (routineId) {
    case 'setup_client_website': {
      const { data } = await s.from('clients').select('website').eq('id', client_id).maybeSingle()
      return data?.website ? { status: 'done', detail: data.website } : { status: 'pending', detail: 'No website saved' }
    }
    case 'setup_google_connections': {
      const { data } = await s.from('seo_connections').select('provider').eq('client_id', client_id)
      const count = (data || []).length
      if (count === 0) return { status: 'pending', detail: 'No Google services connected' }
      if (count < 3) return { status: 'partial', detail: `${count}/4 Google services connected` }
      return { status: 'done', detail: `${count} Google services connected` }
    }
    case 'setup_aeo_prompts': {
      const { count: p } = await s.from('kotoiq_aeo_prompts').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('is_active', true)
      const { count: c } = await s.from('kotoiq_aeo_competitors').select('id', { count: 'exact', head: true }).eq('client_id', client_id)
      if (!p) return { status: 'pending', detail: 'No prompts yet' }
      if (!c || c < 2) return { status: 'partial', detail: `${p} prompts, but only ${c || 0} competitors tracked` }
      return { status: 'done', detail: `${p} prompts × ${c} brands` }
    }
    case 'setup_competitor_pages': {
      const { count } = await s.from('kotoiq_tracked_pages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('is_active', true)
      if (!count) return { status: 'pending', detail: 'No pages tracked' }
      if (count < 3) return { status: 'partial', detail: `${count} pages tracked` }
      return { status: 'done', detail: `${count} pages` }
    }
    case 'setup_wordpress': {
      // Best-effort — table may not exist if WP module not installed; treat error as pending
      try {
        const { data } = await s.from('koto_wp_sites').select('id, connected').eq('client_id', client_id)
        const connected = (data || []).filter((x: any) => x.connected).length
        if (!data?.length) return { status: 'pending', detail: 'No WordPress site connected' }
        return connected ? { status: 'done', detail: `${connected} site(s) connected` } : { status: 'partial', detail: 'Saved but not verified' }
      } catch {
        return { status: 'pending', detail: 'No WordPress site connected' }
      }
    }
    case 'setup_alerts': {
      try {
        const { data } = await s.from('kotoiq_competitor_watches').select('alert_channels').eq('client_id', client_id).limit(1).maybeSingle()
        const ch = data?.alert_channels || {}
        const has = !!(ch.slack_webhook || ch.teams_webhook || ch.email)
        return has ? { status: 'done', detail: 'Alert channel configured' } : { status: 'pending', detail: 'No alert channels' }
      } catch {
        return { status: 'pending', detail: 'No alert channels' }
      }
    }
    case 'setup_budget': {
      const { data } = await s.from('clients').select('marketing_budget').eq('id', client_id).maybeSingle()
      return data?.marketing_budget ? { status: 'done', detail: String(data.marketing_budget) } : { status: 'pending', detail: 'No budget set' }
    }
  }
  return { status: 'pending', detail: '' }
}

// ─────────────────────────────────────────────────────────────
// Public: routines with current state
// ─────────────────────────────────────────────────────────────
export async function getTodayRoutines(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{ routines: RoutineState[] }> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const since: Record<Cadence, string> = {
    initial: new Date(0).toISOString(),
    daily: startOfPeriod('daily').toISOString(),
    weekly: startOfPeriod('weekly').toISOString(),
    monthly: startOfPeriod('monthly').toISOString(),
  }

  const earliest = since.monthly < since.weekly ? since.monthly : since.weekly
  const { data: completions } = await s.from('kotoiq_routine_completions')
    .select('routine_id, cadence, completed_at')
    .eq('client_id', client_id)
    .gte('completed_at', earliest)
    .order('completed_at', { ascending: false })

  const latest = new Map<string, string>()
  for (const c of completions || []) {
    if (!latest.has(c.routine_id)) latest.set(c.routine_id, c.completed_at)
  }

  const out: RoutineState[] = []
  for (const def of ROUTINES) {
    const last = latest.get(def.id)
    const completed = !!last && last >= since[def.cadence]

    let auto_status: RoutineState['auto_status'] = undefined
    let auto_detail: string | undefined
    if (def.cadence === 'initial') {
      const auto = await autoDetectInitial(s, client_id, def.id)
      auto_status = auto.status
      auto_detail = auto.detail
    }

    out.push({
      ...def,
      completed: def.cadence === 'initial' ? auto_status === 'done' : completed,
      completed_at: completed ? last! : null,
      auto_status,
      auto_detail,
    })
  }
  return { routines: out }
}

export async function markRoutineComplete(
  s: SupabaseClient,
  body: { client_id: string; routine_id: string; user_id?: string; agency_id?: string | null; notes?: string },
) {
  const { client_id, routine_id, user_id, agency_id, notes } = body
  if (!client_id || !routine_id) throw new Error('client_id and routine_id required')

  const def = ROUTINES.find(r => r.id === routine_id)
  if (!def) throw new Error('unknown routine_id')

  const { error } = await s.from('kotoiq_routine_completions').insert({
    client_id,
    agency_id: agency_id || null,
    user_id: user_id || null,
    routine_id,
    cadence: def.cadence,
    notes: notes || null,
  })
  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────
// Live attention items — animated stream of "needs attention now"
// Pulls from the unified events feed, filtered to high-signal
// recent items only.
// ─────────────────────────────────────────────────────────────
export async function getTodayAttention(
  s: SupabaseClient,
  body: { client_id: string; days?: number },
): Promise<{
  high: any[]
  medium: any[]
  total: number
  by_source: Record<string, number>
}> {
  const { client_id, days = 1 } = body
  const feed = await getUnifiedEventsFeed(s, { client_id, days, limit: 50 })
  const high = feed.events.filter(e => e.severity === 'high')
  const medium = feed.events.filter(e => e.severity === 'medium')
  return {
    high,
    medium,
    total: feed.events.length,
    by_source: feed.by_source,
  }
}

// ─────────────────────────────────────────────────────────────
// Overview KPIs — one big "where we stand" snapshot
// ─────────────────────────────────────────────────────────────
export async function getTodayOverview(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{
  setup_progress: number     // 0-100 — % of initial routines auto-detected as done
  daily_done: number
  daily_total: number
  weekly_done: number
  weekly_total: number
  attention_count: number    // high-severity Pulse items today
  active_clients: number     // for agency owners
}> {
  const { routines } = await getTodayRoutines(s, body)
  const initial = routines.filter(r => r.cadence === 'initial')
  const daily = routines.filter(r => r.cadence === 'daily')
  const weekly = routines.filter(r => r.cadence === 'weekly')

  const setup_done = initial.filter(r => r.auto_status === 'done').length
  const setup_partial = initial.filter(r => r.auto_status === 'partial').length

  const att = await getTodayAttention(s, { client_id: body.client_id, days: 1 })

  const { count: activeClients } = await s.from('clients').select('id', { count: 'exact', head: true }).is('deleted_at', null)

  return {
    setup_progress: Math.round(((setup_done + setup_partial * 0.5) / Math.max(1, initial.length)) * 100),
    daily_done: daily.filter(r => r.completed).length,
    daily_total: daily.length,
    weekly_done: weekly.filter(r => r.completed).length,
    weekly_total: weekly.length,
    attention_count: att.high.length,
    active_clients: activeClients || 0,
  }
}

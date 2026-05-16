// ─────────────────────────────────────────────────────────────
// Unified Events Engine — Phase J
//
// The Crayon-killer view. Reads from every competitor intel
// source and normalizes them to a single chronological event
// feed so the user sees "what changed across all my competitors,
// today" in one place.
//
// Sources:
//   - AEO mention gained/lost     (kotoiq_aeo_runs)
//   - Page meaningful change      (kotoiq_page_changes)
//   - Pricing change              (derived from page snapshots)
//   - YouTube new upload          (kotoiq_competitor_youtube_videos)
//   - Ad creative discovered      (kotoiq_competitor_ads)
//   - Newsletter received         (kotoiq_competitor_emails)
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type EventSource =
  | 'aeo'
  | 'page_change'
  | 'pricing'
  | 'youtube'
  | 'ad'
  | 'email'

export type EventSeverity = 'high' | 'medium' | 'low' | 'info'

export interface UnifiedEvent {
  id: string                       // composite "source:row_id"
  source: EventSource
  event_type: string               // 'mention_gained' | 'price_changed' | 'new_upload' | etc.
  competitor: string               // brand or domain
  severity: EventSeverity
  title: string                    // primary line
  body?: string                    // secondary line
  url?: string                     // open competitor's surface
  metadata?: any                   // raw payload for filtering/expansion
  occurred_at: string              // ISO timestamp
}

export interface UnifiedFeedFilters {
  client_id: string
  days?: number                    // window, default 30
  sources?: EventSource[]          // filter by source
  severities?: EventSeverity[]
  competitor?: string              // single brand/domain
  limit?: number                   // max results, default 200
}

// ─────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────
export async function getUnifiedEventsFeed(
  s: SupabaseClient,
  filters: UnifiedFeedFilters,
): Promise<{
  events: UnifiedEvent[]
  by_source: Record<string, number>
  by_severity: Record<string, number>
  by_competitor: Record<string, number>
}> {
  const { client_id, days = 30, sources, severities, competitor, limit = 200 } = filters
  if (!client_id) throw new Error('client_id required')

  const since = new Date(Date.now() - days * 86400000).toISOString()

  const wantSource = (src: EventSource) => !sources?.length || sources.includes(src)

  const buckets = await Promise.all([
    wantSource('page_change') ? loadPageChanges(s, client_id, since) : Promise.resolve([]),
    wantSource('pricing')     ? loadPricingEvents(s, client_id, since) : Promise.resolve([]),
    wantSource('youtube')     ? loadYouTubeEvents(s, client_id, since) : Promise.resolve([]),
    wantSource('ad')          ? loadAdEvents(s, client_id, since) : Promise.resolve([]),
    wantSource('email')       ? loadEmailEvents(s, client_id, since) : Promise.resolve([]),
    wantSource('aeo')         ? loadAeoEvents(s, client_id, since) : Promise.resolve([]),
  ])

  let events: UnifiedEvent[] = buckets.flat()

  // Filter by severity / competitor
  if (severities?.length) events = events.filter(e => severities.includes(e.severity))
  if (competitor)         events = events.filter(e => e.competitor === competitor)

  events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  events = events.slice(0, limit)

  const by_source: Record<string, number> = {}
  const by_severity: Record<string, number> = {}
  const by_competitor: Record<string, number> = {}
  for (const e of events) {
    by_source[e.source] = (by_source[e.source] || 0) + 1
    by_severity[e.severity] = (by_severity[e.severity] || 0) + 1
    by_competitor[e.competitor] = (by_competitor[e.competitor] || 0) + 1
  }

  return { events, by_source, by_severity, by_competitor }
}

// ─────────────────────────────────────────────────────────────
// Per-source loaders
// ─────────────────────────────────────────────────────────────

async function loadPageChanges(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  const { data } = await s.from('kotoiq_page_changes')
    .select('id, diff_summary, classification, severity, classifier_reason, detected_at, kotoiq_tracked_pages!inner(url, page_type, competitor_domain)')
    .eq('client_id', client_id)
    .eq('classification', 'meaningful')
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })

  return (data || []).map((r: any): UnifiedEvent => ({
    id: `page_change:${r.id}`,
    source: 'page_change',
    event_type: `${r.kotoiq_tracked_pages?.page_type || 'page'}_changed`,
    competitor: r.kotoiq_tracked_pages?.competitor_domain || 'unknown',
    severity: (r.severity || 'medium') as EventSeverity,
    title: r.diff_summary || 'Page change detected',
    body: r.classifier_reason || undefined,
    url: r.kotoiq_tracked_pages?.url,
    metadata: { page_type: r.kotoiq_tracked_pages?.page_type },
    occurred_at: r.detected_at,
  }))
}

async function loadPricingEvents(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  // Find pricing pages then compare consecutive snapshots
  const { data: pages } = await s.from('kotoiq_tracked_pages')
    .select('id, url, competitor_domain')
    .eq('client_id', client_id)
    .eq('is_active', true)
    .eq('page_type', 'pricing')

  if (!pages?.length) return []
  const events: UnifiedEvent[] = []

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
      const captured_at = snaps[i].captured_at
      const idBase = `pricing:${snaps[i].id}`

      const prevTiers = new Map<string, any>((prev.tiers || []).map((t: any) => [t.name, t]))
      const currTiers = new Map<string, any>((curr.tiers || []).map((t: any) => [t.name, t]))

      for (const [name, ct] of currTiers) {
        const pt = prevTiers.get(name)
        if (!pt) {
          events.push({
            id: `${idBase}:tier-add:${name}`, source: 'pricing', event_type: 'tier_added',
            competitor: p.competitor_domain, severity: 'high',
            title: `New tier "${name}" added${ct.price ? ` at ${ct.price}` : ''}`,
            url: p.url, occurred_at: captured_at,
          })
        } else if (pt.price !== ct.price) {
          events.push({
            id: `${idBase}:price:${name}`, source: 'pricing', event_type: 'price_changed',
            competitor: p.competitor_domain, severity: 'high',
            title: `"${name}" price: ${pt.price} → ${ct.price}`,
            url: p.url, occurred_at: captured_at,
          })
        }
      }
      for (const [name] of prevTiers) {
        if (!currTiers.has(name)) {
          events.push({
            id: `${idBase}:tier-rm:${name}`, source: 'pricing', event_type: 'tier_removed',
            competitor: p.competitor_domain, severity: 'high',
            title: `Tier "${name}" removed`,
            url: p.url, occurred_at: captured_at,
          })
        }
      }

      if ((prev.promo_detected || null) !== (curr.promo_detected || null)) {
        if (!prev.promo_detected && curr.promo_detected) {
          events.push({
            id: `${idBase}:promo+`, source: 'pricing', event_type: 'promo_added',
            competitor: p.competitor_domain, severity: 'medium',
            title: `Promo started: "${curr.promo_detected}"`,
            url: p.url, occurred_at: captured_at,
          })
        } else if (prev.promo_detected && !curr.promo_detected) {
          events.push({
            id: `${idBase}:promo-`, source: 'pricing', event_type: 'promo_removed',
            competitor: p.competitor_domain, severity: 'low',
            title: `Promo ended: "${prev.promo_detected}"`,
            url: p.url, occurred_at: captured_at,
          })
        }
      }
    }
  }
  return events
}

async function loadYouTubeEvents(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  const { data: videos } = await s.from('kotoiq_competitor_youtube_videos')
    .select('id, video_id, channel_id, title, view_count, published_at')
    .eq('client_id', client_id)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(200)

  if (!videos?.length) return []

  // Resolve channel → brand
  const channelIds = Array.from(new Set(videos.map(v => v.channel_id)))
  const { data: channels } = await s.from('kotoiq_competitor_youtube_channels')
    .select('channel_id, brand_name, channel_title')
    .in('channel_id', channelIds)
  const brandByChannel = new Map<string, string>()
  for (const c of channels || []) {
    brandByChannel.set(c.channel_id, c.brand_name || c.channel_title || c.channel_id)
  }

  return videos.map(v => ({
    id: `youtube:${v.id}`,
    source: 'youtube' as EventSource,
    event_type: 'new_upload',
    competitor: brandByChannel.get(v.channel_id) || v.channel_id,
    severity: 'info' as EventSeverity,
    title: v.title || 'New video',
    body: `${(v.view_count || 0).toLocaleString()} views`,
    url: `https://www.youtube.com/watch?v=${v.video_id}`,
    metadata: { view_count: v.view_count },
    occurred_at: v.published_at,
  }))
}

async function loadAdEvents(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  const { data: ads } = await s.from('kotoiq_competitor_ads')
    .select('id, source, brand_name, page_name, headline, body_text, platforms, creative_snapshot_url, delivery_start, detected_at')
    .eq('client_id', client_id)
    .gte('detected_at', since)
    .order('detected_at', { ascending: false })
    .limit(200)

  return (ads || []).map(a => ({
    id: `ad:${a.id}`,
    source: 'ad' as EventSource,
    event_type: 'ad_discovered',
    competitor: a.brand_name,
    severity: 'medium' as EventSeverity,
    title: a.headline || a.body_text?.slice(0, 100) || `New ${a.source} ad`,
    body: a.platforms?.length ? `Platforms: ${a.platforms.join(', ')}` : undefined,
    url: a.creative_snapshot_url || undefined,
    metadata: { source: a.source, platforms: a.platforms },
    occurred_at: a.delivery_start || a.detected_at,
  }))
}

async function loadEmailEvents(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  const { data: emails } = await s.from('kotoiq_competitor_emails')
    .select('id, brand_name, subject, preview_text, journey_stage, promo_detected, sent_at, received_at')
    .eq('client_id', client_id)
    .gte('received_at', since)
    .order('sent_at', { ascending: false })
    .limit(200)

  return (emails || []).map(e => ({
    id: `email:${e.id}`,
    source: 'email' as EventSource,
    event_type: e.journey_stage === 'promo' ? 'email_promo' : 'email_received',
    competitor: e.brand_name,
    severity: (e.journey_stage === 'promo' ? 'medium' : 'info') as EventSeverity,
    title: e.subject || '(no subject)',
    body: e.promo_detected ? `Promo: ${e.promo_detected}` : (e.preview_text || '').slice(0, 140),
    metadata: { journey_stage: e.journey_stage, promo: e.promo_detected },
    occurred_at: e.sent_at || e.received_at,
  }))
}

async function loadAeoEvents(s: SupabaseClient, client_id: string, since: string): Promise<UnifiedEvent[]> {
  // For each (prompt, engine) compute "first appearance" / "lost mention"
  // by looking at consecutive runs. v1: emit one event per run where
  // client_mentioned flipped from prior run.
  const { data: runs } = await s.from('kotoiq_aeo_runs')
    .select('id, prompt_id, engine, client_mentioned, client_position, run_at, kotoiq_aeo_prompts!inner(prompt)')
    .eq('client_id', client_id)
    .gte('run_at', since)
    .order('run_at', { ascending: true })

  if (!runs?.length) return []

  // Track last state per (prompt, engine)
  const lastByPair = new Map<string, boolean>()
  const events: UnifiedEvent[] = []

  for (const r of runs) {
    const key = `${r.prompt_id}:${r.engine}`
    const prev = lastByPair.get(key)
    const curr = !!r.client_mentioned
    if (prev !== undefined && prev !== curr) {
      events.push({
        id: `aeo:${r.id}`,
        source: 'aeo',
        event_type: curr ? 'mention_gained' : 'mention_lost',
        competitor: 'you', // mention events are about the client itself relative to AI engines
        severity: curr ? 'medium' : 'high',
        title: curr
          ? `Now mentioned in ${r.engine} for "${(r as any).kotoiq_aeo_prompts?.prompt?.slice(0, 80) || 'a prompt'}"`
          : `No longer mentioned in ${r.engine} for "${(r as any).kotoiq_aeo_prompts?.prompt?.slice(0, 80) || 'a prompt'}"`,
        body: curr && r.client_position ? `Position ${r.client_position}` : undefined,
        metadata: { engine: r.engine, position: r.client_position },
        occurred_at: r.run_at,
      })
    }
    lastByPair.set(key, curr)
  }

  return events
}

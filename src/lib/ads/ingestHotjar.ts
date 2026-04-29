// ─────────────────────────────────────────────────────────────
// Behavior Analytics — Hotjar ingestion
// Pulls session data + heatmap summaries from Hotjar API
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const HOTJAR_API = 'https://insights.hotjar.com/api/v2'

export async function ingestHotjar(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string; days?: number }
): Promise<{ sessions_synced: number; heatmaps_synced: number; errors: string[] }> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')
  const days = body.days ?? 7

  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'hotjar').single()
  if (!conn) throw new Error('No Hotjar connection found. Add your API token in KotoIQ Connect APIs.')

  const token = conn.access_token
  const siteId = conn.account_id || conn.external_id
  if (!token || !siteId) throw new Error('Hotjar API token or Site ID missing.')

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  const result = { sessions_synced: 0, heatmaps_synced: 0, errors: [] as string[] }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  // ── Session/Recording data ─────────────────────────────────
  try {
    const res = await fetch(`${HOTJAR_API}/sites/${siteId}/recordings?date_from=${fmt(startDate)}&date_to=${fmt(endDate)}&count=100`, { headers })
    if (!res.ok) throw new Error(`Hotjar recordings API ${res.status}`)
    const data = await res.json()

    // Aggregate by page URL + date
    const pageAgg = new Map<string, {
      date: string; page_url: string; sessions: number; recordings_count: number;
      rage_clicks: number; dead_clicks: number; scroll_depth_sum: number; count: number
    }>()

    for (const rec of data.recordings || data.data || []) {
      const pageUrl = rec.landing_page || rec.url || '/'
      const date = (rec.created_date || rec.created_at || fmt(endDate)).split('T')[0]
      const key = `${date}|${pageUrl}`
      const existing = pageAgg.get(key) || {
        date, page_url: pageUrl, sessions: 0, recordings_count: 0,
        rage_clicks: 0, dead_clicks: 0, scroll_depth_sum: 0, count: 0,
      }
      existing.sessions++
      existing.recordings_count++
      existing.rage_clicks += rec.rage_clicks || 0
      existing.dead_clicks += rec.dead_clicks || 0
      existing.scroll_depth_sum += rec.scroll_depth || 0
      existing.count++
      pageAgg.set(key, existing)
    }

    for (const agg of pageAgg.values()) {
      await s.from('kotoiq_behavior_sessions').upsert({
        client_id,
        agency_id: agency_id || null,
        provider: 'hotjar',
        date: agg.date,
        page_url: agg.page_url,
        sessions: agg.sessions,
        recordings_count: agg.recordings_count,
        rage_clicks: agg.rage_clicks,
        dead_clicks: agg.dead_clicks,
        scroll_depth_avg: agg.count > 0 ? agg.scroll_depth_sum / agg.count : null,
      }, { onConflict: 'client_id,provider,date,page_url,COALESCE(device,\'\')' })
      result.sessions_synced++
    }
  } catch (e: any) {
    result.errors.push(`Sessions: ${e.message}`)
  }

  // ── Heatmap summaries ──────────────────────────────────────
  try {
    const res = await fetch(`${HOTJAR_API}/sites/${siteId}/heatmaps?count=50`, { headers })
    if (!res.ok) throw new Error(`Hotjar heatmaps API ${res.status}`)
    const data = await res.json()

    for (const hm of data.heatmaps || data.data || []) {
      await s.from('kotoiq_behavior_heatmaps').upsert({
        client_id,
        provider: 'hotjar',
        page_url: hm.url || hm.page_url || '/',
        heatmap_type: hm.type || 'click',
        device: hm.device || 'desktop',
        sample_count: hm.num_sessions || hm.sample_count || 0,
        snapshot_url: hm.screenshot_url || null,
        top_elements: hm.top_clicks || [],
        metadata: { name: hm.name, status: hm.status },
      }, { onConflict: 'client_id,provider,page_url,COALESCE(heatmap_type,\'\'),COALESCE(device,\'\')' })
      result.heatmaps_synced++
    }
  } catch (e: any) {
    result.errors.push(`Heatmaps: ${e.message}`)
  }

  return result
}

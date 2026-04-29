// ─────────────────────────────────────────────────────────────
// Behavior Analytics — Microsoft Clarity ingestion
// Pulls page-level metrics: scroll depth, rage clicks, dead clicks
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const CLARITY_API = 'https://www.clarity.ms/api/v1'

export async function ingestClarity(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string; days?: number }
): Promise<{ sessions_synced: number; errors: string[] }> {
  const { client_id, agency_id } = body
  if (!client_id) throw new Error('client_id required')
  const days = body.days ?? 7

  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'clarity').single()
  if (!conn) throw new Error('No Clarity connection found. Add your Project ID and API key in KotoIQ Connect APIs.')

  const apiKey = conn.access_token
  const projectId = conn.account_id || conn.external_id
  if (!apiKey || !projectId) throw new Error('Clarity API key or Project ID missing.')

  const result = { sessions_synced: 0, errors: [] as string[] }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  // ── Export page-level metrics ──────────────────────────────
  try {
    const res = await fetch(`${CLARITY_API}/projects/${projectId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        metrics: ['sessions', 'rageClicks', 'deadClicks', 'quickBacks', 'scrollDepth'],
        dimensions: ['pageUrl', 'device'],
        granularity: 'daily',
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Clarity API ${res.status}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json()
    const rows = data.rows || data.data || data.results || []

    for (const row of rows) {
      const pageUrl = row.pageUrl || row.page_url || row.url || '/'
      const device = row.device || null
      const date = row.date || fmt(endDate)

      await s.from('kotoiq_behavior_sessions').upsert({
        client_id,
        agency_id: agency_id || null,
        provider: 'clarity',
        date,
        page_url: pageUrl,
        sessions: Number(row.sessions || 0),
        recordings_count: 0,
        rage_clicks: Number(row.rageClicks || row.rage_clicks || 0),
        dead_clicks: Number(row.deadClicks || row.dead_clicks || 0),
        quick_backs: Number(row.quickBacks || row.quick_backs || 0),
        scroll_depth_avg: row.scrollDepth ? Number(row.scrollDepth) : null,
        device,
      }, { onConflict: 'client_id,provider,date,page_url,COALESCE(device,\'\')' })
      result.sessions_synced++
    }
  } catch (e: any) {
    result.errors.push(`Export: ${e.message}`)
  }

  return result
}

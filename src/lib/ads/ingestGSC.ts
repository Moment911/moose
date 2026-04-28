// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Google Search Console ingestion
// Reuses seoService.js fetch functions, writes to kotoiq_ads_fact_gsc
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function ingestGSC(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string; days?: number }
): Promise<{ rows_synced: number }> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')
  const days = body.days ?? 30

  // Get the GSC connection
  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'gsc').single()
  if (!conn) throw new Error('No Search Console connection for this client')

  // Dynamically import seoService to get token + fetch
  const { getAccessToken, fetchSearchConsoleData } = await import('@/lib/seoService')
  const token = await getAccessToken(conn)
  const siteUrl = conn.site_url || conn.external_id

  // Calculate date range (GSC has ~2 day lag)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 2)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const rawData = await fetchSearchConsoleData(token, siteUrl, fmt(startDate), fmt(endDate))
  if (!rawData?.rows?.length) return { rows_synced: 0 }

  let count = 0
  for (const row of rawData.rows) {
    const keys = row.keys || []
    const [date, query, page, country, device] = [
      keys[0] || fmt(endDate),
      keys[1] || '',
      keys[2] || null,
      keys[3] || null,
      keys[4] || null,
    ]
    if (!query) continue

    await s.from('kotoiq_ads_fact_gsc').upsert({
      client_id,
      date,
      query,
      page,
      country,
      device,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      position: row.position || null,
    }, { onConflict: 'client_id,date,query,COALESCE(page,\'\'),COALESCE(country,\'\'),COALESCE(device,\'\')' })
    count++
  }

  return { rows_synced: count }
}

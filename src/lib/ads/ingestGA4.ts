// ─────────────────────────────────────────────────────────────
// Ads Intelligence — GA4 ingestion
// Reuses seoService.js fetch, writes to kotoiq_ads_fact_ga4
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function ingestGA4(
  s: SupabaseClient,
  body: { client_id: string; agency_id?: string; days?: number }
): Promise<{ rows_synced: number }> {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')
  const days = body.days ?? 30

  // Get GA4 connection
  const { data: conn } = await s.from('seo_connections')
    .select('*').eq('client_id', client_id).eq('provider', 'ga4').single()
  if (!conn) throw new Error('No GA4 connection for this client')

  const { getAccessToken, fetchGA4Data } = await import('@/lib/seoService')
  const token = await getAccessToken(conn)
  const propertyId = conn.property_id || conn.external_id

  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const rawData = await fetchGA4Data(token, propertyId, fmt(startDate), fmt(endDate))
  if (!rawData?.rows?.length) return { rows_synced: 0 }

  let count = 0
  for (const row of rawData.rows) {
    const dims = row.dimensionValues || []
    const mets = row.metricValues || []

    // GA4 date format is YYYYMMDD
    const rawDate = dims[0]?.value || ''
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : fmt(endDate)

    await s.from('kotoiq_ads_fact_ga4').upsert({
      client_id,
      date,
      source: dims[1]?.value || null,
      medium: dims[2]?.value || null,
      campaign: dims[3]?.value || null,
      landing_page: dims[4]?.value || null,
      sessions: Number(mets[0]?.value || 0),
      engaged_sessions: Number(mets[1]?.value || 0),
      conversions: Number(mets[2]?.value || 0),
      revenue: Number(mets[3]?.value || 0),
    }, {
      onConflict: 'client_id,date,COALESCE(source,\'\'),COALESCE(medium,\'\'),COALESCE(campaign,\'\'),COALESCE(landing_page,\'\')',
    })
    count++
  }

  return { rows_synced: count }
}

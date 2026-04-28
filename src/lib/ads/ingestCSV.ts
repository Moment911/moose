// ─────────────────────────────────────────────────────────────
// Ads Intelligence — CSV fallback ingestion
// Parses Google Ads Editor exports, writes to kotoiq_ads_* tables
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CSVRow {
  [key: string]: string
}

function parseCSV(raw: string): CSVRow[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  // Google Ads CSVs often have preamble lines before the actual header
  let headerIdx = lines.findIndex((l) =>
    l.toLowerCase().includes('campaign') && l.toLowerCase().includes('impressions')
  )
  if (headerIdx === -1) headerIdx = 0

  const headers = lines[headerIdx].split(',').map((h) => h.trim().replace(/"/g, '').toLowerCase().replace(/\s+/g, '_'))
  const rows: CSVRow[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    if (vals.length < headers.length) continue
    const row: CSVRow = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    rows.push(row)
  }
  return rows
}

export async function ingestCSV(
  s: SupabaseClient,
  body: {
    client_id: string
    agency_id?: string
    csv_content: string
    source: 'search_terms' | 'keywords' | 'campaigns'
    filename?: string
  }
): Promise<{ rows_imported: number; errors: string[] }> {
  const { client_id, agency_id, csv_content, source, filename } = body
  if (!client_id) throw new Error('client_id required')
  if (!csv_content) throw new Error('csv_content required')

  const rows = parseCSV(csv_content)
  if (!rows.length) throw new Error('No data rows found in CSV')

  const errors: string[] = []
  let imported = 0

  // Log the upload
  await s.from('kotoiq_ads_raw_uploads').insert({
    client_id,
    agency_id: agency_id || null,
    source,
    filename: filename || 'upload.csv',
    rows_imported: rows.length,
    status: 'processing',
  })

  const today = new Date().toISOString().split('T')[0]

  if (source === 'campaigns') {
    for (const row of rows) {
      try {
        const externalId = row.campaign_id || row.id || String(Math.random())
        await s.from('kotoiq_ads_campaigns').upsert({
          client_id,
          agency_id: agency_id || null,
          platform: 'google_ads',
          external_id: externalId,
          name: row.campaign || row.campaign_name || 'Unknown',
          status: row.status || row.campaign_state || 'ENABLED',
          channel: row.campaign_type || row.type || null,
          budget_usd: row.budget ? Number(row.budget) : null,
        }, { onConflict: 'client_id,platform,external_id' })
        imported++
      } catch (e: any) {
        errors.push(`Row ${imported}: ${e.message}`)
      }
    }
  } else if (source === 'search_terms') {
    for (const row of rows) {
      try {
        const searchTerm = row.search_term || row.query || ''
        if (!searchTerm) continue

        await s.from('kotoiq_ads_fact_search_terms').upsert({
          client_id,
          date: row.date || row.day || today,
          search_term: searchTerm,
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          cost_micros: row.cost_micros ? Number(row.cost_micros) : Math.round(Number(row.cost || 0) * 1e6),
          conversions: Number(row.conversions || 0),
          conversion_value: Number(row.conversion_value || row.conv__value || 0),
        }, { onConflict: 'client_id,date,ad_group_id,search_term', ignoreDuplicates: true })
        imported++
      } catch (e: any) {
        errors.push(`Row ${imported}: ${e.message}`)
      }
    }
  } else if (source === 'keywords') {
    for (const row of rows) {
      try {
        const kwText = row.keyword || row.keyword_text || ''
        if (!kwText) continue

        // For CSV keywords, we may not have ad group references — store as orphan fact
        await s.from('kotoiq_ads_fact_search_terms').upsert({
          client_id,
          date: row.date || row.day || today,
          search_term: kwText,
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          cost_micros: row.cost_micros ? Number(row.cost_micros) : Math.round(Number(row.cost || 0) * 1e6),
          conversions: Number(row.conversions || 0),
          conversion_value: Number(row.conversion_value || 0),
        }, { onConflict: 'client_id,date,ad_group_id,search_term', ignoreDuplicates: true })
        imported++
      } catch (e: any) {
        errors.push(`Row ${imported}: ${e.message}`)
      }
    }
  }

  // Update upload record
  await s.from('kotoiq_ads_raw_uploads')
    .update({ rows_imported: imported, status: errors.length ? 'partial' : 'complete' })
    .eq('client_id', client_id)
    .order('uploaded_at', { ascending: false })
    .limit(1)

  return { rows_imported: imported, errors }
}

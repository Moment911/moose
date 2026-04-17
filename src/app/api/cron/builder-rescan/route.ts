import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rescanPublishedPages } from '../../../../lib/builder/rescanEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (!auth.includes(secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = sb()

  const { data: sites } = await supabase
    .from('kotoiq_builder_sites')
    .select('site_id, agency_id')
    .not('agency_id', 'is', null)

  const results: Array<{ site_id: string; agency_id: string; summary: any; error?: string }> = []

  for (const site of sites || []) {
    try {
      const summary = await rescanPublishedPages(site.site_id, site.agency_id)
      results.push({ site_id: site.site_id, agency_id: site.agency_id, summary })
    } catch (e: any) {
      console.error('[builder-rescan cron] site failed', site.site_id, e?.message)
      results.push({ site_id: site.site_id, agency_id: site.agency_id, summary: null, error: e?.message })
    }
  }

  const totalScanned = results.reduce((sum, r) => sum + (r.summary?.pages_scanned || 0), 0)
  const totalDecay = results.reduce((sum, r) => sum + (r.summary?.decay_detected || 0), 0)

  return NextResponse.json({
    ok: true,
    sites_processed: results.length,
    total_pages_scanned: totalScanned,
    total_decay_detected: totalDecay,
    results,
  })
}

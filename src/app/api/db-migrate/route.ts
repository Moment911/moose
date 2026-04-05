import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Tables to verify exist — if any are missing, we need migration
const CHECK_TABLES = [
  'local_rank_scans',
  'local_rank_grid_scans',
  'seo_keyword_tracking',
  'seo_connections',
  'seo_reports',
  'wp_seo_sites',
]

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=id&limit=0`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    return res.status !== 404 && res.status !== 400
  } catch {
    return false
  }
}

export async function GET() {
  if (!SUPABASE_URL) return NextResponse.json({ error: 'No Supabase URL' }, { status: 500 })

  const results: Record<string, boolean> = {}
  const missing: string[] = []

  for (const table of CHECK_TABLES) {
    const exists = await tableExists(table)
    results[table] = exists
    if (!exists) missing.push(table)
  }

  return NextResponse.json({
    tables: results,
    missing,
    all_ready: missing.length === 0,
    setup_instructions: missing.length > 0 ? {
      message: `${missing.length} table(s) need to be created`,
      missing_tables: missing,
      action: 'Run RUN_THIS_NOW_consolidated.sql in your Supabase SQL Editor',
      supabase_url: SUPABASE_URL.replace('/rest/v1', '').replace('https://', 'https://supabase.com/dashboard/project/') + '/editor',
    } : null,
  })
}

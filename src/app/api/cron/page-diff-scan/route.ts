// ─────────────────────────────────────────────────────────────
// Page Diff Scan — daily cron (Phase B)
//
// Runs every day at 4am UTC. Loops every client that has at
// least one active tracked page and runs runPageDiffNow per
// client (which respects the 2s stagger between page fetches).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runPageDiffNow } from '@/lib/kotoiq/pageDiffEngine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s = sb()

  // Distinct client_ids with at least one active tracked page
  const { data: rows, error } = await s
    .from('kotoiq_tracked_pages')
    .select('client_id')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clientIds = Array.from(new Set((rows || []).map(r => r.client_id))).filter(Boolean)
  if (!clientIds.length) return NextResponse.json({ message: 'No active tracked pages', ran: 0 })

  const { data: clients } = await s
    .from('clients')
    .select('id, agency_id')
    .in('id', clientIds)
    .is('deleted_at', null)

  const results: any[] = []
  for (const c of clients || []) {
    try {
      const out = await runPageDiffNow(s, { client_id: c.id, agency_id: c.agency_id })
      results.push({ client_id: c.id, status: 'ok', ...out })
    } catch (err: any) {
      results.push({ client_id: c.id, status: 'error', error: err?.message || String(err) })
    }
  }

  return NextResponse.json({
    ran: results.length,
    total_clients: clientIds.length,
    results,
    completed_at: new Date().toISOString(),
  })
}

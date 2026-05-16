// ─────────────────────────────────────────────────────────────
// AEO Visibility Scan — weekly cron
//
// Runs once per week (Mondays 3am UTC per vercel.json) and scans
// every client that has at least one active AEO prompt + at least
// one tracked competitor brand. Skips clients with no setup.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAEOVisibilityScan } from '@/lib/kotoiq/aeoVisibilityEngine'

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

  // Pull distinct client_ids that have at least one active prompt
  const { data: promptClients, error: pErr } = await s
    .from('kotoiq_aeo_prompts')
    .select('client_id')
    .eq('is_active', true)

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  const clientIds = Array.from(new Set((promptClients || []).map(r => r.client_id))).filter(Boolean)

  if (!clientIds.length) {
    return NextResponse.json({ message: 'No clients with active AEO prompts', ran: 0 })
  }

  // Pull agency_id for each client for token-usage attribution
  const { data: clients } = await s
    .from('clients')
    .select('id, agency_id')
    .in('id', clientIds)
    .is('deleted_at', null)

  const results: any[] = []
  for (const c of clients || []) {
    try {
      const out = await runAEOVisibilityScan(s, { client_id: c.id, agency_id: c.agency_id })
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

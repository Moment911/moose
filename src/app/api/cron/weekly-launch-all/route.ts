import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Weekly Launch All cron — fires run_all_audits for every active client.
 *
 * Schedule: every Monday at 5:00 AM UTC (configured in vercel.json).
 *
 * Per-client opt-out via clients.metadata.cron_weekly_audit_enabled = false.
 * Defaults to opt-in for any client with a website.
 *
 * Auth: Vercel cron sends Authorization: Bearer ${CRON_SECRET}.
 *
 * Stagger: fires audits with a 4-second gap between clients so we don't
 * stampede DataForSEO / Anthropic / Google with hundreds of concurrent
 * requests. run_all_audits is itself fire-and-forget on the server, so
 * each call returns immediately and the cron job finishes fast.
 */

const STAGGER_MS = 4_000

export const maxDuration = 300

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s = sb()

  // Pull every active client with a website. Skip clients that have
  // explicitly opted out via metadata.cron_weekly_audit_enabled === false.
  const { data: clients, error } = await s.from('clients')
    .select('id, name, website, agency_id, primary_service, metadata')
    .is('deleted_at', null)
    .not('website', 'is', null)
    .neq('website', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eligible = (clients || []).filter((c: any) => {
    const optOut = c.metadata?.cron_weekly_audit_enabled === false
    return !optOut
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
  const triggered: string[] = []
  const skipped: { client_id: string; reason: string }[] = []

  for (const c of eligible) {
    try {
      // run_all_audits is fire-and-forget — it returns a run_id immediately
      // and processes waves in a background promise. So we can iterate fast.
      const res = await fetch(`${appUrl}/api/kotoiq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_all_audits',
          client_id: c.id,
          agency_id: c.agency_id,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) {
        triggered.push(c.id)
      } else {
        skipped.push({ client_id: c.id, reason: `http_${res.status}` })
      }
    } catch (e: any) {
      skipped.push({ client_id: c.id, reason: e?.message || 'fetch_failed' })
    }

    // Stagger so we don't pile concurrent runs onto the API
    if (eligible.indexOf(c) < eligible.length - 1) {
      await new Promise(r => setTimeout(r, STAGGER_MS))
    }
  }

  return NextResponse.json({
    ok: true,
    eligible_clients: eligible.length,
    triggered: triggered.length,
    skipped: skipped.length,
    skipped_detail: skipped.slice(0, 20),
    timestamp: new Date().toISOString(),
  })
}

// Allow POST too so the cron can be triggered manually from a webhook
// without changing the auth dance.
export const POST = GET

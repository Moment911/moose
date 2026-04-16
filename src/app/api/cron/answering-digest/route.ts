// Weekly digest cron — fires every Monday morning per vercel.json schedule.
// Iterates active agencies and POSTs send_digest into the inbound API per agency.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  // Vercel cron passes a bearer token; if CRON_SECRET is set, require it.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (!auth.includes(secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = sb()
  // Find every agency that has at least one answering agent — we only digest active ones.
  const { data: agencyRows } = await supabase
    .from('koto_inbound_agents')
    .select('agency_id')
    .not('agency_id', 'is', null)
  const agencies = Array.from(new Set((agencyRows || []).map((r: any) => r.agency_id)))

  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${req.nextUrl.host}`
  let sent = 0
  for (const agency_id of agencies) {
    try {
      const res = await fetch(`${base}/api/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_digest', agency_id, days: 7 }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.success) sent += d.digests_sent || 0
    } catch (e: any) {
      console.error('[answering-digest cron] agency failed', agency_id, e?.message)
    }
  }

  return NextResponse.json({ ok: true, agencies: agencies.length, digests_sent: sent })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getSupabase()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

  // Get all enabled agents
  const { data: configs } = await sb.from('agent_configs')
    .select('client_id, agency_id, schedule_weekly, schedule_daily')
    .eq('enabled', true)
    .eq('onboarding_done', true)

  if (!configs?.length) return NextResponse.json({ message: 'No enabled agents', ran: 0 })

  const now    = new Date()
  const isMonday  = now.getDay() === 1
  const results: any[] = []

  for (const config of configs) {
    try {
      const runType = isMonday ? 'weekly' : 'daily'
      if (runType === 'daily' && !config.schedule_daily) continue

      const res = await fetch(`${baseUrl}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.client_id,
          agency_id: config.agency_id,
          run_type:  runType,
        }),
      })
      const data = await res.json()
      results.push({ client_id: config.client_id, status: 'ok', run_id: data.run_id })
    } catch (e: any) {
      results.push({ client_id: config.client_id, status: 'error', error: e.message })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

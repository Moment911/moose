import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all clients that have an active ads connection
  const { data: connections } = await getSupabase()
    .from('seo_connections')
    .select('client_id, account_id, agency_id:clients(agency_id)')
    .eq('provider', 'ads')
    .eq('connected', true)

  if (!connections?.length) {
    return NextResponse.json({ message: 'No connected clients', synced: 0 })
  }

  const results = []
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

  for (const conn of connections) {
    try {
      // Sync data
      const syncRes = await fetch(`${baseUrl}/api/perf/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: conn.client_id }),
      })
      const syncData = await syncRes.json()

      // Run rules + analysis
      const analyzeRes = await fetch(`${baseUrl}/api/perf/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: conn.client_id }),
      })
      const analyzeData = await analyzeRes.json()

      results.push({
        clientId: conn.client_id,
        synced:   syncData,
        analyzed: analyzeData,
        status:   'ok',
      })
    } catch(e: any) {
      results.push({ clientId: conn.client_id, status: 'error', error: e.message })
    }

    // Send weekly report every Monday
    const isMonday = new Date().getDay() === 1
    if (isMonday) {
      try {
        await fetch(`${baseUrl}/api/perf/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: conn.client_id, period: '7d' }),
        })
      } catch {}
    }

    // Rate limit: 2 second gap between clients
    await new Promise(r => setTimeout(r, 2000))
  }

  return NextResponse.json({
    ran_at:  new Date().toISOString(),
    clients: results.length,
    results,
  })
}
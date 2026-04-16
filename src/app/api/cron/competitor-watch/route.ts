import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { runCompetitorWatchCheck } from '@/lib/competitorWatchEngine'

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
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

  const { data: watches } = await s.from('kotoiq_competitor_watches')
    .select('id, client_id, check_frequency')
    .eq('active', true)

  if (!watches?.length) return NextResponse.json({ message: 'No active watches', ran: 0 })

  // Optional frequency filter — 'daily' runs every day, 'weekly' runs on Mondays
  const today = new Date().getDay()
  const eligible = watches.filter((w: any) =>
    w.check_frequency !== 'weekly' || today === 1
  )

  const results: any[] = []
  for (const watch of eligible) {
    try {
      const result = await runCompetitorWatchCheck(s, ai, { watch_id: watch.id, client_id: watch.client_id })
      results.push({ watch_id: watch.id, status: 'ok', ...result })
    } catch (err: any) {
      results.push({ watch_id: watch.id, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ran: results.length, skipped: watches.length - eligible.length, results })
}

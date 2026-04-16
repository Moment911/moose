import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { sendDailyDigest } from '@/lib/slackTeamsIntegration'

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

  const { data: integrations } = await s.from('kotoiq_integrations')
    .select('client_id, agency_id')
    .eq('active', true)
    .in('integration_type', ['slack', 'teams'])

  if (!integrations?.length) return NextResponse.json({ message: 'No integrations configured', ran: 0 })

  // Unique scopes (client or agency) to avoid sending duplicate digests
  const seen = new Set<string>()
  const scopes: Array<{ client_id?: string; agency_id?: string }> = []
  for (const i of integrations) {
    const key = i.client_id ? `c:${i.client_id}` : i.agency_id ? `a:${i.agency_id}` : ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    scopes.push({ client_id: i.client_id || undefined, agency_id: i.agency_id || undefined })
  }

  const results: any[] = []
  for (const scope of scopes) {
    try {
      const r = await sendDailyDigest(s, ai, scope)
      results.push({ scope, status: 'ok', ...r })
    } catch (err: any) {
      results.push({ scope, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

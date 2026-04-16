import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { calculateIndustryBenchmarks } from '@/lib/industryBenchmarkEngine'

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

  try {
    const result = await calculateIndustryBenchmarks(s, ai)
    return NextResponse.json({ status: 'ok', ...result })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}

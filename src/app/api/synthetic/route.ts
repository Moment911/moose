import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateSyntheticCallBatch,
  generateAllIndustrySyntheticData,
  getSyntheticStatus,
} from '@/lib/syntheticCallGenerator'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'get_status'

    if (action === 'get_status') {
      const status = await getSyntheticStatus()
      return Response.json({ data: status })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action

    if (action === 'generate_industry') {
      const { sic_code, industry_name } = body
      if (!sic_code || !industry_name) {
        return Response.json({ error: 'sic_code and industry_name required' }, { status: 400 })
      }
      const result = await generateSyntheticCallBatch(sic_code, industry_name)
      return Response.json({ success: true, data: result })
    }

    if (action === 'generate_all') {
      const result = await generateAllIndustrySyntheticData()
      return Response.json({ success: true, data: result })
    }

    if (action === 'clear_synthetic') {
      const s = sb()
      await s.from('koto_voice_calls').delete().eq('is_synthetic', true)
      await s.from('koto_voice_leads').delete().eq('is_synthetic', true)
      return Response.json({ success: true, message: 'All synthetic data cleared' })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Synthetic API error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

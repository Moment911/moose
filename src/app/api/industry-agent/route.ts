import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getIndustryConfig,
  generateIndustryLLMConfig,
  generateIndustryQABank,
  refreshIndustryFromCalls,
} from '@/lib/industryLLMEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list_industries'
    const s = sb()

    if (action === 'list_industries') {
      const { data } = await s
        .from('koto_industry_intelligence')
        .select('industry_sic_code, industry_name, confidence_score, total_calls, total_appointments, avg_appointment_rate')
        .order('industry_name', { ascending: true })
      return Response.json({ data: data || [] })
    }

    if (action === 'get_industry') {
      const sicCode = searchParams.get('sic_code') || ''
      if (!sicCode) return Response.json({ error: 'sic_code required' }, { status: 400 })

      const [{ data: intel }, config] = await Promise.all([
        s.from('koto_industry_intelligence').select('*').eq('industry_sic_code', sicCode).maybeSingle(),
        getIndustryConfig(sicCode),
      ])

      // Get Q&A count for this industry
      const { count: qaCount } = await s
        .from('koto_qa_intelligence')
        .select('*', { count: 'exact', head: true })
        .eq('industry_sic_code', sicCode)

      return Response.json({ data: { intelligence: intel, config, qa_count: qaCount || 0 } })
    }

    if (action === 'get_config') {
      const sicCode = searchParams.get('sic_code') || ''
      const config = await getIndustryConfig(sicCode)
      return Response.json({ data: config })
    }

    if (action === 'get_qa_bank') {
      const sicCode = searchParams.get('sic_code') || ''
      const { data } = await s
        .from('koto_qa_intelligence')
        .select('*, koto_answer_intelligence(answer_text, answer_type, effectiveness_score)')
        .eq('industry_sic_code', sicCode)
        .order('appointment_rate_when_asked', { ascending: false })
        .limit(30)
      return Response.json({ data: data || [] })
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

    if (action === 'generate_config') {
      const { sic_code, industry_name } = body
      if (!sic_code || !industry_name) return Response.json({ error: 'sic_code and industry_name required' }, { status: 400 })
      const config = await generateIndustryLLMConfig(sic_code, industry_name)
      return Response.json({ success: true, config })
    }

    if (action === 'generate_qa_bank') {
      const { sic_code, industry_name } = body
      if (!sic_code || !industry_name) return Response.json({ error: 'sic_code and industry_name required' }, { status: 400 })
      const inserted = await generateIndustryQABank(sic_code, industry_name)
      return Response.json({ success: true, inserted })
    }

    if (action === 'refresh_from_calls') {
      const { sic_code } = body
      if (!sic_code) return Response.json({ error: 'sic_code required' }, { status: 400 })
      await refreshIndustryFromCalls(sic_code)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

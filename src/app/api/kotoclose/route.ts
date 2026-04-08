import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'check_access'
    const agencyId = searchParams.get('agency_id') || '00000000-0000-0000-0000-000000000099'
    const s = sb()

    if (action === 'check_access') {
      const { data } = await s.from('kc_agency_access').select('*').eq('agency_id', agencyId).maybeSingle()
      if (!data) return Response.json({ enabled: false, error: 'No KotoClose access' })
      return Response.json({
        enabled: data.kotoclose_enabled,
        plan_tier: data.plan_tier,
        features: {
          intelligence: data.feature_intelligence,
          rvm: data.feature_rvm,
          ghl: data.feature_ghl,
          brain_builder: data.feature_brain_builder,
          dnc_scrub: data.feature_dnc_scrub,
        },
        limits: {
          max_daily_calls: data.max_daily_calls,
          max_campaigns: data.max_campaigns,
        },
      })
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
    const s = sb()

    if (action === 'update_access') {
      const { agency_id, ...updates } = body
      delete updates.action
      await s.from('kc_agency_access').update({ ...updates, updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

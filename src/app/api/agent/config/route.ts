import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { client_id, agency_id, ...config } = body
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const sb = getSupabase()
    const { data, error } = await sb.from('agent_configs').upsert({
      client_id, agency_id, ...config, updated_at: new Date().toISOString()
    }, { onConflict: 'client_id' }).select().single()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

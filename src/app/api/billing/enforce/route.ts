import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_LIMITS: Record<string,{clients:number,seats:number}> = {
  starter: { clients: 25,     seats: 3  },
  growth:  { clients: 100,    seats: 10 },
  agency:  { clients: 999999, seats: 999999 },
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { agency_id, check } = await req.json()
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const sb = getSupabase()

    // Get plan from billing accounts (primary) or subscriptions (legacy)
    const { data: billing } = await sb.from('koto_billing_accounts').select('plan,status').eq('agency_id', agency_id).single()
    const { data: sub } = !billing ? await sb.from('subscriptions').select('plan,status').eq('agency_id', agency_id).single() : { data: null }
    const acct = billing || sub
    const plan    = acct?.plan || 'starter'
    const limits  = PLAN_LIMITS[plan] || PLAN_LIMITS.starter
    const isActive = ['active','trialing'].includes(acct?.status || '') || !!billing

    // Get current usage
    const [{ count: clientCount }, { count: memberCount }] = await Promise.all([
      sb.from('clients').select('*', { count: 'exact', head: true }).eq('agency_id', agency_id).eq('status','active'),
      sb.from('agency_members').select('*', { count: 'exact', head: true }).eq('agency_id', agency_id),
    ])

    const usage = {
      clients:      clientCount || 0,
      seats:        memberCount || 0,
      plan,
      plan_status:  sub?.status || 'none',
      is_active:    isActive,
      limits,
      at_limit: {
        clients: (clientCount || 0) >= limits.clients,
        seats:   (memberCount || 0) >= limits.seats,
      },
      over_limit: {
        clients: (clientCount || 0) > limits.clients,
        seats:   (memberCount || 0) > limits.seats,
      },
      pct_used: {
        clients: limits.clients < 999999 ? Math.round((clientCount || 0) / limits.clients * 100) : 0,
        seats:   limits.seats   < 999999 ? Math.round((memberCount || 0) / limits.seats   * 100) : 0,
      },
    }

    // Check specific action
    if (check === 'add_client') {
      if (!isActive) return NextResponse.json({ allowed: false, reason: 'No active subscription', upgrade: true, usage })
      if (usage.at_limit.clients) return NextResponse.json({ allowed: false, reason: `${plan} plan limit is ${limits.clients} active clients`, upgrade: true, usage })
      return NextResponse.json({ allowed: true, usage })
    }

    if (check === 'add_seat') {
      if (!isActive) return NextResponse.json({ allowed: false, reason: 'No active subscription', upgrade: true, usage })
      if (usage.at_limit.seats) return NextResponse.json({ allowed: false, reason: `${plan} plan limit is ${limits.seats} team seats`, upgrade: true, usage })
      return NextResponse.json({ allowed: true, usage })
    }

    return NextResponse.json({ usage })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

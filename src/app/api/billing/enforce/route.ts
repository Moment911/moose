import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PLAN_LIMITS: Record<string, { clients: number; seats: number }> = {
  starter: { clients: 25, seats: 3 },
  growth: { clients: 100, seats: 10 },
  agency: { clients: 999999, seats: 999999 },
}

// Emails that always bypass billing
const SUPER_EMAILS = ['adam@hellokoto.com', 'adam@momentamktg.com']

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function hasActiveAccess(sb: any, agencyId: string): Promise<{ active: boolean; plan: string; reason?: string }> {
  // 1. Check billing account
  const { data: billing } = await sb.from('koto_billing_accounts').select('plan, status').eq('agency_id', agencyId).single()
  if (billing && ['active', 'trialing'].includes(billing.status)) {
    return { active: true, plan: billing.plan || 'starter' }
  }

  // 2. Check promo redemptions with bypass
  const { data: promo } = await sb.from('koto_promo_redemptions')
    .select('*, koto_promo_codes!inner(bypass_subscription, bypass_billing)')
    .eq('agency_id', agencyId).eq('is_active', true)
    .limit(1)
  if (promo && promo.length > 0 && promo[0].koto_promo_codes?.bypass_subscription) {
    return { active: true, plan: billing?.plan || 'agency' }
  }

  // 3. Check legacy subscriptions table
  const { data: sub } = await sb.from('subscriptions').select('plan, status').eq('agency_id', agencyId).single()
  if (sub && ['active', 'trialing'].includes(sub.status)) {
    return { active: true, plan: sub.plan || 'starter' }
  }

  // 4. If billing account exists at all, allow (may be new)
  if (billing) return { active: true, plan: billing.plan || 'starter' }

  // 5. No account found — allow with warning (don't block)
  return { active: true, plan: 'starter', reason: 'No billing account found — using starter defaults' }
}

export async function POST(req: NextRequest) {
  try {
    const { agency_id, check, user_email } = await req.json()
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const sb = getSupabase()

    // Super emails always pass
    if (user_email && SUPER_EMAILS.includes(user_email)) {
      return NextResponse.json({ allowed: true, bypass: true, usage: { plan: 'agency', is_active: true, clients: 0, seats: 0, limits: PLAN_LIMITS.agency } })
    }

    const access = await hasActiveAccess(sb, agency_id)
    const plan = access.plan
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

    // Get current usage
    const [{ count: clientCount }, { count: memberCount }] = await Promise.all([
      sb.from('clients').select('*', { count: 'exact', head: true }).eq('agency_id', agency_id).is('deleted_at', null),
      sb.from('agency_members').select('*', { count: 'exact', head: true }).eq('agency_id', agency_id),
    ])

    const usage = {
      clients: clientCount || 0,
      seats: memberCount || 0,
      plan,
      is_active: access.active,
      warning: access.reason || null,
      limits,
      at_limit: { clients: (clientCount || 0) >= limits.clients, seats: (memberCount || 0) >= limits.seats },
      pct_used: {
        clients: limits.clients < 999999 ? Math.round(((clientCount || 0) / limits.clients) * 100) : 0,
        seats: limits.seats < 999999 ? Math.round(((memberCount || 0) / limits.seats) * 100) : 0,
      },
    }

    // Always allow — show warning instead of blocking
    if (check === 'add_client') {
      if (usage.at_limit.clients) {
        return NextResponse.json({ allowed: false, reason: `${plan} plan limit: ${limits.clients} clients`, upgrade: true, usage })
      }
      return NextResponse.json({ allowed: true, usage })
    }

    if (check === 'add_seat') {
      if (usage.at_limit.seats) {
        return NextResponse.json({ allowed: false, reason: `${plan} plan limit: ${limits.seats} seats`, upgrade: true, usage })
      }
      return NextResponse.json({ allowed: true, usage })
    }

    return NextResponse.json({ allowed: true, usage })
  } catch (e: any) {
    // On error, allow the action (don't block on billing failures)
    return NextResponse.json({ allowed: true, warning: e.message, usage: { plan: 'starter', is_active: true } })
  }
}

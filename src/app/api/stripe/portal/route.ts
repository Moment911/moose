import { NextRequest, NextResponse } from 'next/server'

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { agency_id } = await req.json()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?agency_id=eq.${agency_id}&select=stripe_customer_id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    const subs = await res.json()
    const customerId = subs?.[0]?.stripe_customer_id
    if (!customerId) return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    if (!STRIPE_SECRET) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET)
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${APP_URL}/agency-settings` })
    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

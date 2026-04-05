import { NextRequest, NextResponse } from 'next/server'

const STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY       || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET   || ''
const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function upsertSub(sub: any) {
  const { agency_id, plan } = sub.metadata || {}
  if (!agency_id) return
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Prefer':'resolution=merge-duplicates' },
    body: JSON.stringify({
      agency_id, stripe_customer_id: sub.customer, stripe_subscription_id: sub.id,
      plan: plan||'starter', status: sub.status,
      current_period_start: new Date(sub.current_period_start*1000).toISOString(),
      current_period_end:   new Date(sub.current_period_end*1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end, updated_at: new Date().toISOString(),
    }),
  })
  await fetch(`${SUPABASE_URL}/rest/v1/agencies?id=eq.${agency_id}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`},
    body: JSON.stringify({ plan: plan||'starter' }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') || ''
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET)
    const event  = STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
      : JSON.parse(body)
    if (event.type.startsWith('customer.subscription')) await upsertSub(event.data.object)
    return NextResponse.json({ received: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

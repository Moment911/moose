import { NextRequest, NextResponse } from 'next/server'

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_1TIrSOHLHCf3QhQXZ8tJZ0c0',
  growth:  process.env.STRIPE_PRICE_GROWTH  || 'price_1TIrSpHLHCf3QhQXSN1Ju9Rt',
  agency:  process.env.STRIPE_PRICE_AGENCY  || 'price_1TIrTOHLHCf3QhQXTONbAybZ',
}

export async function POST(req: NextRequest) {
  try {
    if (!STRIPE_SECRET) {
      return NextResponse.json({ error: 'Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars.' }, { status: 500 })
    }
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET)
    const { plan, agency_id, email, agency_name } = await req.json()
    const priceId = PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json({ 
        error: `Stripe Price ID not configured for plan: ${plan}`,
        fix: `In Vercel → Settings → Environment Variables, add: STRIPE_PRICE_${(plan||'').toUpperCase()}=price_xxxx (get this from Stripe Dashboard → Products → ${plan} plan → Price ID)`
      }, { status: 400 })
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { agency_id, plan, agency_name },
      },
      success_url: `${APP_URL}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/billing?cancelled=1`,
      metadata: { agency_id, plan, agency_name },
      allow_promotion_codes: true,
    })
    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY       || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET   || ''
const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  }
}

async function upsertSubscription(sub: any, overrideMeta?: Record<string,string>) {
  const meta = { ...sub.metadata, ...overrideMeta }
  const { agency_id, plan } = meta
  if (!agency_id) {
    console.warn('[webhook] No agency_id in metadata, skipping', JSON.stringify(meta))
    return
  }

  const planName = plan || 'starter'

  // Upsert subscription record
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      agency_id,
      stripe_customer_id:     sub.customer,
      stripe_subscription_id: sub.id,
      plan:                   planName,
      status:                 sub.status,
      current_period_start:   sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
      current_period_end:     sub.current_period_end   ? new Date(sub.current_period_end   * 1000).toISOString() : null,
      trial_start:            sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
      trial_end:              sub.trial_end   ? new Date(sub.trial_end   * 1000).toISOString() : null,
      cancel_at_period_end:   sub.cancel_at_period_end || false,
      updated_at:             new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[webhook] Failed to upsert subscription:', err)
  }

  // Update agency plan
  const agRes = await fetch(`${SUPABASE_URL}/rest/v1/agencies?id=eq.${agency_id}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      plan:                   planName,
      stripe_customer_id:     sub.customer,
      stripe_subscription_id: sub.id,
      status:                 sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
      updated_at:             new Date().toISOString(),
    }),
  })

  if (!agRes.ok) {
    console.error('[webhook] Failed to update agency:', await agRes.text())
  } else {
    console.log(`[webhook] ✓ Synced agency ${agency_id} → plan:${planName}, status:${sub.status}`)
  }

  // Sync to koto_billing_accounts
  const billingStatus = sub.status === 'active' || sub.status === 'trialing' ? sub.status : sub.status === 'past_due' ? 'past_due' : 'cancelled'
  const planPrices: Record<string, number> = { starter: 297, growth: 597, agency: 997, enterprise: 1997 }
  await fetch(`${SUPABASE_URL}/rest/v1/koto_billing_accounts`, {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      agency_id,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      plan: planName,
      plan_price: planPrices[planName] || 297,
      status: billingStatus,
      current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  }).catch(e => console.error('[webhook] koto_billing_accounts sync error:', e.message))
}

async function handleCheckoutComplete(session: any) {
  // checkout.session.completed fires when customer finishes Stripe checkout
  // The subscription object is in session.subscription (an ID)
  // We need to fetch the full subscription to get period dates

  if (session.mode !== 'subscription') return

  const meta = session.metadata || {}
  const { agency_id, plan } = meta

  if (!agency_id) {
    console.warn('[webhook] checkout.session.completed missing agency_id')
    return
  }

  // Build a minimal subscription object from the session
  const sub = {
    id:                  session.subscription,
    customer:            session.customer,
    status:              'trialing',  // new checkouts start in trial
    metadata:            meta,
    current_period_start: null,
    current_period_end:   null,
    trial_start:          null,
    trial_end:            null,
    cancel_at_period_end: false,
  }

  // If we have a Stripe secret, fetch the full subscription for accurate dates
  if (STRIPE_SECRET && session.subscription) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(STRIPE_SECRET)
      const fullSub = await stripe.subscriptions.retrieve(session.subscription as string)
      Object.assign(sub, fullSub)
    } catch (e: any) {
      console.warn('[webhook] Could not fetch full subscription:', e.message)
    }
  }

  await upsertSubscription(sub, meta)
}

async function handleInvoicePaid(invoice: any) {
  // invoice.payment_succeeded fires after trial ends and first real payment processes
  if (!invoice.subscription) return

  const meta = invoice.subscription_details?.metadata || invoice.metadata || {}
  
  // Fetch subscription details
  if (STRIPE_SECRET) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(STRIPE_SECRET)
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
      await upsertSubscription(sub, meta)
    } catch (e: any) {
      console.warn('[webhook] handleInvoicePaid error:', e.message)
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') || ''

  let event: any

  try {
    if (STRIPE_WEBHOOK_SECRET && STRIPE_SECRET) {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(STRIPE_SECRET)
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
    } else {
      // No webhook secret — accept raw JSON (dev/testing only)
      event = JSON.parse(body)
    }
  } catch (e: any) {
    console.error('[webhook] Signature verification failed:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  console.log('[webhook] Received event:', event.type)

  try {
    switch (event.type) {
      // ── Checkout completed (customer finished payment form) ──────────────
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object)
        break

      // ── Subscription lifecycle ─────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSubscription(event.data.object)
        break

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object
        const { agency_id: delAgencyId } = deletedSub.metadata || {}
        if (delAgencyId) {
          await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?agency_id=eq.${delAgencyId}`, {
            method: 'PATCH',
            headers: { ...headers(), 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }),
          })
          await fetch(`${SUPABASE_URL}/rest/v1/agencies?id=eq.${delAgencyId}`, {
            method: 'PATCH',
            headers: { ...headers(), 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }),
          })
        }
        break

      // ── Invoice events ─────────────────────────────────────────────────
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object)
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object
        const failMeta = failedInvoice.subscription_details?.metadata || {}
        if (failMeta.agency_id) {
          await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?agency_id=eq.${failMeta.agency_id}`, {
            method: 'PATCH',
            headers: { ...headers(), 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'past_due', updated_at: new Date().toISOString() }),
          })
        }
        break

      // ── Trial ending reminder (3 days before) ─────────────────────────
      case 'customer.subscription.trial_will_end': {
        console.log('[webhook] Trial ending soon:', event.data.object.id)
        const trialSub = event.data.object as any
        const trialEnd = new Date(trialSub.trial_end * 1000).toLocaleDateString('en-US', {month:'long',day:'numeric'})
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'Koto Billing <billing@hellokoto.com>',
            to: trialSub.metadata?.agency_email || '',
            subject: `Your Koto trial ends ${trialEnd} — upgrade to keep access`,
          html: `<div style="font-family:Helvetica,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2 style="color:#0a0a0a;">Your trial ends ${trialEnd}</h2>
            <p style="color:#374151;line-height:1.7;">Your Koto ${trialSub.metadata?.plan || ''} plan trial will end in 3 days. To keep full access to all your clients, SEO tools, and the CMO agent, upgrade now.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/billing" style="display:inline-block;padding:12px 24px;background:#ea2729;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Upgrade Now →</a>
          </div>`
          }).catch(() => {})
        }
        break
      }

      default:
        console.log('[webhook] Unhandled event type:', event.type)
    }
  } catch (e: any) {
    console.error('[webhook] Handler error:', e.message)
    // Still return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true })
}

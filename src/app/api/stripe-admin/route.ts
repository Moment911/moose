import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY || ''
const stripeAuth = () => 'Basic ' + Buffer.from(STRIPE_KEY() + ':').toString('base64')
const stripeHeaders = () => ({ Authorization: stripeAuth(), 'Content-Type': 'application/x-www-form-urlencoded' })

async function stripeFetch(path: string, method = 'GET', body?: Record<string, any>) {
  const url = `https://api.stripe.com/v1${path}`
  const opts: any = { method, headers: stripeHeaders() }
  if (body && method !== 'GET') opts.body = new URLSearchParams(body as any).toString()
  const res = await fetch(url, opts)
  return res.json()
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const s = sb()

  if (!STRIPE_KEY()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  if (action === 'list_products') {
    const stripe = await stripeFetch('/products?active=true&limit=100')
    const prices = await stripeFetch('/prices?active=true&limit=100')
    const products = (stripe.data || []).map((prod: any) => {
      const prodPrices = (prices.data || []).filter((pr: any) => pr.product === prod.id)
      const monthly = prodPrices.find((pr: any) => pr.recurring?.interval === 'month')
      const annual = prodPrices.find((pr: any) => pr.recurring?.interval === 'year')
      const oneTime = prodPrices.find((pr: any) => !pr.recurring)
      return {
        stripe_product_id: prod.id, name: prod.name, description: prod.description,
        is_active: prod.active, metadata: prod.metadata,
        monthly_price: monthly ? monthly.unit_amount / 100 : null,
        monthly_price_id: monthly?.id, annual_price: annual ? annual.unit_amount / 100 : null,
        annual_price_id: annual?.id, one_time_price: oneTime ? oneTime.unit_amount / 100 : null,
        prices: prodPrices.map((pr: any) => ({ id: pr.id, amount: pr.unit_amount / 100, interval: pr.recurring?.interval || 'one_time', active: pr.active })),
      }
    })
    // Sync to DB
    for (const prod of products) {
      await s.from('koto_stripe_products').upsert({
        stripe_product_id: prod.stripe_product_id, name: prod.name, description: prod.description,
        stripe_price_id_monthly: prod.monthly_price_id, stripe_price_id_annual: prod.annual_price_id,
        monthly_price: prod.monthly_price, annual_price: prod.annual_price,
        is_active: prod.is_active, updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_product_id' })
    }
    return NextResponse.json(products)
  }

  if (action === 'list_coupons') {
    const data = await stripeFetch('/coupons?limit=100')
    const coupons = (data.data || []).map((c: any) => ({
      stripe_coupon_id: c.id, name: c.name || c.id,
      type: c.percent_off ? 'percent' : 'fixed',
      percent_off: c.percent_off, amount_off: c.amount_off ? c.amount_off / 100 : null,
      duration: c.duration, duration_in_months: c.duration_in_months,
      max_redemptions: c.max_redemptions, times_redeemed: c.times_redeemed,
      valid: c.valid, created: c.created,
    }))
    return NextResponse.json(coupons)
  }

  if (action === 'list_subscriptions') {
    const data = await stripeFetch('/subscriptions?status=active&limit=100')
    const subs = (data.data || []).map((sub: any) => ({
      id: sub.id, customer_id: sub.customer,
      status: sub.status, plan: sub.items?.data?.[0]?.price?.product,
      price_id: sub.items?.data?.[0]?.price?.id,
      amount: sub.items?.data?.[0]?.price?.unit_amount ? sub.items.data[0].price.unit_amount / 100 : 0,
      interval: sub.items?.data?.[0]?.price?.recurring?.interval,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      created: new Date(sub.created * 1000).toISOString(),
    }))
    return NextResponse.json(subs)
  }

  if (action === 'list_customers') {
    const data = await stripeFetch('/customers?limit=100')
    const customers = (data.data || []).map((c: any) => ({
      id: c.id, email: c.email, name: c.name,
      created: new Date(c.created * 1000).toISOString(),
      currency: c.currency, balance: c.balance ? c.balance / 100 : 0,
      metadata: c.metadata,
    }))
    return NextResponse.json(customers)
  }

  if (action === 'list_invoices') {
    const limit = p.get('limit') || '50'
    const data = await stripeFetch(`/invoices?limit=${limit}`)
    const invoices = (data.data || []).map((inv: any) => ({
      id: inv.id, number: inv.number, customer: inv.customer_email || inv.customer,
      amount: inv.amount_due / 100, amount_paid: inv.amount_paid / 100,
      status: inv.status, created: new Date(inv.created * 1000).toISOString(),
      pdf: inv.invoice_pdf, hosted_url: inv.hosted_invoice_url,
    }))
    return NextResponse.json(invoices)
  }

  if (action === 'get_revenue') {
    const subs = await stripeFetch('/subscriptions?status=active&limit=100')
    let mrr = 0
    for (const sub of subs.data || []) {
      const price = sub.items?.data?.[0]?.price
      if (price?.recurring?.interval === 'month') mrr += (price.unit_amount || 0) / 100
      else if (price?.recurring?.interval === 'year') mrr += (price.unit_amount || 0) / 100 / 12
    }
    const activeCount = (subs.data || []).length
    const charges = await stripeFetch('/charges?limit=10')
    const failedCount = (charges.data || []).filter((c: any) => c.status === 'failed').length
    return NextResponse.json({ mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100, active_subscriptions: activeCount, failed_payments: failedCount })
  }

  if (action === 'sync') {
    const [products, prices, coupons] = await Promise.all([
      stripeFetch('/products?active=true&limit=100'),
      stripeFetch('/prices?active=true&limit=100'),
      stripeFetch('/coupons?limit=100'),
    ])
    let prodCount = 0, priceCount = 0, couponCount = 0
    for (const prod of products.data || []) {
      const monthlyPrice = (prices.data || []).find((pr: any) => pr.product === prod.id && pr.recurring?.interval === 'month')
      const annualPrice = (prices.data || []).find((pr: any) => pr.product === prod.id && pr.recurring?.interval === 'year')
      await s.from('koto_stripe_products').upsert({
        stripe_product_id: prod.id, name: prod.name, description: prod.description,
        stripe_price_id_monthly: monthlyPrice?.id, stripe_price_id_annual: annualPrice?.id,
        monthly_price: monthlyPrice ? monthlyPrice.unit_amount / 100 : null,
        annual_price: annualPrice ? annualPrice.unit_amount / 100 : null,
        is_active: prod.active, updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_product_id' })
      prodCount++
    }
    priceCount = (prices.data || []).length
    for (const c of coupons.data || []) {
      await s.from('koto_stripe_coupons').upsert({
        stripe_coupon_id: c.id, name: c.name || c.id,
        type: c.percent_off ? 'percent' : 'fixed',
        percent_off: c.percent_off, amount_off: c.amount_off ? c.amount_off / 100 : null,
        duration: c.duration, duration_in_months: c.duration_in_months,
        max_redemptions: c.max_redemptions, times_redeemed: c.times_redeemed,
        is_active: c.valid, updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_coupon_id' })
      couponCount++
    }
    return NextResponse.json({ synced: { products: prodCount, prices: priceCount, coupons: couponCount } })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (!STRIPE_KEY()) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  if (action === 'create_product') {
    const { name, description, monthly_price, annual_price, features, category } = body
    const prod = await stripeFetch('/products', 'POST', { name, description: description || '', 'metadata[category]': category || 'plan', 'metadata[features]': JSON.stringify(features || []) })
    if (prod.error) return NextResponse.json({ error: prod.error.message }, { status: 400 })

    const result: any = { product: prod }
    if (monthly_price) {
      const price = await stripeFetch('/prices', 'POST', { product: prod.id, unit_amount: String(Math.round(monthly_price * 100)), currency: 'usd', 'recurring[interval]': 'month' })
      result.monthly_price = price
    }
    if (annual_price) {
      const price = await stripeFetch('/prices', 'POST', { product: prod.id, unit_amount: String(Math.round(annual_price * 100)), currency: 'usd', 'recurring[interval]': 'year' })
      result.annual_price = price
    }

    await sb().from('koto_stripe_products').insert({
      stripe_product_id: prod.id, name, description,
      stripe_price_id_monthly: result.monthly_price?.id,
      stripe_price_id_annual: result.annual_price?.id,
      monthly_price, annual_price, category, features,
    })
    return NextResponse.json(result)
  }

  if (action === 'update_product') {
    const { stripe_product_id, name, description } = body
    const data = await stripeFetch(`/products/${stripe_product_id}`, 'POST', { name, description: description || '' })
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    await sb().from('koto_stripe_products').update({ name, description, updated_at: new Date().toISOString() }).eq('stripe_product_id', stripe_product_id)
    return NextResponse.json(data)
  }

  if (action === 'archive_product') {
    const data = await stripeFetch(`/products/${body.stripe_product_id}`, 'POST', { active: 'false' })
    await sb().from('koto_stripe_products').update({ is_active: false }).eq('stripe_product_id', body.stripe_product_id)
    return NextResponse.json(data)
  }

  if (action === 'create_coupon') {
    const { name, percent_off, amount_off, duration, duration_in_months, max_redemptions } = body
    const params: Record<string, string> = { name, duration: duration || 'once' }
    if (percent_off) params.percent_off = String(percent_off)
    if (amount_off) { params.amount_off = String(Math.round(amount_off * 100)); params.currency = 'usd' }
    if (duration_in_months) params.duration_in_months = String(duration_in_months)
    if (max_redemptions) params.max_redemptions = String(max_redemptions)

    const data = await stripeFetch('/coupons', 'POST', params)
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

    await sb().from('koto_stripe_coupons').insert({
      stripe_coupon_id: data.id, name, type: percent_off ? 'percent' : 'fixed',
      percent_off, amount_off, duration, duration_in_months, max_redemptions,
    })
    return NextResponse.json(data)
  }

  if (action === 'delete_coupon') {
    await stripeFetch(`/coupons/${body.stripe_coupon_id}`, 'DELETE' as any)
    await sb().from('koto_stripe_coupons').update({ is_active: false }).eq('stripe_coupon_id', body.stripe_coupon_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'cancel_subscription') {
    const data = await stripeFetch(`/subscriptions/${body.subscription_id}`, 'DELETE' as any)
    return NextResponse.json(data)
  }

  if (action === 'refund_charge') {
    const params: Record<string, string> = { charge: body.charge_id }
    if (body.amount) params.amount = String(Math.round(body.amount * 100))
    if (body.reason) params.reason = body.reason
    const data = await stripeFetch('/refunds', 'POST', params)
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const PLANS: Record<string, number> = { starter: 297, growth: 597, agency: 997, enterprise: 1997 }

/* ── GET ────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const action = p.get('action')
  const agencyId = p.get('agency_id')
  const s = sb()

  if (action === 'get_account') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('koto_billing_accounts').select('*').eq('agency_id', agencyId).single()
    return NextResponse.json(data || { plan: 'starter', credit_balance: 0, status: 'active' })
  }

  if (action === 'get_balance') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data: acct } = await s.from('koto_billing_accounts').select('credit_balance, auto_recharge, auto_recharge_threshold, auto_recharge_amount').eq('agency_id', agencyId).single()
    const { data: txns } = await s.from('koto_credit_transactions').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(30)
    return NextResponse.json({ balance: acct?.credit_balance || 0, auto_recharge: acct?.auto_recharge || false, threshold: acct?.auto_recharge_threshold || 20, recharge_amount: acct?.auto_recharge_amount || 100, transactions: txns || [] })
  }

  if (action === 'get_usage') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const feature = p.get('feature')
    const period = p.get('period') || new Date().toISOString().slice(0, 7)
    let q = s.from('koto_usage_records').select('*').eq('agency_id', agencyId).eq('billing_period', period).order('recorded_at', { ascending: false })
    if (feature) q = q.eq('feature', feature)
    const { data } = await q.limit(200)
    return NextResponse.json(data || [])
  }

  if (action === 'get_invoices') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('koto_agency_invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(24)
    return NextResponse.json(data || [])
  }

  if (action === 'get_invoice_detail') {
    const id = p.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { data } = await s.from('koto_agency_invoices').select('*').eq('id', id).single()
    return NextResponse.json(data)
  }

  if (action === 'get_client_invoices') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const clientId = p.get('client_id')
    let q = s.from('koto_client_invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    if (clientId) q = q.eq('client_id', clientId)
    const { data } = await q.limit(50)
    return NextResponse.json(data || [])
  }

  if (action === 'get_client_pricing') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const { data } = await s.from('koto_client_pricing').select('*').eq('agency_id', agencyId)
    return NextResponse.json(data || [])
  }

  if (action === 'get_platform_pricing') {
    const { data } = await s.from('koto_platform_pricing').select('*').order('feature')
    return NextResponse.json(data || [])
  }

  if (action === 'get_dashboard') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const period = new Date().toISOString().slice(0, 7)
    const [{ data: acct }, { data: usage }, { data: txns }, { count: invoiceCount }] = await Promise.all([
      s.from('koto_billing_accounts').select('*').eq('agency_id', agencyId).single(),
      s.from('koto_usage_records').select('feature, total_cost, quantity').eq('agency_id', agencyId).eq('billing_period', period),
      s.from('koto_credit_transactions').select('type, amount, created_at').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(10),
      s.from('koto_client_invoices').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'paid'),
    ])
    const usageByFeature: Record<string, { cost: number; qty: number }> = {}
    for (const u of usage || []) {
      if (!usageByFeature[u.feature]) usageByFeature[u.feature] = { cost: 0, qty: 0 }
      usageByFeature[u.feature].cost += Number(u.total_cost || 0)
      usageByFeature[u.feature].qty += Number(u.quantity || 0)
    }
    const totalUsage = Object.values(usageByFeature).reduce((s, v) => s + v.cost, 0)
    return NextResponse.json({
      plan: acct?.plan || 'starter',
      plan_price: acct?.plan_price || 297,
      status: acct?.status || 'active',
      credit_balance: acct?.credit_balance || 0,
      auto_recharge: acct?.auto_recharge || false,
      payment_method_last4: acct?.payment_method_last4,
      payment_method_brand: acct?.payment_method_brand,
      current_period_end: acct?.current_period_end,
      usage_this_month: totalUsage,
      usage_by_feature: usageByFeature,
      recent_transactions: txns || [],
      invoices_paid: invoiceCount || 0,
    })
  }

  if (action === 'get_mrr') {
    const { data: accounts } = await s.from('koto_billing_accounts').select('plan, plan_price, status')
    const active = (accounts || []).filter(a => a.status === 'active' || a.status === 'trialing')
    const mrr = active.reduce((sum, a) => sum + Number(a.plan_price || 0), 0)
    const byPlan: Record<string, number> = {}
    for (const a of active) { byPlan[a.plan] = (byPlan[a.plan] || 0) + 1 }
    const { count: totalAgencies } = await s.from('agencies').select('*', { count: 'exact', head: true })
    const period = new Date().toISOString().slice(0, 7)
    const { data: usageData } = await s.from('koto_usage_records').select('total_cost').eq('billing_period', period)
    const totalUsageRevenue = (usageData || []).reduce((sum, u) => sum + Number(u.total_cost || 0), 0)
    const { data: creditData } = await s.from('koto_credit_transactions').select('amount').eq('type', 'purchase').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    const creditsPurchased = (creditData || []).reduce((sum, c) => sum + Number(c.amount || 0), 0)
    const { count: cancelledCount } = await s.from('koto_billing_accounts').select('*', { count: 'exact', head: true }).eq('status', 'cancelled')
    return NextResponse.json({ mrr, by_plan: byPlan, total_agencies: totalAgencies || 0, total_usage_revenue: totalUsageRevenue, credits_purchased_this_month: creditsPurchased, cancelled: cancelledCount || 0 })
  }

  if (action === 'get_all_agencies_billing') {
    const { data } = await s.from('koto_billing_accounts').select('*, agencies!inner(name, brand_name, owner_email)').order('created_at', { ascending: false })
    return NextResponse.json(data || [])
  }

  if (action === 'get_profitability') {
    // Super admin: cost vs revenue by feature
    const period = p.get('period') || new Date().toISOString().slice(0, 7)
    const { data: platformPricing } = await s.from('koto_platform_pricing').select('feature, cost_per_unit')
    const costMap: Record<string, number> = {}
    for (const pp of platformPricing || []) costMap[pp.feature] = Number(pp.cost_per_unit)

    const { data: usageData } = await s.from('koto_usage_records').select('feature, quantity, unit_cost, total_cost, agency_id').eq('billing_period', period)
    const byFeature: Record<string, { revenue: number; cost: number; qty: number }> = {}
    for (const u of usageData || []) {
      if (!byFeature[u.feature]) byFeature[u.feature] = { revenue: 0, cost: 0, qty: 0 }
      byFeature[u.feature].revenue += Number(u.total_cost || 0)
      byFeature[u.feature].cost += Number(u.quantity || 0) * (costMap[u.feature] || 0)
      byFeature[u.feature].qty += Number(u.quantity || 0)
    }
    const features = Object.entries(byFeature).map(([feature, d]) => ({
      feature, revenue: Math.round(d.revenue * 100) / 100,
      cost: Math.round(d.cost * 100) / 100,
      margin: Math.round((d.revenue - d.cost) * 100) / 100,
      margin_pct: d.revenue > 0 ? Math.round(((d.revenue - d.cost) / d.revenue) * 100) : 0,
      quantity: d.qty,
    }))
    const totalRevenue = features.reduce((s, f) => s + f.revenue, 0)
    const totalCost = features.reduce((s, f) => s + f.cost, 0)

    // Per-agency profitability
    const agencyMap: Record<string, { revenue: number; cost: number; name: string }> = {}
    for (const u of usageData || []) {
      if (!agencyMap[u.agency_id]) agencyMap[u.agency_id] = { revenue: 0, cost: 0, name: '' }
      agencyMap[u.agency_id].revenue += Number(u.total_cost || 0)
      agencyMap[u.agency_id].cost += Number(u.quantity || 0) * (costMap[u.feature] || 0)
    }
    // Enrich with agency names
    const agencyIds = Object.keys(agencyMap)
    if (agencyIds.length > 0) {
      const { data: agencies } = await s.from('agencies').select('id, name, brand_name').in('id', agencyIds)
      for (const a of agencies || []) {
        if (agencyMap[a.id]) agencyMap[a.id].name = a.brand_name || a.name || a.id
      }
    }
    const byAgency = Object.entries(agencyMap).map(([id, d]) => ({
      agency_id: id, name: d.name || id.slice(0, 8),
      revenue: Math.round(d.revenue * 100) / 100,
      cost: Math.round(d.cost * 100) / 100,
      margin: Math.round((d.revenue - d.cost) * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      period, total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
      total_margin: Math.round((totalRevenue - totalCost) * 100) / 100,
      margin_pct: totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0,
      by_feature: features, by_agency: byAgency,
    })
  }

  if (action === 'get_client_profitability') {
    if (!agencyId) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const period = p.get('period') || new Date().toISOString().slice(0, 7)
    const { data: usageData } = await s.from('koto_usage_records').select('client_id, feature, quantity, unit_cost, total_cost').eq('agency_id', agencyId).eq('billing_period', period)
    const { data: pricing } = await s.from('koto_client_pricing').select('*').eq('agency_id', agencyId)
    const { data: clients } = await s.from('clients').select('id, name').eq('agency_id', agencyId)

    const clientMap: Record<string, { name: string; cost: number; revenue: number; usage: Record<string, number> }> = {}
    for (const c of clients || []) {
      clientMap[c.id] = { name: c.name, cost: 0, revenue: 0, usage: {} }
    }
    const rateMap: Record<string, any> = {}
    for (const p of pricing || []) rateMap[p.client_id] = p

    for (const u of usageData || []) {
      const cid = u.client_id
      if (!cid || !clientMap[cid]) continue
      clientMap[cid].cost += Number(u.total_cost || 0)
      clientMap[cid].usage[u.feature] = (clientMap[cid].usage[u.feature] || 0) + Number(u.quantity || 0)
      // Estimate revenue based on agency's client pricing
      const rates = rateMap[cid]
      if (rates) {
        if (u.feature === 'voice_outbound' || u.feature === 'voice_inbound') {
          clientMap[cid].revenue += Number(u.quantity || 0) * Number(rates.voice_call_rate || 0.10)
        } else if (u.feature.includes('sms')) {
          clientMap[cid].revenue += Number(u.quantity || 0) * Number(rates.sms_rate || 0.02)
        } else if (u.feature === 'phone_number') {
          clientMap[cid].revenue += Number(u.quantity || 0) * Number(rates.phone_number_rate || 3.00)
        } else if (u.feature === 'page_deploy') {
          clientMap[cid].revenue += Number(u.quantity || 0) * Number(rates.page_build_rate || 50.00)
        }
      }
    }
    // Add retainer revenue
    for (const [cid, rates] of Object.entries(rateMap)) {
      if (clientMap[cid]) clientMap[cid].revenue += Number((rates as any).monthly_retainer || 0)
    }

    const result = Object.entries(clientMap).map(([id, d]) => ({
      client_id: id, name: d.name, cost: Math.round(d.cost * 100) / 100,
      revenue: Math.round(d.revenue * 100) / 100,
      margin: Math.round((d.revenue - d.cost) * 100) / 100,
      usage: d.usage,
    })).sort((a, b) => b.margin - a.margin)

    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/* ── POST ───────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const s = sb()

  if (action === 'create_billing_account') {
    const { agency_id, plan } = body
    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
    const planPrice = PLANS[plan || 'starter'] || 297
    const { data, error } = await s.from('koto_billing_accounts').upsert({
      agency_id, plan: plan || 'starter', plan_price: planPrice, status: 'active',
      credit_balance: 0, current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    }, { onConflict: 'agency_id' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'purchase_credits') {
    const { agency_id, amount } = body
    if (!agency_id || !amount || amount <= 0) return NextResponse.json({ error: 'agency_id and positive amount required' }, { status: 400 })
    // Get current balance
    const { data: acct } = await s.from('koto_billing_accounts').select('credit_balance').eq('agency_id', agency_id).single()
    const currentBalance = Number(acct?.credit_balance || 0)
    const newBalance = currentBalance + Number(amount)
    // Update balance
    await s.from('koto_billing_accounts').update({ credit_balance: newBalance, updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
    // Record transaction
    const { data: txn } = await s.from('koto_credit_transactions').insert({
      agency_id, type: 'purchase', amount: Number(amount), balance_after: newBalance,
      description: `Credit purchase: $${amount}`,
    }).select().single()
    return NextResponse.json({ balance: newBalance, transaction: txn })
  }

  if (action === 'record_usage') {
    const { agency_id, client_id, feature, quantity, unit, unit_cost } = body
    if (!agency_id || !feature || !quantity) return NextResponse.json({ error: 'agency_id, feature, quantity required' }, { status: 400 })
    const totalCost = Number(quantity) * Number(unit_cost || 0)
    // Get balance
    const { data: acct } = await s.from('koto_billing_accounts').select('credit_balance').eq('agency_id', agency_id).single()
    const currentBalance = Number(acct?.credit_balance || 0)
    const newBalance = currentBalance - totalCost
    const insufficient = newBalance < 0
    // Record usage
    const period = new Date().toISOString().slice(0, 7)
    await s.from('koto_usage_records').insert({
      agency_id, client_id: client_id || null, feature, quantity: Number(quantity),
      unit: unit || 'units', unit_cost: Number(unit_cost || 0), total_cost: totalCost,
      credits_deducted: totalCost, billing_period: period,
    })
    // Deduct credits
    await s.from('koto_billing_accounts').update({ credit_balance: Math.max(newBalance, 0), updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
    // Record debit transaction
    await s.from('koto_credit_transactions').insert({
      agency_id, type: 'usage', amount: -totalCost, balance_after: Math.max(newBalance, 0),
      description: `${feature}: ${quantity} ${unit || 'units'}`, feature,
    })
    return NextResponse.json({ balance: Math.max(newBalance, 0), insufficient, total_cost: totalCost })
  }

  if (action === 'create_client_invoice') {
    const { agency_id, client_id, line_items, notes, due_date, tax_rate } = body
    if (!agency_id || !client_id) return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
    const items = line_items || []
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)
    const tax = subtotal * (Number(tax_rate || 0) / 100)
    const total = subtotal + tax
    const invNum = `INV-${Date.now().toString(36).toUpperCase()}`
    const now = new Date()
    const { data, error } = await s.from('koto_client_invoices').insert({
      agency_id, client_id, invoice_number: invNum, status: 'draft',
      billing_period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      billing_period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      subtotal, tax_rate: Number(tax_rate || 0), tax, total,
      amount_due: total, line_items: items, notes,
      due_date: due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'send_client_invoice') {
    const { invoice_id, to_email } = body
    if (!invoice_id || !to_email) return NextResponse.json({ error: 'invoice_id and to_email required' }, { status: 400 })
    const { data: inv } = await s.from('koto_client_invoices').select('*').eq('id', invoice_id).single()
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    // Send via Resend
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const items = (inv.line_items || []).map((i: any) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.description || 'Item'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(i.amount || 0).toFixed(2)}</td></tr>`).join('')
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.DESK_EMAIL_FROM || 'Koto <notifications@hellokoto.com>',
          to: to_email, subject: `Invoice ${inv.invoice_number} — $${Number(inv.total).toFixed(2)}`,
          html: `<h2>Invoice ${inv.invoice_number}</h2><table style="width:100%;border-collapse:collapse">${items}<tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-weight:bold;text-align:right">$${Number(inv.total).toFixed(2)}</td></tr></table><p>Due: ${inv.due_date}</p>`,
        }),
      })
    }
    await s.from('koto_client_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'mark_invoice_paid') {
    const { invoice_id, invoice_type } = body
    if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })
    const table = invoice_type === 'client' ? 'koto_client_invoices' : 'koto_agency_invoices'
    const { data: inv } = await s.from(table).select('total').eq('id', invoice_id).single()
    await s.from(table).update({ status: 'paid', amount_paid: inv?.total || 0, amount_due: 0, paid_at: new Date().toISOString() }).eq('id', invoice_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'update_client_pricing') {
    const { agency_id, client_id, ...pricing } = body
    if (!agency_id || !client_id) return NextResponse.json({ error: 'agency_id and client_id required' }, { status: 400 })
    const { data, error } = await s.from('koto_client_pricing').upsert({
      agency_id, client_id, monthly_retainer: pricing.monthly_retainer || 0,
      setup_fee: pricing.setup_fee || 0, voice_call_rate: pricing.voice_call_rate || 0.10,
      sms_rate: pricing.sms_rate || 0.02, phone_number_rate: pricing.phone_number_rate || 3.00,
      page_build_rate: pricing.page_build_rate || 50.00,
      billing_cycle: pricing.billing_cycle || 'monthly',
      auto_invoice: pricing.auto_invoice !== false, updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'update_platform_pricing') {
    const { feature, cost_per_unit } = body
    if (!feature || cost_per_unit === undefined) return NextResponse.json({ error: 'feature and cost_per_unit required' }, { status: 400 })
    const { error } = await s.from('koto_platform_pricing').update({ cost_per_unit: Number(cost_per_unit), updated_at: new Date().toISOString() }).eq('feature', feature)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'adjust_credits') {
    const { agency_id, amount, description } = body
    if (!agency_id || amount === undefined) return NextResponse.json({ error: 'agency_id and amount required' }, { status: 400 })
    const { data: acct } = await s.from('koto_billing_accounts').select('credit_balance').eq('agency_id', agency_id).single()
    const newBalance = Number(acct?.credit_balance || 0) + Number(amount)
    await s.from('koto_billing_accounts').update({ credit_balance: newBalance, updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
    await s.from('koto_credit_transactions').insert({
      agency_id, type: 'adjustment', amount: Number(amount), balance_after: newBalance,
      description: description || `Manual adjustment: ${Number(amount) >= 0 ? '+' : ''}$${amount}`,
    })
    return NextResponse.json({ balance: newBalance })
  }

  if (action === 'change_plan') {
    const { agency_id, plan } = body
    if (!agency_id || !plan || !PLANS[plan]) return NextResponse.json({ error: 'Valid plan required' }, { status: 400 })
    await s.from('koto_billing_accounts').update({ plan, plan_price: PLANS[plan], updated_at: new Date().toISOString() }).eq('agency_id', agency_id)
    return NextResponse.json({ plan, price: PLANS[plan] })
  }

  if (action === 'redeem_promo') {
    const { agency_id, code, user_email } = body
    if (!agency_id || !code) return NextResponse.json({ error: 'agency_id and code required' }, { status: 400 })
    const { data: promo } = await s.from('koto_promo_codes').select('*').eq('code', code.toUpperCase().trim()).eq('is_active', true).single()
    if (!promo) return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 400 })
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return NextResponse.json({ error: 'Code used up' }, { status: 400 })
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) return NextResponse.json({ error: 'Code expired' }, { status: 400 })
    const { data: existing } = await s.from('koto_promo_redemptions').select('id').eq('code_id', promo.id).eq('agency_id', agency_id).single()
    if (existing) return NextResponse.json({ error: 'Already redeemed' }, { status: 400 })

    const expiresAt = promo.duration_days ? new Date(Date.now() + promo.duration_days * 86400000).toISOString() : null
    await s.from('koto_promo_redemptions').insert({ code_id: promo.id, agency_id, redeemed_by_email: user_email, credits_added: promo.free_credits || 0, plan_unlocked: promo.plan, expires_at: expiresAt, is_active: true })
    await s.from('koto_promo_codes').update({ current_uses: (promo.current_uses || 0) + 1 }).eq('id', promo.id)

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (promo.bypass_billing || promo.bypass_subscription) updates.status = 'active'
    if (promo.plan) { updates.plan = promo.plan; updates.plan_price = PLANS[promo.plan] || 0 }
    if (promo.free_credits > 0) {
      const { data: acct } = await s.from('koto_billing_accounts').select('credit_balance').eq('agency_id', agency_id).single()
      updates.credit_balance = Number(acct?.credit_balance || 0) + Number(promo.free_credits)
      await s.from('koto_credit_transactions').insert({ agency_id, type: 'bonus', amount: Number(promo.free_credits), balance_after: updates.credit_balance, description: `Promo ${code}: +$${promo.free_credits}` })
    }
    await s.from('koto_billing_accounts').upsert({ agency_id, ...updates }, { onConflict: 'agency_id' })

    return NextResponse.json({ success: true, code: promo.code, credits_added: promo.free_credits || 0, plan_unlocked: promo.plan, bypass: promo.bypass_subscription, expires_at: expiresAt, message: promo.free_credits ? `$${promo.free_credits} credits added!` : promo.plan ? `${promo.plan} plan unlocked!` : 'Code applied!' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

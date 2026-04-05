import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Validate a coupon code and return discount info
async function validateCoupon(code: string, plan: string) {
  const sb = getSupabase()
  const { data: coupon } = await sb.from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single()

  if (!coupon) return { valid: false, error: 'Invalid coupon code' }

  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now)
    return { valid: false, error: 'Coupon not yet active' }
  if (coupon.valid_until && new Date(coupon.valid_until) < now)
    return { valid: false, error: 'Coupon has expired' }
  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses)
    return { valid: false, error: 'Coupon has reached its usage limit' }
  if (coupon.applies_to !== 'all' && coupon.applies_to !== plan)
    return { valid: false, error: `This coupon only applies to the ${coupon.applies_to} plan` }

  return {
    valid: true,
    coupon: {
      id:              coupon.id,
      code:            coupon.code,
      description:     coupon.description,
      discount_type:   coupon.discount_type,
      discount_value:  coupon.discount_value,
      trial_days:      coupon.trial_days,
      first_month_only: coupon.first_month_only,
      applies_to:      coupon.applies_to,
    }
  }
}

// Record a redemption
async function redeemCoupon(couponId: string, agencyId: string, code: string, discountApplied: number, plan: string) {
  const sb = getSupabase()
  await sb.from('coupon_redemptions').insert({ coupon_id: couponId, agency_id: agencyId, code, discount_applied: discountApplied, plan })
  // Increment uses_count directly
  const { data: existing } = await sb.from('coupons').select('uses_count').eq('id', couponId).single()
  await sb.from('coupons').update({ uses_count: (existing?.uses_count || 0) + 1 }).eq('id', couponId)
}

export async function POST(req: NextRequest) {
  try {
    const { action, code, plan, coupon_id, agency_id, discount_applied } = await req.json()

    if (action === 'validate') {
      if (!code) return NextResponse.json({ valid: false, error: 'No code provided' })
      const result = await validateCoupon(code, plan || 'all')
      return NextResponse.json(result)
    }

    if (action === 'redeem') {
      await redeemCoupon(coupon_id, agency_id, code, discount_applied, plan)
      return NextResponse.json({ success: true })
    }

    // Admin: list all coupons
    if (action === 'list') {
      const { data } = await getSupabase().from('coupons').select('*, coupon_redemptions(count)').order('created_at', { ascending: false })
      return NextResponse.json({ coupons: data || [] })
    }

    // Admin: create coupon
    if (action === 'create') {
      const { coupon } = await req.json().catch(() => ({ coupon: {} }))
      // Re-parse since we already parsed
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const sb = getSupabase()

    if (body.id) {
      // Update existing
      const { data, error } = await sb.from('coupons').update({
        code:            body.code?.toUpperCase().trim(),
        description:     body.description,
        discount_type:   body.discount_type,
        discount_value:  body.discount_value,
        applies_to:      body.applies_to,
        max_uses:        body.max_uses || null,
        valid_until:     body.valid_until || null,
        trial_days:      body.trial_days || null,
        first_month_only: body.first_month_only,
        active:          body.active,
      }).eq('id', body.id).select().single()
      if (error) throw error
      return NextResponse.json({ coupon: data })
    } else {
      // Create new
      const { data, error } = await sb.from('coupons').insert({
        code:            body.code?.toUpperCase().trim(),
        description:     body.description,
        discount_type:   body.discount_type || 'percent',
        discount_value:  body.discount_value,
        applies_to:      body.applies_to || 'all',
        max_uses:        body.max_uses || null,
        valid_until:     body.valid_until || null,
        trial_days:      body.trial_days || null,
        first_month_only: body.first_month_only ?? true,
        active:          true,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ coupon: data })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await getSupabase().from('coupons').update({ active: false }).eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

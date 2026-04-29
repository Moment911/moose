import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../../lib/emailService'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/share
//
// Sends a workout or meal plan summary via email or SMS.
// Auth: Bearer JWT (self-signup users).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const DEFAULT_AGENCY = '70ab75b3-1cee-4130-bfd5-bd2687c701ad'

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const sb = getDb()

  // Auth
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return err(401, 'Unauthorized')
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) return err(401, 'Unauthorized')

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch { return err(400, 'Invalid JSON') }

  const type = body.type as string // 'email' | 'sms'
  const to = (body.to as string || '').trim()
  const content = body.content as string // 'workouts' | 'meals'
  const summary = body.summary as string || '' // pre-rendered text summary

  if (!type || !to || !content) return err(400, 'type, to, and content required')

  // Look up the user's trainee record for context
  const { data: mapping } = await sb
    .from('koto_fitness_trainee_users')
    .select('trainee_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  const traineeId = mapping?.trainee_id

  const name = userData.user.user_metadata?.full_name || 'Your athlete'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

  if (type === 'email') {
    const subject = content === 'workouts'
      ? `${name}'s Workout Plan — Koto`
      : `${name}'s Meal Plan — Koto`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0a0a0a; margin: 0 0 16px;">
          ${content === 'workouts' ? 'Workout Plan' : 'Meal Plan'}
        </h1>
        <pre style="font-family: -apple-system, system-ui, sans-serif; white-space: pre-wrap; font-size: 14px; color: #1f1f22; line-height: 1.6; background: #f9fafb; padding: 20px; border-radius: 12px;">
${summary || 'View your full plan at ' + appUrl + '/my-plan'}
        </pre>
        <p style="font-size: 12px; color: #6b6b70; margin-top: 24px;">
          View your full plan: <a href="${appUrl}/my-plan" style="color: #0a0a0a;">${appUrl}/my-plan</a>
        </p>
        <p style="font-size: 11px; color: #a1a1a6; margin-top: 16px;">
          Koto provides general wellness guidance and is not a medical service.
        </p>
      </div>
    `

    const result = await sendEmail(to, subject, html)
    if (!result.success) return err(500, result.error || 'Email send failed')
    return NextResponse.json({ ok: true, channel: 'email' })
  }

  if (type === 'sms') {
    // SMS via plan link — simple text with link to /my-plan
    const telnyxKey = process.env.TELNYX_API_KEY
    if (!telnyxKey) return err(500, 'SMS not configured')

    const message = content === 'workouts'
      ? `Your workout plan is ready: ${appUrl}/my-plan — Koto`
      : `Your meal plan is ready: ${appUrl}/my-plan — Koto`

    try {
      const res = await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${telnyxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.TELNYX_SMS_FROM || '+18336331234',
          to,
          text: message,
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        return err(500, (errBody as any)?.errors?.[0]?.detail || 'SMS send failed')
      }
      return NextResponse.json({ ok: true, channel: 'sms' })
    } catch (e: any) {
      return err(500, e?.message || 'SMS send failed')
    }
  }

  return err(400, 'type must be "email" or "sms"')
}

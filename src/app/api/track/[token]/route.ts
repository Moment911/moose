import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

// 1×1 transparent GIF — base64 decoded once at module load
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// ─────────────────────────────────────────────────────────────
// GET /api/track/:token
// Must be FAST — target < 100ms response. We return the gif
// synchronously and fire the open-processing work as a promise
// that is deliberately NOT awaited.
// ─────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } | Promise<{ token: string }> },
) {
  const resolved = await Promise.resolve(params)
  const token = resolved?.token || ''

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const ua = req.headers.get('user-agent') || ''

  const device: 'desktop' | 'mobile' | 'tablet' =
    /tablet|ipad/i.test(ua) ? 'tablet' : /mobile|iphone|android/i.test(ua) ? 'mobile' : 'desktop'

  const emailClient =
    /gmail/i.test(ua) ? 'Gmail' :
    /outlook|microsoftoffice/i.test(ua) ? 'Outlook' :
    /apple\s?mail|darwin/i.test(ua) ? 'Apple Mail' :
    /yahoo/i.test(ua) ? 'Yahoo Mail' : 'Unknown'

  // Fire and forget — NEVER await.
  if (token) {
    processOpen(token, ip, ua, device, emailClient).catch(() => {})
  }

  return new Response(PIXEL_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_GIF.length),
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Background processing — insert open, update aggregate stats,
// detect forwards, fire notification on first open.
// ─────────────────────────────────────────────────────────────
async function processOpen(
  token: string,
  ip: string,
  ua: string,
  device: string,
  emailClient: string,
) {
  const s = sb()

  // Look up the pixel + parent tracked_email
  const { data: pixel } = await s
    .from('koto_email_tracking_pixels')
    .select('id, pixel_token, recipient_email, recipient_name, tracked_email_id, agency_id, koto_tracked_emails!inner(id, agency_id, recipients, total_opens, unique_openers, likely_forwards, status)')
    .eq('pixel_token', token)
    .maybeSingle()

  if (!pixel) return

  const email: any = Array.isArray((pixel as any).koto_tracked_emails)
    ? (pixel as any).koto_tracked_emails[0]
    : (pixel as any).koto_tracked_emails
  if (!email) return

  const agencyId = email.agency_id || (pixel as any).agency_id

  // ── Forward detection ──────────────────────────────────
  // If the first open from this token was from a different IP
  // and > 30 minutes ago, treat the current open as a likely forward.
  let isLikelyForward = false
  let forwardConfidence = 0
  try {
    const { data: priorOpens } = await s
      .from('koto_email_opens')
      .select('ip_address, opened_at')
      .eq('pixel_token', token)
      .order('opened_at', { ascending: true })
      .limit(1)

    if (priorOpens && priorOpens.length > 0) {
      const first = priorOpens[0]
      const hoursSinceFirst = (Date.now() - new Date(first.opened_at).getTime()) / 3_600_000
      if (first.ip_address && ip && first.ip_address !== ip && hoursSinceFirst > 0.5) {
        isLikelyForward = true
        forwardConfidence = hoursSinceFirst > 24 ? 85 : hoursSinceFirst > 6 ? 70 : 55
      }
    }
  } catch { /* best-effort */ }

  // ── IP geolocation (best-effort, 2s cap) ───────────────
  let locationCity: string | null = null
  let locationCountry: string | null = null
  try {
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        signal: AbortSignal.timeout(2000),
      })
      if (r.ok) {
        const j: any = await r.json()
        locationCity = j?.city || null
        locationCountry = j?.country_name || null
      }
    }
  } catch { /* best-effort */ }

  // ── Insert the open row ────────────────────────────────
  try {
    await s.from('koto_email_opens').insert({
      tracked_email_id: email.id,
      agency_id: agencyId,
      pixel_token: token,
      recipient_email: (pixel as any).recipient_email || null,
      ip_address: ip || null,
      user_agent: ua || null,
      device_type: device,
      email_client: emailClient,
      location_city: locationCity,
      location_country: locationCountry,
      is_likely_forward: isLikelyForward,
      forward_confidence: forwardConfidence,
    })
  } catch { /* swallow */ }

  // ── Update aggregate stats on the parent email ─────────
  const priorTotal = email.total_opens || 0
  const isFirstEverOpen = priorTotal === 0
  const newTotalOpens = priorTotal + 1
  const newLikelyForwards = (email.likely_forwards || 0) + (isLikelyForward ? 1 : 0)

  const recipients: any[] = Array.isArray(email.recipients) ? email.recipients : []
  const nowISO = new Date().toISOString()
  const updatedRecipients = recipients.map((r) => {
    if (r && r.pixel_token === token) {
      return {
        ...r,
        opened_count: (r.opened_count || 0) + 1,
        first_opened_at: r.first_opened_at || nowISO,
        last_opened_at: nowISO,
      }
    }
    return r
  })
  const uniqueOpeners = updatedRecipients.filter((r: any) => r && (r.opened_count || 0) > 0).length

  const newStatus = isLikelyForward ? 'forwarded' : 'opened'

  try {
    await s
      .from('koto_tracked_emails')
      .update({
        total_opens: newTotalOpens,
        unique_openers: uniqueOpeners,
        likely_forwards: newLikelyForwards,
        status: newStatus,
        recipients: updatedRecipients,
        updated_at: nowISO,
      })
      .eq('id', email.id)
  } catch { /* swallow */ }

  // ── First-open notification ────────────────────────────
  if (isFirstEverOpen && agencyId) {
    const who = (pixel as any).recipient_name || (pixel as any).recipient_email || 'Someone'
    createNotification(
      s,
      agencyId,
      'email_opened',
      '📧 Email opened',
      `${who} opened your email`,
      '/email-tracking',
      '📧',
      { tracked_email_id: email.id, recipient: (pixel as any).recipient_email },
    ).catch(() => {})
  }
}

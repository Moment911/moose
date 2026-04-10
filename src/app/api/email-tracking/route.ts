import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

function randomToken(len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function pixelUrl(origin: string, token: string): string {
  return `${origin}/api/track/${token}`
}

function pixelHtml(url: string): string {
  return `<img src="${url}" width="1" height="1" style="display:none;border:0;outline:none;text-decoration:none;" alt="" />`
}

function resolveOrigin(req: NextRequest): string {
  return (
    req.headers.get('origin') ||
    req.headers.get('x-forwarded-host')?.replace(/^/, 'https://') ||
    'https://hellokoto.com'
  )
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || ''
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    // ── list ───────────────────────────────────────────
    if (action === 'list') {
      const status = searchParams.get('status') || ''
      const dateFrom = searchParams.get('date_from') || ''
      const dateTo = searchParams.get('date_to') || ''
      const search = (searchParams.get('search') || '').trim()

      let q = s
        .from('koto_tracked_emails')
        .select('*')
        .eq('agency_id', agencyId)
        .neq('status', 'deleted')
        .order('sent_at', { ascending: false })
        .limit(200)

      if (status && status !== 'all') q = q.eq('status', status)
      if (dateFrom) q = q.gte('sent_at', dateFrom)
      if (dateTo) q = q.lte('sent_at', dateTo)
      if (search) q = q.ilike('subject', `%${search}%`)

      const { data, error } = await q
      if (error) return Response.json({ error: error.message }, { status: 500 })

      // If searching and nothing matched on subject, also try recipient search
      let results = data || []
      if (search && results.length === 0) {
        const { data: all } = await s
          .from('koto_tracked_emails')
          .select('*')
          .eq('agency_id', agencyId)
          .neq('status', 'deleted')
          .order('sent_at', { ascending: false })
          .limit(200)
        const needle = search.toLowerCase()
        results = (all || []).filter((e: any) => {
          const recs = Array.isArray(e.recipients) ? e.recipients : []
          return recs.some((r: any) =>
            String(r?.email || '').toLowerCase().includes(needle) ||
            String(r?.name || '').toLowerCase().includes(needle),
          )
        })
      }

      return Response.json({ data: results })
    }

    // ── get ────────────────────────────────────────────
    if (action === 'get') {
      const id = searchParams.get('id') || ''
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

      const { data: email } = await s
        .from('koto_tracked_emails')
        .select('*')
        .eq('id', id)
        .eq('agency_id', agencyId)
        .maybeSingle()

      if (!email) return Response.json({ error: 'Not found' }, { status: 404 })

      const { data: opens } = await s
        .from('koto_email_opens')
        .select('*')
        .eq('tracked_email_id', id)
        .order('opened_at', { ascending: false })

      return Response.json({ data: { email, opens: opens || [] } })
    }

    // ── stats ──────────────────────────────────────────
    if (action === 'stats') {
      const { data: emails } = await s
        .from('koto_tracked_emails')
        .select('id, status, total_opens, total_recipients, unique_openers, likely_forwards, sent_at')
        .eq('agency_id', agencyId)
        .neq('status', 'deleted')
        .order('sent_at', { ascending: false })
        .limit(1000)

      const list = emails || []
      const totalSent = list.length
      const totalOpens = list.reduce((a, e: any) => a + (e.total_opens || 0), 0)
      const totalOpened = list.filter((e: any) => (e.unique_openers || 0) > 0).length
      const totalRecipients = list.reduce((a, e: any) => a + (e.total_recipients || 0), 0)
      const totalForwards = list.reduce((a, e: any) => a + (e.likely_forwards || 0), 0)
      const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
      const forwardRate = totalSent > 0 ? Math.round((totalForwards / Math.max(totalRecipients, 1)) * 100) : 0
      const avgOpensPerEmail = totalSent > 0 ? +(totalOpens / totalSent).toFixed(2) : 0

      // Breakdowns from the opens table
      const { data: opens } = await s
        .from('koto_email_opens')
        .select('device_type, email_client, opened_at')
        .eq('agency_id', agencyId)
        .order('opened_at', { ascending: false })
        .limit(5000)

      const byDevice: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 }
      const byClient: Record<string, number> = {}
      const byHour: number[] = Array.from({ length: 24 }, () => 0)

      ;(opens || []).forEach((o: any) => {
        const d = o.device_type || 'desktop'
        byDevice[d] = (byDevice[d] || 0) + 1
        const c = o.email_client || 'Unknown'
        byClient[c] = (byClient[c] || 0) + 1
        try {
          const h = new Date(o.opened_at).getHours()
          if (h >= 0 && h < 24) byHour[h]++
        } catch { /* ignore */ }
      })

      // Top clients, sorted
      const topClients = Object.entries(byClient)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, count]) => ({ name, count }))

      return Response.json({
        data: {
          total_sent: totalSent,
          total_opens: totalOpens,
          total_opened: totalOpened,
          total_recipients: totalRecipients,
          total_forwards: totalForwards,
          open_rate: openRate,
          forward_rate: forwardRate,
          avg_opens_per_email: avgOpensPerEmail,
          by_device: byDevice,
          top_clients: topClients,
          by_hour: byHour,
        },
      })
    }

    // ── gmail_status ───────────────────────────────────
    if (action === 'gmail_status') {
      const { data: conn } = await s
        .from('koto_gmail_connections')
        .select('id, gmail_email, is_active, created_at')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return Response.json({
        data: {
          connected: !!conn,
          email: conn?.gmail_email || null,
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const action = body.action || searchParams.get('action') || ''
    const s = sb()
    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY
    const origin = resolveOrigin(req)

    // ── create_tracked_email ───────────────────────────
    // Creates a tracked_email row plus one pixel row per recipient.
    // Returns per-recipient pixel_url + pixel_html the caller can embed.
    if (action === 'create_tracked_email') {
      const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
      const sentFrom = typeof body.sent_from === 'string' ? body.sent_from.trim() : null
      const gmailMessageId = body.gmail_message_id || null
      const gmailThreadId = body.gmail_thread_id || null
      const tags = Array.isArray(body.tags) ? body.tags : []
      const rawRecipients: Array<{ email: string; name?: string }> = Array.isArray(body.recipients) ? body.recipients : []

      if (!subject) return Response.json({ error: 'Missing subject' }, { status: 400 })
      if (rawRecipients.length === 0) return Response.json({ error: 'At least one recipient is required' }, { status: 400 })

      // Build recipients jsonb with per-recipient pixel tokens
      const enriched = rawRecipients
        .filter((r) => r && typeof r.email === 'string' && r.email.trim())
        .map((r) => ({
          email: r.email.trim(),
          name: (r.name || '').trim() || null,
          pixel_token: randomToken(32),
          opened_count: 0,
          first_opened_at: null,
          last_opened_at: null,
        }))

      // Insert tracked_email first
      const { data: created, error: insErr } = await s
        .from('koto_tracked_emails')
        .insert({
          agency_id: agencyId,
          subject,
          sent_from: sentFrom,
          recipients: enriched,
          total_recipients: enriched.length,
          gmail_message_id: gmailMessageId,
          gmail_thread_id: gmailThreadId,
          tags,
          status: 'sent',
        })
        .select('id')
        .single()

      if (insErr || !created) {
        return Response.json({ error: insErr?.message || 'Failed to create tracked email' }, { status: 500 })
      }

      // Insert a pixel row per recipient
      const pixelRows = enriched.map((r) => ({
        agency_id: agencyId,
        tracked_email_id: created.id,
        pixel_token: r.pixel_token,
        recipient_email: r.email,
        recipient_name: r.name,
      }))
      if (pixelRows.length > 0) {
        await s.from('koto_email_tracking_pixels').insert(pixelRows)
      }

      // Build the payload the client will copy into the email body
      const recipientsWithPixels = enriched.map((r) => {
        const url = pixelUrl(origin, r.pixel_token)
        return {
          email: r.email,
          name: r.name,
          pixel_token: r.pixel_token,
          pixel_url: url,
          pixel_html: pixelHtml(url),
        }
      })

      return Response.json({
        data: {
          tracked_email_id: created.id,
          recipients_with_pixels: recipientsWithPixels,
        },
      })
    }

    // ── generate_pixel_html ────────────────────────────
    // Regenerate the img tag for an existing tracked email (all recipients
    // or one specific recipient). Useful for re-copying into the email body.
    if (action === 'generate_pixel_html') {
      const id = body.tracked_email_id
      if (!id) return Response.json({ error: 'Missing tracked_email_id' }, { status: 400 })

      const { data: pixels } = await s
        .from('koto_email_tracking_pixels')
        .select('pixel_token, recipient_email, recipient_name')
        .eq('tracked_email_id', id)

      const recipientFilter = (body.recipient_email || '').toLowerCase()
      const filtered = (pixels || []).filter((p: any) =>
        recipientFilter ? String(p.recipient_email || '').toLowerCase() === recipientFilter : true,
      )

      return Response.json({
        data: filtered.map((p: any) => {
          const url = pixelUrl(origin, p.pixel_token)
          return {
            email: p.recipient_email,
            name: p.recipient_name,
            pixel_token: p.pixel_token,
            pixel_url: url,
            pixel_html: pixelHtml(url),
          }
        }),
      })
    }

    // ── delete (soft) ──────────────────────────────────
    if (action === 'delete') {
      const id = body.id
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      await s
        .from('koto_tracked_emails')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('agency_id', agencyId)
      return Response.json({ ok: true })
    }

    // ── gmail_connect ──────────────────────────────────
    // Stores an already-exchanged token blob. For the OAuth code
    // exchange flow itself see src/app/api/email-tracking/gmail/route.ts.
    if (action === 'gmail_connect') {
      const gmailEmail = body.gmail_email || ''
      const accessToken = body.access_token || ''
      const refreshToken = body.refresh_token || ''
      const expiresIn = Number(body.expires_in) || 3600
      const scope = body.scope || ''

      if (!gmailEmail || !accessToken) {
        return Response.json({ error: 'Missing gmail_email or access_token' }, { status: 400 })
      }

      await s
        .from('koto_gmail_connections')
        .update({ is_active: false })
        .eq('agency_id', agencyId)

      const { error } = await s.from('koto_gmail_connections').insert({
        agency_id: agencyId,
        gmail_email: gmailEmail,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scope,
        is_active: true,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })

      return Response.json({ data: { connected: true, email: gmailEmail } })
    }

    // ── gmail_disconnect ───────────────────────────────
    if (action === 'gmail_disconnect') {
      await s
        .from('koto_gmail_connections')
        .update({ is_active: false })
        .eq('agency_id', agencyId)
      return Response.json({ data: { connected: false } })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

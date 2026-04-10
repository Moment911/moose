import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAgencyId } from '@/lib/apiAuth'
import { createNotification } from '@/lib/notifications'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const DEFAULT_AGENCY = '00000000-0000-0000-0000-000000000099'

function randomToken(len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || ''
    const s = sb()

    // Public view — no auth, lookup by token. Accepts either share_token
    // or the legacy public_token so existing URLs keep working.
    if (action === 'public_view') {
      const token = searchParams.get('token') || ''
      if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

      // Lookup — prefer share_token, fall back to public_token
      let proposal: any = null
      {
        const { data } = await s.from('proposals')
          .select('*, clients(name, industry)')
          .eq('share_token', token)
          .maybeSingle()
        if (data) proposal = data
      }
      if (!proposal) {
        const { data } = await s.from('proposals')
          .select('*, clients(name, industry)')
          .eq('public_token', token)
          .maybeSingle()
        if (data) proposal = data
      }

      if (!proposal) return Response.json({ error: 'Not found' }, { status: 404 })

      // Pull sections
      const { data: sections } = await s.from('proposal_sections')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('sort_order')

      // Device detection for the view event
      const ua = req.headers.get('user-agent') || ''
      const device = /Mobile|iPhone|Android/i.test(ua)
        ? 'mobile'
        : /iPad|Tablet/i.test(ua)
          ? 'tablet'
          : 'desktop'

      const wasFirstView = (proposal.view_count || 0) === 0
      const nowISO = new Date().toISOString()
      const existingEvents = Array.isArray(proposal.view_events) ? proposal.view_events : []
      const newEvent = {
        id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ts: nowISO,
        ua,
        device,
      }
      const trimmedEvents = [...existingEvents, newEvent].slice(-100)

      // Update view tracking — fire-and-forget on our side, still await so the
      // caller sees the updated count if it re-fetches quickly
      await s.from('proposals').update({
        view_count: (proposal.view_count || 0) + 1,
        last_viewed_at: nowISO,
        view_events: trimmedEvents,
        // Also keep the legacy status transition for existing consumers
        status: proposal.status === 'sent' ? 'viewed' : proposal.status,
        viewed_at: proposal.viewed_at || nowISO,
      }).eq('id', proposal.id)

      // First-view notification (fire and forget)
      if (wasFirstView && proposal.agency_id) {
        createNotification(
          s,
          proposal.agency_id,
          'proposal_viewed',
          '📄 Proposal opened',
          `${proposal.clients?.name || proposal.title || 'Someone'} just opened your proposal`,
          '/proposals',
          '📄',
          { proposal_id: proposal.id, device },
        ).catch(() => {})
      }

      return Response.json({
        data: {
          proposal: {
            ...proposal,
            view_count: (proposal.view_count || 0) + 1,
            last_viewed_at: nowISO,
          },
          sections: sections || [],
        },
      })
    }

    const agencyId = resolveAgencyId(req, searchParams) || DEFAULT_AGENCY

    if (action === 'get_views') {
      const id = searchParams.get('id') || ''
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
      const { data } = await s.from('proposals')
        .select('id, title, view_count, last_viewed_at, view_events, share_sent_at, share_token, public_token')
        .eq('id', id)
        .eq('agency_id', agencyId)
        .maybeSingle()
      if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
      return Response.json({ data })
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

    // ── track_view_duration ──────────────────────────────
    // Public beacon endpoint (no auth). Appends a duration_ms to the most
    // recent view_event so we can see how long the recipient spent reading.
    if (action === 'track_view_duration') {
      const token = body.token || ''
      const durationMs = Number(body.duration_ms) || 0
      if (!token || !durationMs) return Response.json({ ok: true })

      // Lookup — prefer share_token, fall back to public_token
      let proposal: any = null
      {
        const { data } = await s.from('proposals')
          .select('id, view_events')
          .eq('share_token', token)
          .maybeSingle()
        if (data) proposal = data
      }
      if (!proposal) {
        const { data } = await s.from('proposals')
          .select('id, view_events')
          .eq('public_token', token)
          .maybeSingle()
        if (data) proposal = data
      }
      if (!proposal) return Response.json({ ok: true })

      const events = Array.isArray(proposal.view_events) ? [...proposal.view_events] : []
      if (events.length > 0) {
        const last = { ...events[events.length - 1] }
        last.duration_ms = Math.max(last.duration_ms || 0, durationMs)
        events[events.length - 1] = last
        await s.from('proposals').update({ view_events: events }).eq('id', proposal.id)
      }
      return Response.json({ ok: true })
    }

    const agencyId = resolveAgencyId(req, searchParams, body) || DEFAULT_AGENCY

    // ── share_proposal ───────────────────────────────────
    if (action === 'share_proposal') {
      const { proposal_id, recipient_email, recipient_name, send_email } = body
      if (!proposal_id) return Response.json({ error: 'Missing proposal_id' }, { status: 400 })

      const { data: proposal } = await s.from('proposals')
        .select('*, clients(name, industry)')
        .eq('id', proposal_id)
        .eq('agency_id', agencyId)
        .maybeSingle()
      if (!proposal) return Response.json({ error: 'Not found' }, { status: 404 })

      // Ensure a share_token exists
      let shareToken: string = proposal.share_token || proposal.public_token || ''
      if (!shareToken) {
        shareToken = randomToken(32)
        await s.from('proposals').update({
          share_token: shareToken,
        }).eq('id', proposal_id)
      }

      await s.from('proposals').update({
        share_sent_at: new Date().toISOString(),
        status: proposal.status === 'draft' ? 'sent' : proposal.status,
        sent_at: proposal.sent_at || new Date().toISOString(),
      }).eq('id', proposal_id)

      const origin = req.headers.get('origin')
        || req.headers.get('referer')?.replace(/\/(?:proposals|api).*/, '')
        || 'https://hellokoto.com'
      const shareUrl = `${origin}/proposals/view/${shareToken}`

      // Optional email via Resend
      let sent = false
      if (send_email && recipient_email && process.env.RESEND_API_KEY) {
        try {
          const { sendEmail } = await import('@/lib/emailService')
          const subject = `${proposal.title || 'Your proposal'} — from Koto`
          const greeting = recipient_name ? `Hi ${recipient_name},` : 'Hi,'
          const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:0; padding:0; background:#F7F7F6;">
  <div style="max-width:560px; margin:0 auto; padding:32px 20px;">
    <div style="background:#fff; border-radius:12px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="font-size:12px; font-weight:800; color:#00C2CB; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px;">
        Proposal ready for review
      </div>
      <h1 style="font-size:22px; color:#111; margin:0 0 16px;">${proposal.title || 'Your proposal'}</h1>
      <p style="font-size:14px; color:#374151; line-height:1.6; margin:0 0 20px;">
        ${greeting}<br><br>
        Here's the proposal we prepared for you. Take a look and let us know what you think.
      </p>
      <a href="${shareUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;">
        View Proposal
      </a>
      <p style="font-size:12px; color:#9ca3af; margin:20px 0 0;">
        Or open this link directly: <br>
        <a href="${shareUrl}" style="color:#00C2CB;">${shareUrl}</a>
      </p>
    </div>
    <div style="text-align:center; font-size:11px; color:#9ca3af; margin-top:18px;">
      Powered by Koto · hellokoto.com
    </div>
  </div>
</body></html>`
          const res = await sendEmail(recipient_email, subject, html, agencyId)
          if (res?.success) sent = true
        } catch { /* non-fatal */ }
      }

      return Response.json({
        data: {
          share_url: shareUrl,
          token: shareToken,
          sent,
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

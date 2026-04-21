import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getTimezoneForPhone } from '@/lib/callTimeChecker'
import { metaFromPhone } from '@/lib/scout/areaCodeMeta'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ─────────────────────────────────────────────────────────────
// State-specific calling-hour overrides (stricter than TCPA 8-21)
// Source: individual state telemarketing statutes.
// Format: { start: hour (0-23), end: hour (0-23, exclusive) }
// ─────────────────────────────────────────────────────────────
const STATE_CALL_WINDOWS: Record<string, { start: number; end: number }> = {
  // Default TCPA: 8:00 AM – 9:00 PM
  // States with stricter rules override here:
  FL: { start: 8, end: 20 },   // Florida: 8am-8pm
  GA: { start: 8, end: 20 },   // Georgia: 8am-8pm (weekdays)
  IN: { start: 8, end: 20 },   // Indiana: 8am-8pm
  MA: { start: 8, end: 20 },   // Massachusetts: 8am-8pm
  ME: { start: 9, end: 21 },   // Maine: 9am-9pm
  MS: { start: 8, end: 20 },   // Mississippi: 8am-8pm
  OK: { start: 9, end: 21 },   // Oklahoma: 9am-9pm
  OR: { start: 9, end: 21 },   // Oregon: 9am-9pm
  TX: { start: 9, end: 21 },   // Texas: 9am-9pm (residential)
  WI: { start: 8, end: 20 },   // Wisconsin: 8am-8pm
  WV: { start: 9, end: 21 },   // West Virginia: 9am-9pm
  WY: { start: 9, end: 20 },   // Wyoming: 9am-8pm
}

const TCPA_DEFAULT = { start: 8, end: 21 }

export type CallWindowResult = {
  allowed: boolean
  reason?: string
  timezone: string
  localTime: string
  window: { start: number; end: number }
  stateCode?: string
  nextWindowIso?: string
}

/**
 * Determine the effective calling window for a phone number.
 *
 * Priority:
 *   1. Per-phone TCPA record (call_window_start/end + timezone) — agency custom
 *   2. State-specific override (from area code → state lookup)
 *   3. TCPA federal default (8am–9pm prospect local time)
 *
 * If the agent has jurisdictions_active set, also checks that the prospect's
 * state is in the allowed list.
 */
export async function callWindowGate(
  phone: string,
  agencyId: string,
  agentJurisdictions?: string[] | null,
): Promise<CallWindowResult> {
  const supabase = getSupabase()

  // 1. Resolve timezone — prefer TCPA record, fall back to area-code lookup
  let tz = getTimezoneForPhone(phone)
  let customWindow: { start: number; end: number } | null = null

  const { data: tcpa } = await supabase
    .from('koto_voice_tcpa_records')
    .select('timezone, call_window_start, call_window_end, jurisdictions_active')
    .eq('phone', phone)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (tcpa?.timezone) {
    tz = tcpa.timezone
  }

  // Parse custom window from TCPA record (stored as time, e.g. '08:00')
  if (tcpa?.call_window_start && tcpa?.call_window_end) {
    const startH = parseTimeToHour(tcpa.call_window_start)
    const endH = parseTimeToHour(tcpa.call_window_end)
    if (startH !== null && endH !== null) {
      customWindow = { start: startH, end: endH }
    }
  }

  // 2. Resolve state code from area code meta
  const meta = metaFromPhone(phone)
  const stateCode = meta?.state_code || null

  // 3. Jurisdiction check — if agent restricts jurisdictions, enforce
  if (agentJurisdictions && agentJurisdictions.length > 0 && stateCode) {
    if (!agentJurisdictions.includes(stateCode)) {
      const localTime = getLocalTime(tz)
      return {
        allowed: false,
        reason: `jurisdiction_not_active: ${stateCode} not in agent jurisdictions`,
        timezone: tz,
        localTime,
        window: TCPA_DEFAULT,
        stateCode: stateCode || undefined,
      }
    }
  }

  // 4. Determine effective window: custom > state-specific > TCPA default
  let effectiveWindow: { start: number; end: number }
  if (customWindow) {
    effectiveWindow = customWindow
  } else if (stateCode && STATE_CALL_WINDOWS[stateCode]) {
    effectiveWindow = STATE_CALL_WINDOWS[stateCode]
  } else {
    effectiveWindow = TCPA_DEFAULT
  }

  // 5. Check current local time against window
  const localTime = getLocalTime(tz)
  const { hour, minute } = parseLocalTime(localTime)
  const allowed = hour >= effectiveWindow.start && hour < effectiveWindow.end

  const result: CallWindowResult = {
    allowed,
    timezone: tz,
    localTime,
    window: effectiveWindow,
    stateCode: stateCode || undefined,
  }

  if (!allowed) {
    result.reason = hour >= effectiveWindow.end
      ? `after_hours: ${localTime} local (window closes at ${effectiveWindow.end}:00)`
      : `before_hours: ${localTime} local (window opens at ${effectiveWindow.start}:00)`
    result.nextWindowIso = computeNextWindow(tz, effectiveWindow.start, hour, minute)
  }

  return result
}

// ─── Helpers ─────────────────────────────────────────────────

/** Get HH:MM in the target timezone. */
function getLocalTime(timezone: string): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const h = parts.find(p => p.type === 'hour')?.value || '0'
  const m = parts.find(p => p.type === 'minute')?.value || '0'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

function parseLocalTime(localTime: string): { hour: number; minute: number } {
  const [h, m] = localTime.split(':').map(Number)
  return { hour: h, minute: m }
}

/** Parse a Postgres time value like '08:00' or '08:00:00' to an hour integer. */
function parseTimeToHour(t: string): number | null {
  if (!t) return null
  const h = parseInt(t.split(':')[0], 10)
  return Number.isNaN(h) ? null : h
}

/** Compute an ISO-ish string for the next opening of the call window. */
function computeNextWindow(
  timezone: string,
  windowStartHour: number,
  currentHour: number,
  _currentMinute: number,
): string {
  const now = new Date()
  // If past end-of-window, next opening is tomorrow; if before start, it's today
  const addDay = currentHour >= windowStartHour ? 1 : 0
  const target = new Date(now)
  if (addDay) target.setDate(target.getDate() + 1)

  const df = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = df.formatToParts(target)
  const y = parts.find(p => p.type === 'year')?.value
  const mo = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${mo}-${d} ${String(windowStartHour).padStart(2, '0')}:00 ${timezone}`
}

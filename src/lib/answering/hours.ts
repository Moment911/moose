/**
 * Timezone-aware business hours utility for the answering service agent prompt.
 * Ported from backend/src/utils/hours.js, plus a Koto-shape adapter so it works
 * with the legacy AnsweringServicePage hours format too:
 *   { Mon: { enabled, open, close }, ... }  ->  { weekly: { mon: [{open,close}], ... } }
 */
export type HoursRange = { open: string; close: string }
export type WeeklyHours = Record<string, HoursRange[]>
export type HoursHoliday = { date: string; name?: string; closed?: boolean; open?: string; close?: string }
export type HoursConfig = {
  timezone?: string
  weekly?: WeeklyHours
  holidays?: HoursHoliday[]
}

const DAY_NAMES: Record<string, string> = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
}

function getZonedParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value])) as Record<string, string>
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday.toLowerCase().slice(0, 3),
  }
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * If the input looks like the legacy Koto AnsweringServicePage shape
 * ({ Mon: { enabled, open, close }, ... }), normalise it to { weekly: {...} }.
 */
export function normaliseHours(input: any): HoursConfig {
  if (!input) return { weekly: {} }
  if (input.weekly) return input as HoursConfig
  const dayMap: Record<string, string> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' }
  const weekly: WeeklyHours = {}
  for (const [k, v] of Object.entries(input)) {
    const slug = dayMap[k] || k.toLowerCase().slice(0, 3)
    const day = v as any
    if (day?.enabled && day.open && day.close) weekly[slug] = [{ open: day.open, close: day.close }]
    else weekly[slug] = []
  }
  return { weekly, timezone: input.timezone }
}

export function isWithinHours(hours: any, fallbackTimezone?: string, now: Date = new Date()): boolean {
  const norm = normaliseHours(hours)
  if (!norm.weekly || Object.keys(norm.weekly).length === 0) return true
  const tz = norm.timezone || fallbackTimezone || 'America/New_York'
  const { date, time, weekday } = getZonedParts(now, tz)
  const minutes = timeStrToMinutes(time)

  const holiday = norm.holidays?.find(h => h.date === date)
  if (holiday) {
    if (holiday.closed) return false
    if (holiday.open && holiday.close) {
      return minutes >= timeStrToMinutes(holiday.open) && minutes < timeStrToMinutes(holiday.close)
    }
  }

  const ranges = norm.weekly?.[weekday] || []
  return ranges.some(r =>
    minutes >= timeStrToMinutes(r.open) && minutes < timeStrToMinutes(r.close)
  )
}

export function describeHours(hours: any, fallbackTimezone?: string): string {
  const norm = normaliseHours(hours)
  if (!norm.weekly || Object.keys(norm.weekly).length === 0) {
    return 'No hours configured -- always available.'
  }
  const tz = norm.timezone || fallbackTimezone || 'America/New_York'
  const lines: string[] = [`All times ${tz}.`]

  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const ranges = norm.weekly?.[day] || []
    if (ranges.length === 0) lines.push(`${DAY_NAMES[day]}: closed`)
    else lines.push(`${DAY_NAMES[day]}: ${ranges.map(r => `${r.open}-${r.close}`).join(', ')}`)
  }

  if (norm.holidays?.length) {
    lines.push('Holiday overrides:')
    for (const h of norm.holidays) {
      lines.push(`  ${h.date}${h.name ? ` (${h.name})` : ''}: ${h.closed ? 'closed' : `${h.open}-${h.close}`}`)
    }
  }

  return lines.join('\n')
}

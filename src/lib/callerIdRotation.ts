import 'server-only' // fails the build if this module is ever imported from a client component
// ── Caller ID Rotation ───────────────────────────────────────────────────────
// Rotates through phone numbers to maximize answer rates and avoid spam flagging.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface RotationResult {
  number: string
  number_id: string
  match_type: 'area_code' | 'state' | 'default'
  reason: string
}

const MAX_CALLS_PER_HOUR = 30
const MIN_REST_HOURS = 2
const MIN_ANSWER_RATE = 20
const SPAM_THRESHOLD = 70

export async function getRotationNumber(
  prospectPhone: string,
  agencyId: string,
): Promise<RotationResult | null> {
  const supabase = getSupabase()
  const prospectAreaCode = extractAreaCode(prospectPhone)
  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - MIN_REST_HOURS * 60 * 60 * 1000)

  // Get all agency numbers that aren't rotated out or spam-flagged
  const { data: numbers } = await supabase
    .from('koto_phone_numbers')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .or('is_rotated_out.eq.false,is_rotated_out.is.null')

  if (!numbers?.length) return null

  // Filter: skip numbers over hourly limit or with high spam score
  const eligible = numbers.filter(n => {
    if ((n.calls_this_hour || 0) >= MAX_CALLS_PER_HOUR) return false
    if ((n.spam_score || 0) >= SPAM_THRESHOLD) return false
    return true
  })

  if (!eligible.length) return null

  // Prefer numbers not used in last 2 hours
  const rested = eligible.filter(n =>
    !n.last_used_at || new Date(n.last_used_at) < twoHoursAgo
  )
  const pool = rested.length > 0 ? rested : eligible

  // 1. Try area code match
  const areaMatch = pool.find(n => extractAreaCode(n.phone_number) === prospectAreaCode)
  if (areaMatch) {
    await markNumberUsed(supabase, areaMatch.id)
    return { number: areaMatch.phone_number, number_id: areaMatch.id, match_type: 'area_code', reason: `Matched area code ${prospectAreaCode}` }
  }

  // 2. Try state match (first 3 area codes often map to states)
  const stateNumbers = pool.filter(n => isSameState(n.phone_number, prospectPhone))
  if (stateNumbers.length > 0) {
    const pick = stateNumbers[Math.floor(Math.random() * stateNumbers.length)]
    await markNumberUsed(supabase, pick.id)
    return { number: pick.phone_number, number_id: pick.id, match_type: 'state', reason: 'Same state match' }
  }

  // 3. Use least-recently-used default
  const sorted = pool.sort((a, b) => {
    const aTime = a.last_used_at ? new Date(a.last_used_at).getTime() : 0
    const bTime = b.last_used_at ? new Date(b.last_used_at).getTime() : 0
    return aTime - bTime
  })

  const pick = sorted[0]
  await markNumberUsed(supabase, pick.id)
  return { number: pick.phone_number, number_id: pick.id, match_type: 'default', reason: 'Least recently used' }
}

async function markNumberUsed(supabase: any, numberId: string) {
  await supabase
    .from('koto_phone_numbers')
    .update({
      last_used_at: new Date().toISOString(),
      calls_this_hour: supabase.rpc ? 1 : 1, // Would use increment in production
      calls_today: supabase.rpc ? 1 : 1,
    })
    .eq('id', numberId)
}

export async function checkSpamHealth(agencyId: string): Promise<Array<{
  number: string
  answer_rate: number
  spam_score: number
  status: 'healthy' | 'warning' | 'flagged'
}>> {
  const supabase = getSupabase()
  const { data: numbers } = await supabase
    .from('koto_phone_numbers')
    .select('phone_number, answer_rate_7day, spam_score, calls_today')
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  return (numbers || []).map((n: any) => ({
    number: n.phone_number,
    answer_rate: n.answer_rate_7day || 0,
    spam_score: n.spam_score || 0,
    status: (n.spam_score || 0) >= SPAM_THRESHOLD ? 'flagged' :
            (n.answer_rate_7day || 100) < MIN_ANSWER_RATE ? 'warning' : 'healthy',
  }))
}

function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1, 4)
  if (digits.length === 10) return digits.substring(0, 3)
  return digits.substring(0, 3)
}

// Simple state mapping for major area codes
function isSameState(phone1: string, phone2: string): boolean {
  const ac1 = extractAreaCode(phone1)
  const ac2 = extractAreaCode(phone2)
  const stateMap: Record<string, string> = {
    '212': 'NY', '718': 'NY', '917': 'NY', '646': 'NY', '347': 'NY', '929': 'NY', '516': 'NY', '631': 'NY',
    '305': 'FL', '786': 'FL', '954': 'FL', '754': 'FL', '561': 'FL', '407': 'FL', '321': 'FL', '813': 'FL', '727': 'FL',
    '213': 'CA', '310': 'CA', '323': 'CA', '424': 'CA', '818': 'CA', '626': 'CA', '714': 'CA', '949': 'CA', '415': 'CA',
    '214': 'TX', '972': 'TX', '469': 'TX', '817': 'TX', '713': 'TX', '281': 'TX', '832': 'TX', '512': 'TX', '210': 'TX',
    '312': 'IL', '773': 'IL', '708': 'IL', '847': 'IL', '630': 'IL',
  }
  return stateMap[ac1] === stateMap[ac2] && !!stateMap[ac1]
}

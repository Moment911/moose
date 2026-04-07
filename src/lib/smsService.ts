import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function logComm(params: {
  channel: string; recipient: string; body_preview?: string;
  status: string; provider: string; provider_id?: string;
  error_message?: string; agency_id?: string;
}) {
  try {
    await fetch((process.env.NEXT_PUBLIC_SITE_URL || '') + '/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_comm', ...params }),
    })
  } catch {}
}

async function billSMS(agencyId?: string) {
  if (!agencyId) return
  try {
    await fetch((process.env.NEXT_PUBLIC_SITE_URL || '') + '/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_usage', agency_id: agencyId,
        feature: 'sms_outbound', quantity: 1, unit: 'messages',
        unit_cost: 0.0075,
      }),
    })
  } catch {}
}

// Look up agency's default SMS number
async function getAgencySMSNumber(agencyId: string): Promise<string | null> {
  try {
    const db = getDb()
    const { data } = await db.from('koto_phone_numbers')
      .select('phone_number')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .eq('is_default_sms', true)
      .single()
    if (data?.phone_number) return data.phone_number
    // Fallback: any active number with SMS capability
    const { data: any_num } = await db.from('koto_phone_numbers')
      .select('phone_number')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .in('purpose', ['sms', 'both'])
      .limit(1)
      .single()
    return any_num?.phone_number || null
  } catch { return null }
}

export async function sendSMS(
  to: string,
  message: string,
  agencyId?: string,
  isSystemAlert?: boolean
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const kotoNumber = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken) return { success: false, error: 'Twilio not configured' }

  // Determine FROM number:
  // System alerts (errors, platform notifications) → always use Koto's number
  // Agency messages (appointments, summaries) → use agency's own number
  let from = kotoNumber || ''
  if (!isSystemAlert && agencyId) {
    const agencyNum = await getAgencySMSNumber(agencyId)
    if (agencyNum) {
      from = agencyNum
    } else {
      console.warn(`[SMS] Agency ${agencyId} has no SMS number — falling back to Koto platform number`)
    }
  }

  if (!from) return { success: false, error: 'No SMS number available' }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: from, Body: message }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        logComm({
          channel: 'sms', recipient: to, body_preview: message.slice(0, 120),
          status: 'sent', provider: 'twilio', provider_id: data.sid, agency_id: agencyId,
        })
        billSMS(agencyId)
        return { success: true, sid: data.sid }
      }
      if (attempt === 2) {
        logComm({
          channel: 'sms', recipient: to, body_preview: message.slice(0, 120),
          status: 'failed', provider: 'twilio', error_message: data.message || 'SMS failed', agency_id: agencyId,
        })
        return { success: false, error: data.message || 'SMS failed' }
      }
    } catch (e: any) {
      if (attempt === 2) {
        logComm({
          channel: 'sms', recipient: to, body_preview: message.slice(0, 120),
          status: 'failed', provider: 'twilio', error_message: e.message, agency_id: agencyId,
        })
        return { success: false, error: e.message }
      }
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
  return { success: false, error: 'Max retries exceeded' }
}

// --- SMS Template Functions ---

export function appointmentConfirmation(
  name: string,
  closerName: string,
  datetime: string
): string {
  return `Hi ${name}! Your appointment with ${closerName} has been confirmed for ${datetime}. Reply STOP to opt out.`
}

export function appointmentReminder24h(
  name: string,
  closerName: string,
  time: string
): string {
  return `Hi ${name}, this is a reminder that you have an appointment with ${closerName} tomorrow at ${time}. We look forward to speaking with you! Reply STOP to opt out.`
}

export function appointmentReminder1h(
  name: string,
  closerName: string,
  link: string
): string {
  return `Hi ${name}, your appointment with ${closerName} starts in 1 hour. Join here: ${link} — Reply STOP to opt out.`
}

export function inboundCallSummary(
  callerName: string,
  summary: string,
  duration: string,
  urgency: string
): string {
  return `Inbound call from ${callerName} (${duration}). Urgency: ${urgency}. Summary: ${summary}`
}

export function missedCallAlert(number: string, time: string): string {
  return `Missed call from ${number} at ${time}. Please follow up as soon as possible.`
}

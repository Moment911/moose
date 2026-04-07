export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !from) return { success: false, error: 'Twilio not configured' }

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
      if (res.ok) return { success: true, sid: data.sid }
      if (attempt === 2) return { success: false, error: data.message || 'SMS failed' }
    } catch (e: any) {
      if (attempt === 2) return { success: false, error: e.message }
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

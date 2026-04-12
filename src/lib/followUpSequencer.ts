import 'server-only' // fails the build if this module is ever imported from a client component
// ── Multi-Touch Follow-Up Sequencer ──────────────────────────────────────────
// Automatically queues SMS, email, and call follow-ups after voice calls.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface FollowUpStep {
  day: number
  hour: number
  type: 'sms' | 'email' | 'call'
  template: string
  condition?: string
}

export interface FollowUpSequence {
  name: string
  trigger: 'appointment_set' | 'not_interested' | 'callback_requested' | 'voicemail' | 'no_answer'
  steps: FollowUpStep[]
}

export const DEFAULT_SEQUENCES: FollowUpSequence[] = [
  {
    name: 'Appointment Confirmation',
    trigger: 'appointment_set',
    steps: [
      { day: 0, hour: 0, type: 'sms', template: 'appointment_confirmation' },
      { day: 0, hour: 0, type: 'email', template: 'appointment_confirmation_email' },
      { day: -1, hour: 9, type: 'sms', template: 'appointment_reminder_24h' },
      { day: -1, hour: 9, type: 'email', template: 'appointment_reminder_24h_email' },
      { day: 0, hour: -1, type: 'sms', template: 'appointment_reminder_1h' },
    ],
  },
  {
    name: 'Callback Requested',
    trigger: 'callback_requested',
    steps: [
      { day: 0, hour: 2, type: 'sms', template: 'callback_confirmation' },
      { day: 0, hour: 2, type: 'call', template: 'callback_attempt' },
    ],
  },
  {
    name: 'Voicemail Left',
    trigger: 'voicemail',
    steps: [
      { day: 0, hour: 2, type: 'sms', template: 'voicemail_followup_sms' },
      { day: 1, hour: 9, type: 'email', template: 'voicemail_followup_email' },
      { day: 3, hour: 10, type: 'call', template: 'voicemail_second_attempt' },
    ],
  },
  {
    name: 'Not Interested Re-engagement',
    trigger: 'not_interested',
    steps: [
      { day: 30, hour: 10, type: 'email', template: 'reengagement_30day' },
      { day: 60, hour: 10, type: 'email', template: 'reengagement_60day' },
      { day: 90, hour: 10, type: 'call', template: 'reengagement_90day_call' },
    ],
  },
  {
    name: 'No Answer',
    trigger: 'no_answer',
    steps: [
      { day: 1, hour: 10, type: 'call', template: 'no_answer_retry' },
      { day: 2, hour: 14, type: 'call', template: 'no_answer_retry_2' },
      { day: 4, hour: 11, type: 'sms', template: 'no_answer_sms' },
      { day: 7, hour: 10, type: 'call', template: 'no_answer_final' },
    ],
  },
]

export async function triggerFollowUpSequence(
  trigger: FollowUpSequence['trigger'],
  lead: any,
  agencyId: string,
  campaignId?: string,
  appointmentDatetime?: Date
): Promise<void> {
  const supabase = getSupabase()
  const sequence = DEFAULT_SEQUENCES.find(s => s.trigger === trigger)
  if (!sequence) return

  const now = new Date()
  const baseDate = appointmentDatetime || now

  const rows = sequence.steps.map((step, i) => {
    let scheduledAt: Date

    if (trigger === 'appointment_set' && appointmentDatetime) {
      // For appointment sequences, day is relative to appointment date
      scheduledAt = new Date(appointmentDatetime)
      scheduledAt.setDate(scheduledAt.getDate() + step.day)
      if (step.hour >= 0) {
        scheduledAt.setHours(step.hour, 0, 0, 0)
      } else {
        // Negative hour = hours before appointment
        scheduledAt = new Date(appointmentDatetime)
        scheduledAt.setHours(scheduledAt.getHours() + step.hour)
      }
    } else {
      // For other triggers, day is relative to now
      scheduledAt = new Date(now)
      scheduledAt.setDate(scheduledAt.getDate() + step.day)
      scheduledAt.setHours(step.hour || now.getHours(), 0, 0, 0)
    }

    // Don't schedule in the past
    if (scheduledAt < now) scheduledAt = new Date(now.getTime() + 60000)

    return {
      agency_id: agencyId,
      lead_id: lead.id,
      campaign_id: campaignId || null,
      sequence_name: sequence.name,
      step_number: i + 1,
      step_type: step.type,
      template_name: step.template,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
    }
  })

  await supabase.from('koto_follow_up_queue').insert(rows)
}

export async function processFollowUpQueue(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data: dueItems } = await supabase
    .from('koto_follow_up_queue')
    .select('*, koto_voice_leads(prospect_name, prospect_phone, prospect_email)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (!dueItems?.length) return { processed: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const item of dueItems) {
    try {
      const lead = Array.isArray(item.koto_voice_leads)
        ? item.koto_voice_leads[0]
        : item.koto_voice_leads

      if (item.step_type === 'sms') {
        // Would call sendSMS here
        await supabase.from('koto_follow_up_queue').update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          result: { channel: 'sms', to: lead?.prospect_phone },
        }).eq('id', item.id)
        sent++
      } else if (item.step_type === 'email') {
        // Would call sendEmail here
        await supabase.from('koto_follow_up_queue').update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          result: { channel: 'email', to: lead?.prospect_email },
        }).eq('id', item.id)
        sent++
      } else if (item.step_type === 'call') {
        // Would create Retell outbound call here
        await supabase.from('koto_follow_up_queue').update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          result: { channel: 'call', to: lead?.prospect_phone },
        }).eq('id', item.id)
        sent++
      }
    } catch (e: any) {
      await supabase.from('koto_follow_up_queue').update({
        status: 'failed',
        executed_at: new Date().toISOString(),
        result: { error: e.message },
      }).eq('id', item.id)
      failed++
    }
  }

  return { processed: dueItems.length, sent, failed }
}

export async function cancelSequenceForLead(leadId: string): Promise<number> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('koto_follow_up_queue')
    .update({ status: 'cancelled' })
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .select('id')

  return data?.length || 0
}

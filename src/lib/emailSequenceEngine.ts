// ── Email Sequence Engine ────────────────────────────────────────────────────
// Multi-channel outbound sequences: email, SMS, call with personalization,
// AI generation, reply handling, and GHL sync.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Template Rendering ───────────────────────────────────────────────────────

export function renderTemplate(template: string, data: Record<string, any>): string {
  if (!template) return ''
  let result = template

  // Replace {{variable}} tokens
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    return val !== undefined && val !== null ? String(val) : ''
  })

  // Handle {{#if var}}...{{/if}} blocks
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return data[key] ? content : ''
  })

  return result.trim()
}

// ── Enrollment ───────────────────────────────────────────────────────────────

export async function enrollInSequence(
  sequenceId: string,
  contact: {
    lead_id?: string
    scout_lead_id?: string
    email?: string
    phone?: string
    name?: string
    business_name?: string
    ghl_contact_id?: string
  },
  personalizationData: any,
  agencyId: string
): Promise<string | null> {
  const supabase = getSupabase()

  // Check not already enrolled
  const { data: existing } = await supabase
    .from('koto_sequence_enrollments')
    .select('id')
    .eq('sequence_id', sequenceId)
    .eq('contact_email', contact.email || '')
    .in('status', ['active', 'paused'])
    .maybeSingle()

  if (existing) return existing.id

  // Check unsubscribe
  if (contact.email) {
    const { data: unsub } = await supabase
      .from('koto_unsubscribes')
      .select('id')
      .eq('email', contact.email)
      .maybeSingle()
    if (unsub) return null
  }

  // Get first step timing
  const { data: firstStep } = await supabase
    .from('koto_sequence_steps')
    .select('delay_days, delay_hours, send_hour')
    .eq('sequence_id', sequenceId)
    .eq('step_number', 1)
    .single()

  const now = new Date()
  const nextStepAt = new Date(now)
  if (firstStep) {
    nextStepAt.setDate(nextStepAt.getDate() + (firstStep.delay_days || 0))
    nextStepAt.setHours(firstStep.send_hour || 9, 0, 0, 0)
  }

  // Don't schedule in the past
  if (nextStepAt < now) nextStepAt.setTime(now.getTime() + 60000)

  const { data: enrollment } = await supabase
    .from('koto_sequence_enrollments')
    .insert({
      sequence_id: sequenceId,
      agency_id: agencyId,
      lead_id: contact.lead_id || null,
      scout_lead_id: contact.scout_lead_id || null,
      contact_email: contact.email || '',
      contact_phone: contact.phone || '',
      contact_name: contact.name || '',
      business_name: contact.business_name || '',
      ghl_contact_id: contact.ghl_contact_id || null,
      personalization_data: personalizationData || {},
      current_step: 0,
      next_step_at: nextStepAt.toISOString(),
      status: 'active',
    })
    .select('id')
    .single()

  // Update sequence stats
  await supabase.from('koto_email_sequences').update({
    total_enrolled: (await supabase.from('koto_sequence_enrollments').select('*', { count: 'exact', head: true }).eq('sequence_id', sequenceId)).count || 0,
  }).eq('id', sequenceId)

  return enrollment?.id || null
}

// ── Queue Processor ──────────────────────────────────────────────────────────

export async function processSequenceQueue(): Promise<{
  processed: number
  sent: number
  skipped: number
  failed: number
}> {
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data: dueEnrollments } = await supabase
    .from('koto_sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(50)

  if (!dueEnrollments?.length) return { processed: 0, sent: 0, skipped: 0, failed: 0 }

  let sent = 0, skipped = 0, failed = 0

  for (const enrollment of dueEnrollments) {
    try {
      const nextStepNum = (enrollment.current_step || 0) + 1

      // Get next step
      const { data: step } = await supabase
        .from('koto_sequence_steps')
        .select('*')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', nextStepNum)
        .single()

      if (!step) {
        // No more steps — mark completed
        await supabase.from('koto_sequence_enrollments').update({
          status: 'completed', completed_at: new Date().toISOString(),
        }).eq('id', enrollment.id)
        continue
      }

      // Check skip conditions
      if (step.skip_if_replied && enrollment.replied) { skipped++; await advanceStep(supabase, enrollment, step); continue }
      if (step.skip_if_appointed && enrollment.appointed) { skipped++; await advanceStep(supabase, enrollment, step); continue }

      // Check unsubscribe
      if (enrollment.contact_email) {
        const { data: unsub } = await supabase.from('koto_unsubscribes').select('id').eq('email', enrollment.contact_email).maybeSingle()
        if (unsub) {
          await supabase.from('koto_sequence_enrollments').update({ status: 'unsubscribed' }).eq('id', enrollment.id)
          skipped++; continue
        }
      }

      // Render templates
      const pData = enrollment.personalization_data || {}
      const subject = renderTemplate(step.subject_line || '', pData)
      const body = renderTemplate(step.body_template || '', pData)
      const smsBody = renderTemplate(step.sms_template || '', pData)

      // Send based on channel
      if (step.channel === 'email' && enrollment.contact_email) {
        const msgId = await sendEmailViaResend(enrollment.contact_email, subject, body, enrollment.agency_id)
        await supabase.from('koto_sequence_messages').insert({
          enrollment_id: enrollment.id, sequence_id: enrollment.sequence_id, step_id: step.id,
          agency_id: enrollment.agency_id, channel: 'email', direction: 'outbound',
          subject, body, to_email: enrollment.contact_email,
          status: msgId ? 'sent' : 'failed', resend_message_id: msgId,
          sent_at: new Date().toISOString(),
        })
        if (msgId) sent++; else failed++
      } else if (step.channel === 'sms' && enrollment.contact_phone) {
        await supabase.from('koto_sequence_messages').insert({
          enrollment_id: enrollment.id, sequence_id: enrollment.sequence_id, step_id: step.id,
          agency_id: enrollment.agency_id, channel: 'sms', direction: 'outbound',
          sms_body: smsBody, to_phone: enrollment.contact_phone,
          status: 'sent', sent_at: new Date().toISOString(),
        })
        sent++
      }

      // Log to timeline
      await supabase.from('koto_contact_timeline').insert({
        agency_id: enrollment.agency_id,
        lead_id: enrollment.lead_id,
        contact_email: enrollment.contact_email,
        business_name: enrollment.business_name,
        event_type: step.channel === 'email' ? 'email' : 'sms',
        event_title: step.channel === 'email' ? `Email: ${subject}` : `SMS sent`,
        event_body: step.channel === 'email' ? body.substring(0, 200) : smsBody,
        source: 'koto_sequence',
        source_id: enrollment.sequence_id,
        channel: step.channel,
        direction: 'outbound',
      })

      // Update step stats
      await supabase.from('koto_sequence_steps').update({
        total_sent: (step.total_sent || 0) + 1,
      }).eq('id', step.id)

      await advanceStep(supabase, enrollment, step)
    } catch (e: any) {
      console.error('Sequence step error:', e.message)
      failed++
    }
  }

  return { processed: dueEnrollments.length, sent, skipped, failed }
}

async function advanceStep(supabase: any, enrollment: any, currentStep: any) {
  const nextStepNum = (enrollment.current_step || 0) + 2 // current was +1, next is +2

  const { data: nextStep } = await supabase
    .from('koto_sequence_steps')
    .select('delay_days, delay_hours, send_hour')
    .eq('sequence_id', enrollment.sequence_id)
    .eq('step_number', nextStepNum)
    .maybeSingle()

  if (!nextStep) {
    await supabase.from('koto_sequence_enrollments').update({
      current_step: (enrollment.current_step || 0) + 1,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', enrollment.id)
    return
  }

  const nextAt = new Date()
  nextAt.setDate(nextAt.getDate() + (nextStep.delay_days || 0))
  nextAt.setHours(nextStep.send_hour || 9, 0, 0, 0)
  if (nextAt < new Date()) nextAt.setTime(Date.now() + 3600000)

  await supabase.from('koto_sequence_enrollments').update({
    current_step: (enrollment.current_step || 0) + 1,
    next_step_at: nextAt.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', enrollment.id)
}

// ── Email Sending ────────────────────────────────────────────────────────────

async function sendEmailViaResend(to: string, subject: string, body: string, agencyId: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null

  try {
    const unsubLink = `https://hellokoto.com/api/email/unsubscribe?email=${encodeURIComponent(to)}`
    const fullBody = `${body}<br><br><p style="font-size:11px;color:#999;">If you no longer wish to receive these emails, <a href="${unsubLink}">unsubscribe here</a>.</p>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Koto <noreply@hellokoto.com>',
        to: [to],
        subject,
        html: fullBody,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.id || null
  } catch { return null }
}

// ── Reply Handling ───────────────────────────────────────────────────────────

export async function handleEmailReply(
  inboundEmail: string,
  replyBody: string,
  subject: string
): Promise<void> {
  const supabase = getSupabase()

  // Find enrollment by email
  const { data: enrollment } = await supabase
    .from('koto_sequence_enrollments')
    .select('*')
    .eq('contact_email', inboundEmail)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment) return

  // Update enrollment
  await supabase.from('koto_sequence_enrollments').update({
    replied: true,
    replied_at: new Date().toISOString(),
    reply_content: replyBody.substring(0, 2000),
    status: 'replied',
    updated_at: new Date().toISOString(),
  }).eq('id', enrollment.id)

  // Log inbound message
  await supabase.from('koto_sequence_messages').insert({
    enrollment_id: enrollment.id,
    sequence_id: enrollment.sequence_id,
    agency_id: enrollment.agency_id,
    channel: 'email',
    direction: 'inbound',
    subject,
    body: replyBody,
    reply_body: replyBody,
    reply_from: inboundEmail,
    status: 'replied',
    replied_at: new Date().toISOString(),
  })

  // Log to timeline
  await supabase.from('koto_contact_timeline').insert({
    agency_id: enrollment.agency_id,
    lead_id: enrollment.lead_id,
    contact_email: inboundEmail,
    business_name: enrollment.business_name,
    event_type: 'email_reply',
    event_title: `Reply: ${subject}`,
    event_body: replyBody.substring(0, 500),
    source: 'koto_sequence',
    channel: 'email',
    direction: 'inbound',
    outcome: 'replied',
  })

  // Update sequence stats
  const { count: replyCount } = await supabase
    .from('koto_sequence_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('sequence_id', enrollment.sequence_id)
    .eq('replied', true)

  await supabase.from('koto_email_sequences').update({
    total_replied: replyCount || 0,
  }).eq('id', enrollment.sequence_id)
}

// ── AI Sequence Generation ───────────────────────────────────────────────────

export async function generateSequenceWithAI(params: {
  industry: string
  pain_point: string
  sequence_type: string
  tone: string
  num_steps: number
  closer_name: string
  agency_name: string
}): Promise<{ steps: any[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { steps: [] }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate a ${params.num_steps}-step email sequence for cold outreach to ${params.industry} businesses.

Pain point: ${params.pain_point}
Type: ${params.sequence_type}
Tone: ${params.tone}
Closer name: ${params.closer_name}
Agency: ${params.agency_name}

Return JSON array of steps:
[{
  "step_number": 1,
  "channel": "email",
  "delay_days": 0,
  "send_hour": 9,
  "subject_line": "subject with {{first_name}} variable",
  "body_template": "HTML email body using {{first_name}}, {{business_name}}, {{city}}, {{pain_point}}, {{closer_name}}",
  "sms_template": "SMS version if channel is sms (under 160 chars)",
  "ai_focus": "pattern_interrupt"
}]

Step angles: 1=curiosity/pattern interrupt, 2=social proof, 3=pain agitation, 4=competitor comparison (gentle), 5=breakup/last chance.
Use natural conversational language. Short paragraphs. Include CTA to book meeting.
Return ONLY the JSON array.`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return { steps: [] }
    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const steps = JSON.parse(text.replace(/```json|```/g, '').trim())
    return { steps: Array.isArray(steps) ? steps : [] }
  } catch { return { steps: [] } }
}

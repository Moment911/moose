import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  enrollInSequence,
  processSequenceQueue,
  generateSequenceWithAI,
  handleEmailReply,
} from '@/lib/emailSequenceEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'list_sequences'
    const agencyId = searchParams.get('agency_id') || ''
    const s = sb()

    if (action === 'list_sequences') {
      const { data } = await s.from('koto_email_sequences').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
      return Response.json({ data: data || [] })
    }

    if (action === 'get_sequence') {
      const id = searchParams.get('id') || ''
      const { data: seq } = await s.from('koto_email_sequences').select('*').eq('id', id).single()
      const { data: steps } = await s.from('koto_sequence_steps').select('*').eq('sequence_id', id).order('step_number', { ascending: true })
      return Response.json({ sequence: seq, steps: steps || [] })
    }

    if (action === 'get_enrollments') {
      const seqId = searchParams.get('sequence_id') || ''
      const { data } = await s.from('koto_sequence_enrollments').select('*').eq('sequence_id', seqId).order('enrolled_at', { ascending: false }).limit(100)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_messages') {
      const enrollmentId = searchParams.get('enrollment_id') || ''
      const { data } = await s.from('koto_sequence_messages').select('*').eq('enrollment_id', enrollmentId).order('created_at', { ascending: true })
      return Response.json({ data: data || [] })
    }

    if (action === 'get_inbox') {
      const { data } = await s.from('koto_sequence_enrollments').select('*')
        .eq('agency_id', agencyId)
        .eq('replied', true)
        .order('replied_at', { ascending: false })
        .limit(50)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_timeline') {
      const leadId = searchParams.get('lead_id') || ''
      const email = searchParams.get('email') || ''
      let query = s.from('koto_contact_timeline').select('*').eq('agency_id', agencyId)
      if (leadId) query = query.eq('lead_id', leadId)
      else if (email) query = query.eq('contact_email', email)
      const { data } = await query.order('created_at', { ascending: false }).limit(100)
      return Response.json({ data: data || [] })
    }

    if (action === 'get_stats') {
      const [{ count: active }, { count: enrolled }, { count: replied }] = await Promise.all([
        s.from('koto_email_sequences').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('is_active', true),
        s.from('koto_sequence_enrollments').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
        s.from('koto_sequence_enrollments').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('replied', true),
      ])
      return Response.json({ active_sequences: active || 0, total_enrolled: enrolled || 0, total_replied: replied || 0 })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action
    const s = sb()

    if (action === 'create_sequence') {
      const { agency_id, sequence_name, sequence_type, trigger_type, trigger_condition, channels, use_ghl, ghl_workflow_id } = body
      const { data, error } = await s.from('koto_email_sequences').insert({
        agency_id, sequence_name, sequence_type: sequence_type || 'outbound',
        trigger_type, trigger_condition: trigger_condition || {},
        channels: channels || ['email', 'sms'], use_ghl: use_ghl || false,
        ghl_workflow_id: ghl_workflow_id || null,
      }).select('*').single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, sequence: data })
    }

    if (action === 'update_sequence') {
      const { id, ...updates } = body
      delete updates.action
      await s.from('koto_email_sequences').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
      return Response.json({ success: true })
    }

    if (action === 'add_step') {
      const { sequence_id, agency_id, step_number, channel, delay_days, delay_hours, send_hour, subject_line, body_template, sms_template, ai_focus, ai_tone } = body
      const { data } = await s.from('koto_sequence_steps').insert({
        sequence_id, agency_id, step_number: step_number || 1, channel: channel || 'email',
        delay_days: delay_days || 0, delay_hours: delay_hours || 0, send_hour: send_hour || 9,
        subject_line, body_template, sms_template, ai_focus, ai_tone,
      }).select('*').single()
      return Response.json({ success: true, step: data })
    }

    if (action === 'update_step') {
      const { id, ...updates } = body
      delete updates.action
      await s.from('koto_sequence_steps').update(updates).eq('id', id)
      return Response.json({ success: true })
    }

    if (action === 'delete_step') {
      await s.from('koto_sequence_steps').delete().eq('id', body.step_id)
      return Response.json({ success: true })
    }

    if (action === 'enroll') {
      const { sequence_id, contact, personalization_data, agency_id } = body
      const enrollId = await enrollInSequence(sequence_id, contact, personalization_data, agency_id)
      return Response.json({ success: !!enrollId, enrollment_id: enrollId })
    }

    if (action === 'bulk_enroll') {
      const { sequence_id, contacts, agency_id } = body
      let enrolled = 0
      for (const contact of (contacts || [])) {
        const id = await enrollInSequence(sequence_id, contact, contact.personalization_data || contact, agency_id)
        if (id) enrolled++
      }
      return Response.json({ success: true, enrolled })
    }

    if (action === 'pause_enrollment') {
      await s.from('koto_sequence_enrollments').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', body.enrollment_id)
      return Response.json({ success: true })
    }

    if (action === 'cancel_enrollment') {
      await s.from('koto_sequence_enrollments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', body.enrollment_id)
      return Response.json({ success: true })
    }

    if (action === 'process_queue') {
      const result = await processSequenceQueue()
      return Response.json({ success: true, ...result })
    }

    if (action === 'generate_with_ai') {
      const result = await generateSequenceWithAI(body)
      return Response.json({ success: true, ...result })
    }

    if (action === 'clone_sequence') {
      const { sequence_id, agency_id } = body
      const { data: orig } = await s.from('koto_email_sequences').select('*').eq('id', sequence_id).single()
      if (!orig) return Response.json({ error: 'Not found' }, { status: 404 })

      const { data: clone } = await s.from('koto_email_sequences').insert({
        ...orig, id: undefined, sequence_name: orig.sequence_name + ' (Copy)',
        total_enrolled: 0, total_completed: 0, total_replied: 0, total_appointments: 0,
        created_at: new Date().toISOString(),
      }).select('id').single()

      if (clone) {
        const { data: steps } = await s.from('koto_sequence_steps').select('*').eq('sequence_id', sequence_id)
        for (const step of (steps || [])) {
          await s.from('koto_sequence_steps').insert({ ...step, id: undefined, sequence_id: clone.id, total_sent: 0, total_opened: 0, total_clicked: 0, total_replied: 0 })
        }
      }

      return Response.json({ success: true, new_sequence_id: clone?.id })
    }

    if (action === 'send_reply') {
      const { enrollment_id, channel, body: replyBody, subject } = body
      const { data: enrollment } = await s.from('koto_sequence_enrollments').select('*').eq('id', enrollment_id).single()
      if (!enrollment) return Response.json({ error: 'Not found' }, { status: 404 })

      await s.from('koto_sequence_messages').insert({
        enrollment_id, sequence_id: enrollment.sequence_id, agency_id: enrollment.agency_id,
        channel: channel || 'email', direction: 'outbound', subject: subject || 'Re: ',
        body: replyBody, to_email: enrollment.contact_email,
        status: 'sent', sent_at: new Date().toISOString(),
      })

      await s.from('koto_contact_timeline').insert({
        agency_id: enrollment.agency_id, lead_id: enrollment.lead_id,
        contact_email: enrollment.contact_email, business_name: enrollment.business_name,
        event_type: 'email', event_title: `Reply sent: ${subject || 'Re: '}`,
        event_body: (replyBody || '').substring(0, 200),
        source: 'koto_sequence', channel: 'email', direction: 'outbound',
      })

      return Response.json({ success: true })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

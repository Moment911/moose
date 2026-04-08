import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleEmailReply } from '@/lib/emailSequenceEngine'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const s = sb()
    const eventType = body.type || body.event

    // Resend webhook events
    if (eventType === 'email.delivered') {
      await s.from('koto_sequence_messages').update({ status: 'delivered' }).eq('resend_message_id', body.data?.email_id)
    }

    if (eventType === 'email.opened') {
      const now = new Date().toISOString()
      await s.from('koto_sequence_messages').update({ status: 'opened', opened_at: now }).eq('resend_message_id', body.data?.email_id)
      // Update step stats
      const { data: msg } = await s.from('koto_sequence_messages').select('step_id').eq('resend_message_id', body.data?.email_id).maybeSingle()
      if (msg?.step_id) {
        const { data: step } = await s.from('koto_sequence_steps').select('total_opened').eq('id', msg.step_id).single()
        if (step) await s.from('koto_sequence_steps').update({ total_opened: (step.total_opened || 0) + 1 }).eq('id', msg.step_id)
      }
    }

    if (eventType === 'email.clicked') {
      await s.from('koto_sequence_messages').update({ status: 'clicked', clicked_at: new Date().toISOString() }).eq('resend_message_id', body.data?.email_id)
    }

    if (eventType === 'email.bounced') {
      await s.from('koto_sequence_messages').update({ status: 'bounced' }).eq('resend_message_id', body.data?.email_id)
      // Mark enrollment as bounced
      const { data: msg } = await s.from('koto_sequence_messages').select('enrollment_id').eq('resend_message_id', body.data?.email_id).maybeSingle()
      if (msg?.enrollment_id) {
        await s.from('koto_sequence_enrollments').update({ status: 'bounced' }).eq('id', msg.enrollment_id)
      }
    }

    if (eventType === 'email.complained') {
      const email = body.data?.to?.[0] || body.data?.email
      if (email) {
        await s.from('koto_unsubscribes').insert({ agency_id: '00000000-0000-0000-0000-000000000099', email, reason: 'spam_complaint' })
      }
    }

    // Inbound reply handling
    if (eventType === 'email.reply' || eventType === 'inbound') {
      const fromEmail = body.data?.from || body.from
      const replyBody = body.data?.text || body.data?.html || body.text || ''
      const subject = body.data?.subject || body.subject || ''
      if (fromEmail) {
        await handleEmailReply(fromEmail, replyBody, subject)
      }
    }

    return Response.json({ received: true })
  } catch (error: any) {
    console.error('Email webhook error:', error.message)
    return Response.json({ received: true })
  }
}

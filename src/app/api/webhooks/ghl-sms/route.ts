import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildFrontDeskPromptForClient } from '../../../../lib/frontDeskPromptBuilder'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── GHL Inbound SMS Webhook ─────────────────────────────────────────────────
// When a text comes into GHL, this webhook fires.
// Koto looks up the client, generates an AI response using the Front Desk
// prompt, and replies via GHL's conversation API.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const s = sb()

    // GHL sends: { type: 'InboundMessage', locationId, contactId, body: message text, ... }
    const messageText = body.body || body.message || body.text || ''
    const contactId = body.contactId || body.contact?.id || ''
    const locationId = body.locationId || body.location?.id || ''
    const fromNumber = body.phone || body.from || body.contact?.phone || ''
    const contactName = body.contact?.firstName || body.contact?.name || body.contactName || ''

    if (!messageText || !locationId) {
      return NextResponse.json({ ok: true }) // Ignore empty or non-SMS events
    }

    // Find which Koto client this GHL location belongs to
    const { data: mapping } = await s.from('koto_ghl_client_mappings')
      .select('client_id, agency_id, access_token, ghl_location_id')
      .eq('ghl_location_id', locationId)
      .eq('status', 'active')
      .maybeSingle()

    // Fallback: try matching by access_token if no location match
    let clientId = mapping?.client_id
    let agencyId = mapping?.agency_id
    let accessToken = mapping?.access_token

    if (!clientId) {
      // Try agency-level integration
      const { data: integration } = await s.from('koto_ghl_integrations')
        .select('agency_id, ghl_api_key')
        .eq('ghl_location_id', locationId)
        .eq('status', 'active')
        .maybeSingle()
      if (integration) {
        agencyId = integration.agency_id
        accessToken = integration.ghl_api_key
        // Find the first front desk client for this agency
        const { data: fdConfig } = await s.from('koto_front_desk_configs')
          .select('client_id')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        clientId = fdConfig?.client_id
      }
    }

    if (!clientId || !accessToken) {
      return NextResponse.json({ ok: true }) // No matching client, ignore
    }

    // Check if AI SMS is enabled for this client
    const { data: fdConfig } = await s.from('koto_front_desk_configs')
      .select('id, ai_sms_enabled, ai_sms_hours, ai_sms_escalation_keywords, ai_sms_auto_reply_delay_seconds, company_name, phone, website')
      .eq('client_id', clientId)
      .maybeSingle()

    if (!fdConfig?.ai_sms_enabled) {
      // Log the inbound message even if AI is off
      await s.from('koto_front_desk_sms').insert({
        agency_id: agencyId, client_id: clientId, config_id: fdConfig?.id,
        direction: 'inbound', from_number: fromNumber, to_number: '',
        message: messageText, message_type: 'general', ghl_contact_id: contactId,
        status: 'received', sent_via: 'ghl',
      })
      return NextResponse.json({ ok: true })
    }

    // Check business hours
    const hours = fdConfig.ai_sms_hours || { start: '09:00', end: '19:00', timezone: 'America/New_York' }
    const now = new Date()
    let inHours = true
    try {
      const tf = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: hours.timezone })
      const currentTime = tf.format(now)
      inHours = currentTime >= hours.start && currentTime <= hours.end
    } catch { inHours = true }

    // Check for escalation keywords
    const escalationKeywords = fdConfig.ai_sms_escalation_keywords || ['emergency', 'urgent', '911']
    const lowerMsg = messageText.toLowerCase()
    const needsEscalation = escalationKeywords.some((k: string) => lowerMsg.includes(k.toLowerCase()))

    // Log inbound message
    await s.from('koto_front_desk_sms').insert({
      agency_id: agencyId, client_id: clientId, config_id: fdConfig.id,
      direction: 'inbound', from_number: fromNumber, to_number: '',
      message: messageText, message_type: needsEscalation ? 'escalation' : 'general',
      ghl_contact_id: contactId, status: 'received', sent_via: 'ghl',
    })

    if (needsEscalation) {
      // Don't AI-respond to escalation — just notify agency
      // TODO: fire notification to agency dashboard
      return NextResponse.json({ ok: true, escalated: true })
    }

    if (!inHours) {
      // After hours — send a canned response, not AI
      const afterHoursMsg = `Thanks for texting ${fdConfig.company_name || 'us'}! Our office is currently closed. We'll get back to you first thing in the morning. If this is urgent, please call ${fdConfig.phone || 'our office'}.`
      await sendGHLReply(accessToken, locationId, contactId, afterHoursMsg)
      await s.from('koto_front_desk_sms').insert({
        agency_id: agencyId, client_id: clientId, config_id: fdConfig.id,
        direction: 'outbound', from_number: '', to_number: fromNumber,
        message: afterHoursMsg, message_type: 'ai_response', ai_generated: true,
        ghl_contact_id: contactId, status: 'sent', sent_via: 'ghl',
      })
      return NextResponse.json({ ok: true, after_hours: true })
    }

    // Generate AI response using the Front Desk prompt
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
    if (!ANTHROPIC_KEY) return NextResponse.json({ ok: true })

    // Get recent SMS history for context (last 10 messages)
    const { data: recentSms } = await s.from('koto_front_desk_sms')
      .select('direction, message, created_at')
      .eq('client_id', clientId)
      .or(`from_number.eq.${fromNumber},to_number.eq.${fromNumber}`)
      .order('created_at', { ascending: false })
      .limit(10)

    const conversationHistory = (recentSms || []).reverse().map(m =>
      `${m.direction === 'inbound' ? 'Patient' : 'Jenny'}: ${m.message}`
    ).join('\n')

    // Build the system prompt
    const basePrompt = await buildFrontDeskPromptForClient(clientId)
    const smsPrompt = `${basePrompt}

YOU ARE NOW RESPONDING VIA TEXT MESSAGE (SMS), NOT A PHONE CALL.
Keep responses SHORT — 1-3 sentences max. No one reads long texts.
Be warm and helpful but concise. Use casual texting style (but professional).
Do NOT use bullet points or lists in texts. Write naturally.
If they need to call, give them the number: ${fdConfig.phone || 'our office number'}.
If they want to schedule, offer the scheduling link or tell them to call.
Website: ${fdConfig.website || 'our website'}

RECENT CONVERSATION:
${conversationHistory || '(new conversation)'}

The patient just texted: "${messageText}"
${contactName ? `Patient name: ${contactName}` : ''}

Respond as Jenny via text message. Keep it under 160 characters if possible.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: smsPrompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    const aiData = await aiRes.json()
    let reply = aiData.content?.[0]?.text || ''

    // Clean up — remove any "Jenny:" prefix the AI might add
    reply = reply.replace(/^(Jenny|AI|Assistant|Front Desk):\s*/i, '').trim()

    if (!reply) return NextResponse.json({ ok: true })

    // Send via GHL
    await sendGHLReply(accessToken, locationId, contactId, reply)

    // Log outbound
    await s.from('koto_front_desk_sms').insert({
      agency_id: agencyId, client_id: clientId, config_id: fdConfig.id,
      direction: 'outbound', from_number: '', to_number: fromNumber,
      message: reply, message_type: 'ai_response', ai_generated: true,
      ghl_contact_id: contactId, status: 'sent', sent_via: 'ghl',
    })

    // Log token usage
    try {
      await s.from('koto_token_usage').insert({
        agency_id: agencyId, feature: 'front_desk_sms', model: 'claude-haiku-4-5-20251001',
        input_tokens: aiData.usage?.input_tokens || 0, output_tokens: aiData.usage?.output_tokens || 0,
        cost_cents: Math.round(((aiData.usage?.input_tokens || 0) * 0.08 + (aiData.usage?.output_tokens || 0) * 0.4) / 100),
      })
    } catch {}

    return NextResponse.json({ ok: true, replied: true })

  } catch (e: any) {
    console.error('[GHL SMS webhook error]', e?.message)
    return NextResponse.json({ ok: true })
  }
}

// Send SMS reply via GHL Conversations API
async function sendGHLReply(token: string, locationId: string, contactId: string, message: string) {
  if (!contactId) return
  await fetch('https://services.leadconnectorhq.com/conversations/messages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Version': '2021-07-28' },
    body: JSON.stringify({ type: 'SMS', contactId, message, locationId }),
  })
}

export async function GET() {
  return NextResponse.json({ status: 'GHL SMS webhook active' })
}

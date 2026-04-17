import { NextRequest, NextResponse } from 'next/server'
import { resolveAgencyId } from '../../../lib/apiAuth'
import { createClient } from '@supabase/supabase-js'
import { buildFrontDeskPromptForClient } from '@/lib/frontDeskPromptBuilder'
import {
  DEFAULT_PROMPT_SECTIONS,
  PROMPT_PLACEHOLDERS,
  compilePromptSections,
  getDefaultSections,
  resolveSectionPlaceholders,
} from '@/lib/answering/defaultPromptSections'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''
const RETELL_BASE = 'https://api.retellai.com'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function retellFetch(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch(`${RETELL_BASE}${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Retell error ${res.status}`)
  return data
}

async function anthropicChat(systemPrompt: string, userMessage: string, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error')
  return data.content?.[0]?.text || ''
}

// ── Caller-details extraction ───────────────────────────────────────────────
// Second Claude pass over the transcript to pull structured caller info. Kept
// separate from the 2-3 sentence summary so the email + CRM get a clean schema.
async function extractCallerDetails(transcript: string, fromNumber?: string) {
  if (!transcript || !ANTHROPIC_KEY) return {}
  const system = `You extract structured details from an answering-service phone transcript. Return ONLY a valid JSON object with these keys (use null when unknown): caller_name, callback_number, callback_email, company_name, address, reason_for_calling, urgency_reason, best_time_to_reach, follow_up_needed (true/false), follow_up_instructions, additional_notes. Never invent information — if the caller did not state something, return null.`
  const user = `Caller ID number (from carrier): ${fromNumber || 'unknown'}\n\nTranscript:\n${transcript}`
  try {
    const raw = await anthropicChat(system, user, 900)
    const match = raw.match(/\{[\s\S]*\}/)
    const json = JSON.parse(match ? match[0] : raw)
    return json || {}
  } catch {
    return {}
  }
}

// ── ElevenLabs TTS ──────────────────────────────────────────────────────────
// Renders the text summary as an audio file clients can play on their phone.
async function synthesizeVoiceSummary(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || !text) return null
  const voiceId = process.env.ELEVENLABS_SUMMARY_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // Sarah — warm, clear
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.1, use_speaker_boost: true },
      }),
    })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

// ── Vercel Blob upload (for archived recordings + voice summaries) ──────────
async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<string | null> {
  try {
    const { put } = await import('@vercel/blob')
    const result = await put(pathname, data, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    } as any)
    return result.url
  } catch (e: any) {
    console.error('[blob] upload failed:', e?.message)
    return null
  }
}

async function archiveRecording(retellUrl: string, callId: string): Promise<string | null> {
  if (!retellUrl) return null
  try {
    const res = await fetch(retellUrl)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    const buf = Buffer.from(ab)
    return await uploadToBlob(`answering/recordings/${callId}.wav`, buf, 'audio/wav')
  } catch {
    return null
  }
}

// ── SMS — Telnyx preferred, Twilio fallback ─────────────────────────────────
// The repo already uses Telnyx for voice infrastructure, so Telnyx messaging
// is the natural SMS carrier. Falls back to Twilio if Telnyx isn't configured.
// Retell is voice-only and does not send SMS.
async function sendSmsViaTelnyx(to: string, body: string): Promise<boolean> {
  const key = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_SMS_FROM_NUMBER
  const profile = process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!key || (!from && !profile)) return false
  try {
    const payload: any = { to, text: body.slice(0, 1500) }
    if (from) payload.from = from
    if (profile) payload.messaging_profile_id = profile
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[sms/telnyx] rejected:', res.status, errText.slice(0, 300))
      return false
    }
    return true
  } catch (e: any) {
    console.error('[sms/telnyx] send error:', e?.message)
    return false
  }
}

async function sendSmsViaTwilio(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) return false
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }).toString(),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[sms/twilio] rejected:', res.status, errText.slice(0, 300))
      return false
    }
    return true
  } catch (e: any) {
    console.error('[sms/twilio] send error:', e?.message)
    return false
  }
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!to) return false
  // Prefer explicit provider if SMS_PROVIDER is set; otherwise try Telnyx first.
  const pref = (process.env.SMS_PROVIDER || '').toLowerCase()
  if (pref === 'twilio') {
    if (await sendSmsViaTwilio(to, body)) return true
    return sendSmsViaTelnyx(to, body)
  }
  if (await sendSmsViaTelnyx(to, body)) return true
  if (await sendSmsViaTwilio(to, body)) return true
  console.error('[sms] no provider available — set TELNYX_API_KEY + TELNYX_SMS_FROM_NUMBER, or TWILIO_* env vars')
  return false
}

const EMAIL_FROM = process.env.DESK_EMAIL_FROM || 'Koto Answering Service <notifications@hellokoto.com>'

// ── Client email template ───────────────────────────────────────────────────
function buildClientEmail(params: {
  businessName: string
  urgency: string
  outcome: string
  sentiment: string
  fromNumber: string
  duration: number
  summary: string
  caller: Record<string, any>
  transcript: string
  recordingUrl?: string | null
  summaryAudioUrl?: string | null
  callDetailUrl?: string
}) {
  const { businessName, urgency, outcome, sentiment, fromNumber, duration, summary, caller, transcript, recordingUrl, summaryAudioUrl, callDetailUrl } = params
  const urgencyColor = urgency === 'emergency' ? '#dc2626' : urgency === 'high' ? '#ea580c' : urgency === 'medium' ? '#ca8a04' : '#16a34a'
  const row = (label: string, value: any) => value ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:13px;color:#111827">${value}</td></tr>` : ''
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#fafafa;padding:24px;border-radius:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <h1 style="margin:0;font-size:18px;color:#111827">New Call — ${businessName}</h1>
    <span style="background:${urgencyColor};color:#fff;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase">${urgency}</span>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:14px">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:.6px;margin-bottom:8px">AI Summary</div>
    <div style="font-size:14px;line-height:1.5;color:#111827">${(summary || '').replace(/\n/g, '<br/>')}</div>
    ${summaryAudioUrl ? `<p style="margin:12px 0 0"><a href="${summaryAudioUrl}" style="display:inline-block;padding:8px 14px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:12px;font-weight:600">▶ Listen to voice summary</a></p>` : ''}
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:14px">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:.6px;margin-bottom:8px">Caller Details</div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Name', caller.caller_name)}
      ${row('Callback #', caller.callback_number || fromNumber)}
      ${row('Email', caller.callback_email)}
      ${row('Company', caller.company_name)}
      ${row('Address', caller.address)}
      ${row('Reason', caller.reason_for_calling)}
      ${row('Best time', caller.best_time_to_reach)}
      ${row('Follow-up', caller.follow_up_needed ? (caller.follow_up_instructions || 'Yes — see summary') : null)}
      ${row('Notes', caller.additional_notes)}
    </table>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:14px">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:.6px;margin-bottom:8px">Call Metadata</div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Caller ID', fromNumber || 'Unknown')}
      ${row('Duration', `${duration}s`)}
      ${row('Outcome', outcome)}
      ${row('Sentiment', sentiment)}
    </table>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:14px">
    ${recordingUrl ? `<a href="${recordingUrl}" style="flex:1;padding:10px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-size:12px;font-weight:600;text-align:center">▶ Full recording</a>` : ''}
    ${callDetailUrl ? `<a href="${callDetailUrl}" style="flex:1;padding:10px;background:#ea2729;color:#fff;text-decoration:none;border-radius:8px;font-size:12px;font-weight:600;text-align:center">Open in Koto</a>` : ''}
  </div>

  ${transcript ? `<details style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:#374151">Full transcript</summary><pre style="margin:12px 0 0;white-space:pre-wrap;font-size:12px;line-height:1.5;color:#374151;font-family:ui-monospace,Menlo,monospace">${transcript.replace(/</g,'&lt;')}</pre></details>` : ''}
</div>`.trim()
}

// ── Normalize a koto_inbound_calls row for the UI ───────────────────────────
// The DB has both legacy + new column names from years of migrations. The UI
// expects a single shape: { id, date, caller_name, caller_number, duration,
// urgency, outcome, sentiment, ai_summary, intake_data, transcript,
// recording_url, summary_audio_url, recording_archive_url, follow_up_notes }.
function normalizeCallRow(row: any) {
  if (!row) return row
  const recording = row.recording_archive_url || row.recording_url || null
  return {
    ...row,
    date: row.created_at || row.date || null,
    duration: row.duration_seconds ?? row.duration ?? 0,
    caller_name: row.caller_name || row.caller_details?.caller_name || null,
    caller_number: row.caller_number || row.caller_phone || row.from_number || null,
    callback_number: row.caller_details?.callback_number || row.caller_number || row.caller_phone || null,
    ai_summary: row.ai_summary || row.summary || '',
    summary: row.summary || row.ai_summary || '',
    intake_data: row.caller_details || row.intake_data || {},
    caller_details: row.caller_details || row.intake_data || {},
    recording_url: recording,
    recording_archive_url: row.recording_archive_url || null,
    summary_audio_url: row.summary_audio_url || null,
    quality_score: row.quality_score ?? null,
    quality_notes: row.quality_notes || null,
    resolved_at: row.resolved_at || null,
    follow_up_at: row.follow_up_at || null,
    follow_up_notes: row.follow_up_notes || null,
  }
}

// ── Intent classification + recipient routing ───────────────────────────────
// Picks the best email + phone recipients from the agent's routing-targets and
// notification settings based on the call's detected intent.
async function classifyIntent(transcript: string, urgency: string): Promise<string> {
  if (!transcript || !ANTHROPIC_KEY) return 'general'
  if (urgency === 'emergency') return 'emergency'
  try {
    const out = await anthropicChat(
      'Classify the primary intent of this answering-service call. Return ONLY one lowercase word from this list: scheduling, billing, sales, support, emergency, existing_client, new_consultation, general.',
      `Transcript:\n${transcript.slice(0, 6000)}`,
      24,
    )
    return (out || 'general').trim().toLowerCase().replace(/[^a-z_]/g, '') || 'general'
  } catch { return 'general' }
}

async function loadRoutingTargets(supabase: any, agentDbId: string): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('koto_inbound_routing_targets')
      .select('id, label, phone_number, email, priority, conditions')
      .eq('agent_id', agentDbId)
      .order('priority', { ascending: true })
    return data || []
  } catch { return [] }
}

function pickRecipientsForIntent(targets: any[], intent: string, urgency: string): { emails: string[]; phones: string[] } {
  const emails = new Set<string>()
  const phones = new Set<string>()
  for (const t of targets) {
    const cond = t.conditions || {}
    const intentMatch = !cond.intent || cond.intent === 'any' || cond.intent === intent
    const urgencyMatch = !cond.urgency || cond.urgency === urgency || cond.urgency === 'any'
    if (intentMatch && urgencyMatch) {
      if (t.email) emails.add(t.email)
      if (t.phone_number) phones.add(t.phone_number)
    }
  }
  return { emails: [...emails], phones: [...phones] }
}

// ── Outbound webhooks (CRM / Zapier / etc) ──────────────────────────────────
async function fireOutboundWebhook(url: string, payload: any) {
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Koto-Answering/1.0' },
      body: JSON.stringify(payload),
    })
  } catch (e: any) {
    console.error('[outbound webhook] failed', url, e?.message)
  }
}

async function postToSlack(webhookUrl: string, params: { businessName: string; urgency: string; summary: string; caller: any; fromNumber: string; callDetailUrl: string }) {
  if (!webhookUrl) return
  const { businessName, urgency, summary, caller, fromNumber, callDetailUrl } = params
  const color = urgency === 'emergency' ? '#dc2626' : urgency === 'high' ? '#ea580c' : '#16a34a'
  const fields: any[] = []
  if (caller.caller_name) fields.push({ title: 'Caller', value: caller.caller_name, short: true })
  if (caller.callback_number || fromNumber) fields.push({ title: 'Callback', value: caller.callback_number || fromNumber, short: true })
  if (caller.callback_email) fields.push({ title: 'Email', value: caller.callback_email, short: true })
  if (caller.reason_for_calling) fields.push({ title: 'Reason', value: caller.reason_for_calling, short: false })
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${urgency === 'emergency' ? ':rotating_light: EMERGENCY' : urgency === 'high' ? ':warning: Urgent' : ':telephone_receiver: New call'} for ${businessName}`,
        attachments: [{
          color,
          title: 'AI Summary',
          text: summary,
          fields,
          actions: [{ type: 'button', text: 'Open in Koto', url: callDetailUrl }],
        }],
      }),
    })
  } catch (e: any) {
    console.error('[slack post] failed', e?.message)
  }
}

// ── Spam / repeat-hangup filter ─────────────────────────────────────────────
async function isSpamCaller(supabase: any, agencyId: string, fromNumber: string): Promise<boolean> {
  if (!fromNumber || !agencyId) return false
  // Block list — explicit deny
  try {
    const { data } = await supabase
      .from('koto_inbound_spam_blocklist')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('phone_number', fromNumber)
      .maybeSingle()
    if (data) return true
  } catch {}
  // Heuristic: 3+ short hangups in the last 7 days
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('koto_inbound_calls')
      .select('id, duration_seconds')
      .eq('agency_id', agencyId)
      .eq('caller_number', fromNumber)
      .gte('created_at', since)
    const shortHangups = (data || []).filter((c: any) => (c.duration_seconds || 0) < 5).length
    if (shortHangups >= 3) return true
  } catch {}
  return false
}

// ── Caller history (for the call_inbound webhook → dynamic_variables) ───────
async function buildCallerHistory(supabase: any, agencyId: string, fromNumber: string) {
  if (!fromNumber || !agencyId) return null
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('koto_inbound_calls')
      .select('caller_name, summary, ai_summary, urgency, outcome, created_at')
      .eq('agency_id', agencyId)
      .eq('caller_number', fromNumber)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5)
    if (!data || data.length === 0) return null
    const lastCall = data[0]
    const lastName = data.map((d: any) => d.caller_name).find(Boolean) || null
    return {
      total_recent_calls: data.length,
      last_caller_name: lastName,
      last_call_at: lastCall.created_at,
      last_call_summary: lastCall.ai_summary || lastCall.summary || '',
      recent_outcomes: data.map((d: any) => d.outcome).filter(Boolean).join(', '),
    }
  } catch { return null }
}

// ── Quality scoring (Claude rubric) ─────────────────────────────────────────
async function scoreCallQuality(transcript: string) {
  if (!transcript || !ANTHROPIC_KEY) return null
  try {
    const out = await anthropicChat(
      `You are a QA reviewer for an AI phone receptionist. Score this call 0-100 against this rubric:
- Greeting warmth (0-20)
- Active listening — did the agent wait, not interrupt? (0-20)
- Information accuracy — did the agent stick to known facts and not hallucinate? (0-20)
- Caller satisfaction — did the caller's tone improve or stay positive? (0-20)
- Resolution — was the caller's reason addressed (booked, transferred, message taken)? (0-20)
Return ONLY a JSON object: {"score": <0-100>, "strengths": "<one sentence>", "improvements": "<one sentence>"}.`,
      `Transcript:\n${transcript.slice(0, 8000)}`,
      400,
    )
    const m = out.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Intake Templates
// ---------------------------------------------------------------------------

const INTAKE_TEMPLATES: Record<string, { id: string; label: string; icon_emoji: string; questions: { text: string; type: string }[] }> = {
  general: {
    id: 'general',
    label: 'General Business',
    icon_emoji: '\u{1F3E2}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the best phone number to reach you?', type: 'phone' },
      { text: 'What is your email address?', type: 'email' },
      { text: 'How did you hear about us?', type: 'text' },
      { text: 'What is the reason for your call today?', type: 'text' },
      { text: 'Is this matter urgent?', type: 'boolean' },
    ],
  },
  medical: {
    id: 'medical',
    label: 'Medical Office',
    icon_emoji: '\u{1FA7A}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'What insurance provider do you have?', type: 'text' },
      { text: 'What is your insurance member ID?', type: 'text' },
      { text: 'What symptoms are you experiencing?', type: 'text' },
      { text: 'When did your symptoms begin?', type: 'date' },
      { text: 'Are you currently taking any medications?', type: 'text' },
      { text: 'Would you like to schedule an appointment?', type: 'boolean' },
    ],
  },
  dental: {
    id: 'dental',
    label: 'Dental Office',
    icon_emoji: '\u{1F9B7}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'Do you have dental insurance?', type: 'boolean' },
      { text: 'Who is your dental insurance provider?', type: 'text' },
      { text: 'Are you experiencing any dental pain or discomfort?', type: 'boolean' },
      { text: 'Which area of your mouth is affected?', type: 'text' },
      { text: 'When was your last dental visit?', type: 'date' },
      { text: 'Are you a new or existing patient?', type: 'text' },
    ],
  },
  legal: {
    id: 'legal',
    label: 'Law Firm',
    icon_emoji: '\u{2696}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your phone number?', type: 'phone' },
      { text: 'What type of legal matter is this regarding?', type: 'text' },
      { text: 'Have you been involved in a recent incident or accident?', type: 'boolean' },
      { text: 'When did this incident occur?', type: 'date' },
      { text: 'Do you currently have legal representation?', type: 'boolean' },
      { text: 'Are there any upcoming court dates or deadlines?', type: 'text' },
    ],
  },
  hvac: {
    id: 'hvac',
    label: 'HVAC Services',
    icon_emoji: '\u{2744}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the service address?', type: 'text' },
      { text: 'Is your system heating, cooling, or both?', type: 'text' },
      { text: 'What brand and model is your unit?', type: 'text' },
      { text: 'What issue are you experiencing?', type: 'text' },
      { text: 'Is this an emergency or can it be scheduled?', type: 'text' },
      { text: 'Are you a homeowner or tenant?', type: 'text' },
    ],
  },
  plumbing: {
    id: 'plumbing',
    label: 'Plumbing Services',
    icon_emoji: '\u{1F6BF}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the service address?', type: 'text' },
      { text: 'What plumbing issue are you experiencing?', type: 'text' },
      { text: 'Is there any active flooding or water damage?', type: 'boolean' },
      { text: 'Where in the property is the issue located?', type: 'text' },
      { text: 'How long has this been going on?', type: 'text' },
      { text: 'Are you a homeowner or tenant?', type: 'text' },
    ],
  },
  roofing: {
    id: 'roofing',
    label: 'Roofing Services',
    icon_emoji: '\u{1F3E0}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the property address?', type: 'text' },
      { text: 'Is there an active leak?', type: 'boolean' },
      { text: 'What type of roof do you have (shingle, tile, metal, flat)?', type: 'text' },
      { text: 'Is this for repair, replacement, or inspection?', type: 'text' },
      { text: 'Was the damage caused by a recent storm?', type: 'boolean' },
      { text: 'Do you plan to file an insurance claim?', type: 'boolean' },
    ],
  },
  real_estate: {
    id: 'real_estate',
    label: 'Real Estate',
    icon_emoji: '\u{1F3E1}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'Are you looking to buy, sell, or rent?', type: 'text' },
      { text: 'What area or neighborhood are you interested in?', type: 'text' },
      { text: 'What is your budget range?', type: 'text' },
      { text: 'How many bedrooms and bathrooms do you need?', type: 'text' },
      { text: 'What is your timeline for moving?', type: 'text' },
      { text: 'Are you pre-approved for a mortgage?', type: 'boolean' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    icon_emoji: '\u{1F37D}\u{FE0F}',
    questions: [
      { text: 'What is your name for the reservation?', type: 'text' },
      { text: 'How many guests will be dining?', type: 'number' },
      { text: 'What date and time would you prefer?', type: 'text' },
      { text: 'Does anyone in your party have food allergies?', type: 'text' },
      { text: 'Is this for a special occasion?', type: 'text' },
      { text: 'Do you have any seating preferences (indoor, outdoor, private)?', type: 'text' },
    ],
  },
  salon: {
    id: 'salon',
    label: 'Hair Salon / Spa',
    icon_emoji: '\u{1F487}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What service are you looking to book?', type: 'text' },
      { text: 'Do you have a preferred stylist or technician?', type: 'text' },
      { text: 'What date and time works best for you?', type: 'text' },
      { text: 'Are you a new or returning client?', type: 'text' },
      { text: 'Do you have any allergies or sensitivities we should know about?', type: 'text' },
    ],
  },
  chiropractic: {
    id: 'chiropractic',
    label: 'Chiropractic Office',
    icon_emoji: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'What area of pain or discomfort are you experiencing?', type: 'text' },
      { text: 'How long have you been experiencing this issue?', type: 'text' },
      { text: 'Was this caused by an accident or injury?', type: 'boolean' },
      { text: 'Have you seen a chiropractor before?', type: 'boolean' },
      { text: 'Do you have insurance that covers chiropractic care?', type: 'boolean' },
    ],
  },
  auto_repair: {
    id: 'auto_repair',
    label: 'Auto Repair Shop',
    icon_emoji: '\u{1F697}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the year, make, and model of your vehicle?', type: 'text' },
      { text: 'What issue are you experiencing with your vehicle?', type: 'text' },
      { text: 'Is the vehicle drivable?', type: 'boolean' },
      { text: 'Are there any warning lights on your dashboard?', type: 'text' },
      { text: 'When would you like to bring the vehicle in?', type: 'text' },
      { text: 'Do you need a loaner or shuttle service?', type: 'boolean' },
    ],
  },
  veterinary: {
    id: 'veterinary',
    label: 'Veterinary Clinic',
    icon_emoji: '\u{1F43E}',
    questions: [
      { text: "What is your name (pet owner)?", type: 'text' },
      { text: "What is your pet's name and species?", type: 'text' },
      { text: "What breed is your pet and how old are they?", type: 'text' },
      { text: "What symptoms or concerns do you have?", type: 'text' },
      { text: 'Is this an emergency situation?', type: 'boolean' },
      { text: 'When did you first notice these symptoms?', type: 'text' },
      { text: 'Is your pet up to date on vaccinations?', type: 'boolean' },
      { text: 'Are you a new or existing client?', type: 'text' },
    ],
  },
  contractor: {
    id: 'contractor',
    label: 'General Contractor',
    icon_emoji: '\u{1F477}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the project address?', type: 'text' },
      { text: 'What type of project are you planning (renovation, new build, addition)?', type: 'text' },
      { text: 'Can you describe the scope of work?', type: 'text' },
      { text: 'Do you have a budget range in mind?', type: 'text' },
      { text: 'What is your desired timeline?', type: 'text' },
      { text: 'Do you already have permits or architectural plans?', type: 'boolean' },
    ],
  },
  mental_health: {
    id: 'mental_health',
    label: 'Mental Health Practice',
    icon_emoji: '\u{1F9E0}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is your date of birth?', type: 'date' },
      { text: 'Are you seeking individual, couples, or family therapy?', type: 'text' },
      { text: 'Have you had therapy or counseling before?', type: 'boolean' },
      { text: 'What concerns or goals bring you to therapy?', type: 'text' },
      { text: 'Do you have insurance that covers mental health services?', type: 'boolean' },
      { text: 'Do you have a preference for in-person or telehealth sessions?', type: 'text' },
    ],
  },
  accounting: {
    id: 'accounting',
    label: 'Accounting Firm',
    icon_emoji: '\u{1F4CA}',
    questions: [
      { text: 'What is your full name or business name?', type: 'text' },
      { text: 'What accounting service do you need (tax prep, bookkeeping, audit, consulting)?', type: 'text' },
      { text: 'Is this for personal or business finances?', type: 'text' },
      { text: 'What is your filing status or business entity type?', type: 'text' },
      { text: 'Are there any upcoming tax deadlines you are concerned about?', type: 'text' },
      { text: 'Are you a new or existing client?', type: 'text' },
    ],
  },
  insurance: {
    id: 'insurance',
    label: 'Insurance Agency',
    icon_emoji: '\u{1F6E1}\u{FE0F}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What type of insurance are you inquiring about (auto, home, life, business)?', type: 'text' },
      { text: 'Are you looking for a new policy or calling about an existing one?', type: 'text' },
      { text: 'If existing, what is your policy number?', type: 'text' },
      { text: 'Are you filing a claim?', type: 'boolean' },
      { text: 'Can you describe the incident or what you need covered?', type: 'text' },
      { text: 'What is your preferred contact method?', type: 'text' },
    ],
  },
  landscaping: {
    id: 'landscaping',
    label: 'Landscaping Company',
    icon_emoji: '\u{1F333}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the property address?', type: 'text' },
      { text: 'What landscaping services are you interested in (mowing, design, irrigation, tree removal)?', type: 'text' },
      { text: 'Is this a one-time service or recurring maintenance?', type: 'text' },
      { text: 'What is the approximate size of your property?', type: 'text' },
      { text: 'Do you have a budget in mind?', type: 'text' },
      { text: 'When would you like the work to begin?', type: 'text' },
    ],
  },
  cleaning: {
    id: 'cleaning',
    label: 'Cleaning Service',
    icon_emoji: '\u{1F9F9}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'What is the address to be cleaned?', type: 'text' },
      { text: 'Is this a residential or commercial property?', type: 'text' },
      { text: 'How many rooms or square footage?', type: 'text' },
      { text: 'Are you looking for a one-time or recurring cleaning?', type: 'text' },
      { text: 'Do you have any specific cleaning needs (deep clean, move-out, post-construction)?', type: 'text' },
      { text: 'Do you have pets?', type: 'boolean' },
    ],
  },
  mortgage: {
    id: 'mortgage',
    label: 'Mortgage / Lending',
    icon_emoji: '\u{1F3E6}',
    questions: [
      { text: 'What is your full name?', type: 'text' },
      { text: 'Are you looking to purchase, refinance, or get pre-approved?', type: 'text' },
      { text: 'What is the estimated property value or purchase price?', type: 'text' },
      { text: 'What is your estimated down payment amount?', type: 'text' },
      { text: 'What is your estimated credit score range?', type: 'text' },
      { text: 'Are you self-employed or W-2 employed?', type: 'text' },
      { text: 'What is your desired loan term (15-year, 30-year)?', type: 'text' },
      { text: 'Have you been pre-approved by another lender?', type: 'boolean' },
    ],
  },
}

// ---------------------------------------------------------------------------
// Emergency keyword detection
// ---------------------------------------------------------------------------

const EMERGENCY_KEYWORDS = [
  'emergency', 'urgent', 'critical', 'life-threatening', 'chest pain',
  'bleeding', 'unconscious', 'not breathing', 'heart attack', 'stroke',
  'seizure', 'overdose', 'suicide', 'severe pain', 'accident',
  'fire', 'flood', 'gas leak', 'carbon monoxide',
]

function detectUrgency(transcript: string): 'low' | 'medium' | 'high' | 'emergency' {
  const lower = transcript.toLowerCase()
  const emergencyHits = EMERGENCY_KEYWORDS.filter(kw => lower.includes(kw))
  if (emergencyHits.length >= 2) return 'emergency'
  if (emergencyHits.length === 1) return 'high'
  if (lower.includes('asap') || lower.includes('as soon as possible') || lower.includes('right away')) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const agency_id = resolveAgencyId(request, searchParams)
    const agent_id = searchParams.get('agent_id')
    const call_id = searchParams.get('call_id')

    const supabase = getSupabase()

    switch (action) {
      case 'get_agents': {
        if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const { data, error } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('agency_id', agency_id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ agents: data })
      }

      case 'get_calls': {
        if (!agent_id && !agency_id) return NextResponse.json({ error: 'agent_id or agency_id required' }, { status: 400 })
        let query = supabase.from('koto_inbound_calls').select('*')
        if (agent_id) query = query.eq('agent_id', agent_id)
        else if (agency_id) query = query.eq('agency_id', agency_id)

        const urgency = searchParams.get('urgency')
        const outcome = searchParams.get('outcome')
        const sentiment = searchParams.get('sentiment')
        const date_from = searchParams.get('date_from')
        const date_to = searchParams.get('date_to')

        if (urgency) query = query.eq('urgency', urgency)
        if (outcome) query = query.eq('outcome', outcome)
        if (sentiment) query = query.eq('sentiment', sentiment)
        if (date_from) query = query.gte('created_at', date_from)
        if (date_to) query = query.lte('created_at', date_to)

        query = query.order('created_at', { ascending: false }).limit(100)

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json({ calls: (data || []).map(normalizeCallRow) })
      }

      case 'get_call_detail': {
        if (!call_id) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        const [callRes, intakesRes] = await Promise.all([
          supabase.from('koto_inbound_calls').select('*').eq('id', call_id).single(),
          supabase.from('koto_inbound_intakes').select('*').eq('call_id', call_id),
        ])
        if (callRes.error) throw callRes.error
        return NextResponse.json({ call: normalizeCallRow(callRes.data), intakes: intakesRes.data || [] })
      }

      case 'get_analytics': {
        if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        let q = supabase.from('koto_inbound_calls').select('*').eq('agency_id', agency_id)
        if (agent_id) q = q.eq('agent_id', agent_id)
        const { data: calls, error } = await q
        if (error) throw error

        const allCalls = calls || []
        const totalCalls = allCalls.length
        const totalDuration = allCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
        const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0
        const totalMinutes = Math.round(totalDuration / 60)

        const outcomeCounts: Record<string, number> = {}
        const sentimentCounts: Record<string, number> = {}
        const urgencyCounts: Record<string, number> = {}
        const hourlyArr = new Array(24).fill(0)
        const dayOfWeekArr = new Array(7).fill(0) // 0 = Sunday
        const dailyMap: Record<string, number> = {}

        let appointments = 0, emergencies = 0, voicemails = 0, missed = 0, transferred = 0, resolved = 0
        let positives = 0, negatives = 0, neutrals = 0
        for (const call of allCalls) {
          const oc = (call.outcome || 'unknown').toLowerCase()
          outcomeCounts[oc] = (outcomeCounts[oc] || 0) + 1
          if (oc === 'appointment' || oc === 'booked') appointments++
          if (oc === 'voicemail') voicemails++
          if (oc === 'missed' || oc === 'abandoned') missed++
          if (oc === 'transferred') transferred++
          if (oc === 'resolved' || oc === 'completed') resolved++

          const ug = (call.urgency || 'low').toLowerCase()
          urgencyCounts[ug] = (urgencyCounts[ug] || 0) + 1
          if (ug === 'emergency' || ug === 'high') emergencies++

          const sn = (call.sentiment || 'neutral').toLowerCase()
          sentimentCounts[sn] = (sentimentCounts[sn] || 0) + 1
          if (sn === 'positive') positives++
          else if (sn === 'negative' || sn === 'frustrated') negatives++
          else neutrals++

          if (call.created_at) {
            const date = new Date(call.created_at)
            hourlyArr[date.getHours()]++
            dayOfWeekArr[date.getDay()]++
            const dayKey = date.toISOString().split('T')[0]
            dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1
          }
        }

        const dailyBreakdown = Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
        const missedRate = totalCalls > 0 ? missed / totalCalls : 0

        // Flat top-level shape for the AnalyticsTab; nested `analytics` kept for legacy callers.
        return NextResponse.json({
          total_calls: totalCalls,
          avg_duration: avgDuration,
          avg_duration_seconds: avgDuration,
          total_minutes: totalMinutes,
          appointments,
          emergencies,
          voicemails,
          missed,
          transferred,
          resolved,
          positives,
          negatives,
          neutrals,
          missed_rate: missedRate,
          calls_by_hour: hourlyArr,
          calls_by_day: dayOfWeekArr,
          daily_breakdown: dailyBreakdown,
          outcome_counts: outcomeCounts,
          sentiment_counts: sentimentCounts,
          urgency_counts: urgencyCounts,
          analytics: {
            total_calls: totalCalls,
            avg_duration_seconds: avgDuration,
            outcome_counts: outcomeCounts,
            hourly_breakdown: hourlyArr.map((count, hour) => ({ hour, count })),
            daily_breakdown: dailyBreakdown,
          },
        })
      }

      case 'get_live_calls': {
        // Live monitor — fetches in-progress Retell calls and their current
        // transcript. UI polls this every few seconds during an active call.
        if (!agency_id && !agent_id) return NextResponse.json({ error: 'agency_id or agent_id required' }, { status: 400 })
        try {
          // Retell /list-calls with call_status filter. We filter by our agent's
          // retell_agent_id so we only surface calls belonging to this account.
          const { data: agents } = await supabase
            .from('koto_inbound_agents')
            .select('id, retell_agent_id, business_name, name')
            .eq(agent_id ? 'id' : 'agency_id', agent_id || agency_id)
          const retellAgentIds = (agents || []).map((a: any) => a.retell_agent_id).filter(Boolean)
          if (retellAgentIds.length === 0) return NextResponse.json({ calls: [] })

          const listRes = await retellFetch('/v2/list-calls', 'POST', {
            filter_criteria: {
              agent_id: retellAgentIds,
              call_status: ['ongoing', 'registered'],
            },
            limit: 50,
          })
          const calls = Array.isArray(listRes) ? listRes : (listRes?.calls || [])
          const mapped = calls.map((c: any) => {
            const ag = (agents || []).find((a: any) => a.retell_agent_id === c.agent_id)
            return {
              call_id: c.call_id,
              retell_call_id: c.call_id,
              agent_id: ag?.id,
              agent_name: ag?.business_name || ag?.name,
              from_number: c.from_number,
              to_number: c.to_number,
              start_timestamp: c.start_timestamp,
              call_status: c.call_status,
              transcript: c.transcript || '',
              transcript_with_tool_calls: c.transcript_with_tool_calls || [],
            }
          })
          return NextResponse.json({ calls: mapped })
        } catch (e: any) {
          return NextResponse.json({ calls: [], error: e?.message })
        }
      }

      case 'get_live_call_detail': {
        // Single in-progress call — fetched directly from Retell for freshest transcript.
        const liveCallId = searchParams.get('call_id') || call_id
        if (!liveCallId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        try {
          const live = await retellFetch(`/v2/get-call/${liveCallId}`)
          return NextResponse.json({ call: live })
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'retell fetch failed' }, { status: 500 })
        }
      }

      case 'get_followups': {
        // Callback queue — open follow-ups for this agent/agency, soonest first.
        if (!agent_id && !agency_id) return NextResponse.json({ error: 'agent_id or agency_id required' }, { status: 400 })
        let q = supabase.from('koto_inbound_calls').select('*')
        if (agent_id) q = q.eq('agent_id', agent_id)
        else if (agency_id) q = q.eq('agency_id', agency_id)
        q = q.eq('follow_up_required', true).is('resolved_at', null).order('follow_up_at', { ascending: true }).limit(50)
        const { data, error } = await q
        if (error) return NextResponse.json({ followups: [] })
        return NextResponse.json({ followups: (data || []).map(normalizeCallRow) })
      }

      case 'get_billing_summary': {
        // Per-agency rollup of minutes + call counts for the given window (default: last 30 days).
        if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const days = parseInt(searchParams.get('days') || '30', 10)
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase.from('koto_inbound_calls')
          .select('duration_seconds, outcome, agent_id, created_at')
          .eq('agency_id', agency_id)
          .gte('created_at', since)
        const calls = data || []
        const totalCalls = calls.length
        const totalMinutes = Math.ceil(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / 60)
        const byAgent: Record<string, { calls: number; minutes: number }> = {}
        for (const c of calls) {
          const aid = c.agent_id || 'unknown'
          if (!byAgent[aid]) byAgent[aid] = { calls: 0, minutes: 0 }
          byAgent[aid].calls++
          byAgent[aid].minutes += Math.ceil((c.duration_seconds || 0) / 60)
        }
        return NextResponse.json({
          window_days: days,
          total_calls: totalCalls,
          total_minutes: totalMinutes,
          estimated_cost: totalMinutes * 0.02, // matches the rate in the billing post
          by_agent: byAgent,
        })
      }

      case 'get_intake_templates': {
        // UI expects `name` + `industry`; INTAKE_TEMPLATES uses `label` + id.
        const templates = Object.values(INTAKE_TEMPLATES).map((t: any) => ({
          id: t.id,
          name: t.label,
          industry: t.id,
          icon_emoji: t.icon_emoji,
          questions: t.questions,
        }))
        return NextResponse.json({ templates })
      }

      case 'get_prompt_sections': {
        // Shape consumed by the Prompt Editor tab. If the agent has saved a
        // `prompt_sections` jsonb, merge it with defaults so new sections still
        // appear even on agents saved before they were introduced. Includes
        // a resolved preview so editors can see what the AI will actually read.
        if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
        const { data: row } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', agent_id)
          .maybeSingle()

        const saved: Record<string, string> = (row && (row as any).prompt_sections) || {}
        const sections = DEFAULT_PROMPT_SECTIONS.map(s => {
          const text = (saved[s.id] ?? s.default_text) || ''
          return {
            ...s,
            text,
            resolved_preview: row ? resolveSectionPlaceholders(text, row as any) : text,
          }
        })
        return NextResponse.json({
          sections,
          hasSaved: Object.keys(saved).length > 0,
          placeholders: PROMPT_PLACEHOLDERS,
        })
      }

      case 'get_prompt_placeholders': {
        return NextResponse.json({ placeholders: PROMPT_PLACEHOLDERS })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[inbound GET]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Retell sends {event, call} with no `action` wrapper. Detect that shape so
    // POSTing directly to /api/inbound (legacy webhook URL on existing agents)
    // still routes through the webhook pipeline.
    const action = body?.action || (body?.event && body?.call ? 'webhook' : undefined)
    const supabase = getSupabase()

    switch (action) {
      // -------------------------------------------------------------------
      // Create Agent
      // -------------------------------------------------------------------
      case 'create_agent': {
        const {
          agency_id, client_id, business_name, department, sic_code,
          voice_id, greeting_script, closed_script, emergency_script,
          intake_questions, timezone, phone_number, forward_number,
        } = body

        const agentName = (body.agent_name || business_name || '').trim()
        if (!agency_id || !agentName) {
          return NextResponse.json({ error: 'agency_id and business_name required' }, { status: 400 })
        }

        const displayName = business_name || agentName
        const beginMessage = greeting_script
          || `Hello, thank you for calling ${displayName}. How can I help you today?`
        let generalPrompt = `You are the AI receptionist for ${displayName}${department ? ` (${department} department)` : ''}.

Greet callers warmly, answer basic questions about the business, and collect their name, callback number, and reason for calling. Be concise, polite, and mirror the caller's energy. If the matter is urgent, mark it so and offer to escalate.

End the call once you have collected the caller's information and confirmed next steps.`

        if (client_id) {
          try {
            const frontDeskPrompt = await buildFrontDeskPromptForClient(client_id)
            if (frontDeskPrompt) generalPrompt = frontDeskPrompt
          } catch (e: any) {
            console.error('[inbound create_agent] Front desk prompt lookup failed (non-fatal):', e?.message)
          }
        }

        // Step 1: Create Retell LLM — match VOB agent setup (Claude 4.6 Sonnet,
        // conversational turn-taking discipline baked into the prompt). Register
        // a `book_appointment` tool so the agent can hand a structured booking
        // back to us when the caller wants to schedule.
        const webhookBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
        const generalTools = [
          {
            type: 'custom',
            name: 'book_appointment',
            description: 'Record an appointment booking when the caller agrees to a time. Always confirm the time and contact info back to the caller before invoking this tool.',
            url: `${webhookBase}/api/inbound/tool/book_appointment`,
            speak_during_execution: true,
            execution_message_description: 'Tell the caller you are booking the time and to hold for a moment.',
            parameters: {
              type: 'object',
              properties: {
                caller_name: { type: 'string', description: 'Full name of the person being booked.' },
                callback_number: { type: 'string', description: 'Best phone number to confirm the booking.' },
                callback_email: { type: 'string', description: 'Optional email for confirmation.' },
                appointment_iso: { type: 'string', description: 'ISO 8601 timestamp of the requested appointment, in the business timezone.' },
                duration_minutes: { type: 'number', description: 'Estimated duration in minutes.' },
                reason: { type: 'string', description: 'Short description of the appointment reason.' },
              },
              required: ['caller_name', 'callback_number', 'appointment_iso'],
            },
          },
        ]

        let llmId: string
        try {
          const llmRes = await retellFetch('/create-retell-llm', 'POST', {
            general_prompt: generalPrompt,
            begin_message: beginMessage,
            model: 'claude-4.6-sonnet',
            general_tools: generalTools,
          })
          llmId = llmRes.llm_id
          if (!llmId) throw new Error('Retell did not return llm_id')
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Retell create-retell-llm failed' }, { status: 500 })
        }

        // Step 2: Create Retell agent referencing the LLM.
        // Match the VOB agent's conversational settings: low interruption, disabled
        // backchannel, measured responsiveness, and silence/duration guards that
        // make it behave like a patient human receptionist.
        const resolvedVoiceId = voice_id || '11labs-Marissa'
        const inboundWebhookUrl = `${webhookBase}/api/inbound/webhook`
        let retellAgent: any
        try {
          retellAgent = await retellFetch('/create-agent', 'POST', {
            agent_name: agentName,
            voice_id: resolvedVoiceId,
            response_engine: { type: 'retell-llm', llm_id: llmId },
            language: 'en-US',
            webhook_url: inboundWebhookUrl,
            enable_backchannel: false,
            interruption_sensitivity: 0.3,
            responsiveness: 0.7,
            voice_speed: 0.95,
            ambient_sound: null,
            end_call_after_silence_ms: 30000,
            reminder_trigger_ms: 10000,
            reminder_max_count: 2,
            max_call_duration_ms: 1800000,
            metadata: { agency_id, kind: 'answering' },
          })
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'Retell create-agent failed' }, { status: 500 })
        }

        // Step 3: Insert agent record. Prod schema has drifted from answering_service.sql,
        // so start with the full set and retry with the offending column stripped if
        // Supabase reports it missing. Scripts/notifications are set on the detail page later.
        const agentRecord: any = {
          agency_id,
          client_id: client_id || null,
          name: agentName,
          business_name: displayName,
          department: department || 'main',
          retell_agent_id: retellAgent.agent_id,
          voice_id: resolvedVoiceId,
          sic_code: sic_code || null,
          phone_number: phone_number || forward_number || null,
          status: 'active',
          is_active: true,
        }
        void greeting_script; void closed_script; void emergency_script; void intake_questions; void timezone;

        let agentData: any = null
        let lastInsertError: any = null
        for (let attempt = 0; attempt < 10; attempt++) {
          const res = await supabase
            .from('koto_inbound_agents')
            .insert(agentRecord)
            .select()
            .single()
          if (!res.error) { agentData = res.data; lastInsertError = null; break }
          lastInsertError = res.error
          const m = /Could not find the '([^']+)' column/.exec(res.error.message || '')
          if (m && m[1] in agentRecord) { delete agentRecord[m[1]]; continue }
          break
        }
        if (lastInsertError || !agentData) {
          try { await retellFetch(`/delete-agent/${retellAgent.agent_id}`, 'DELETE') } catch {}
          try { await retellFetch(`/delete-retell-llm/${llmId}`, 'DELETE') } catch {}
          return NextResponse.json({ error: lastInsertError?.message || 'insert failed' }, { status: 500 })
        }

        // Step 4: If the wizard already provisioned a Koto number, link it to the new agent
        if (phone_number) {
          try {
            await retellFetch(`/update-phone-number/${phone_number}`, 'PATCH', {
              inbound_agent_id: retellAgent.agent_id,
            })
            await supabase
              .from('koto_inbound_phone_numbers')
              .update({ agent_id: agentData.id })
              .eq('phone_number', phone_number)
              .eq('agency_id', agency_id)
          } catch (e: any) {
            console.error('[inbound create_agent] Phone link failed (non-fatal):', e?.message)
          }
        }

        return NextResponse.json({ agent: agentData })
      }

      // -------------------------------------------------------------------
      // Update Agent
      // -------------------------------------------------------------------
      case 'update_agent': {
        const { agent_id, update_retell } = body
        if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

        const { data: existing, error: fetchErr } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', agent_id)
          .single()
        if (fetchErr) throw fetchErr

        // Accept either nested { updates: {...} } or fields at the top level (SetupTab spreads form).
        // Whitelist columns known to exist to survive the prod schema drift from answering_service.sql.
        const raw: any = body.updates && typeof body.updates === 'object' ? body.updates : body
        const ALLOWED = new Set([
          'name', 'business_name', 'agent_name', 'department', 'sic_code', 'industry',
          'voice_id', 'voice_name', 'phone_number', 'forward_number',
          'timezone', 'status', 'is_active',
          'greeting_script', 'open_hours_script', 'closed_hours_script', 'closed_script',
          'emergency_script', 'voicemail_script',
          'intake_template', 'intake_questions', 'intake_templates_saved', 'business_hours',
          'emergency_keywords', 'hipaa_mode', 'recording_enabled',
          'sms_notifications', 'email_notifications', 'notification_email', 'notification_phone',
          'ivr_enabled', 'ivr_config', 'ivr_greeting',
          'auto_callback_enabled', 'auto_callback_delay_minutes', 'auto_callback_max_attempts',
          'transfer_phone', 'transfer_enabled',
          // Prompt editor + voice settings
          'prompt_sections',
          'voice_speed', 'voice_temperature', 'interruption_sensitivity',
          'backchannel_frequency', 'enable_backchannel', 'ambient_sound', 'responsiveness',
          'end_call_after_silence_ms', 'reminder_trigger_ms', 'reminder_max_count', 'max_call_duration_ms',
          'retell_llm_id',
          // Delivery / integrations / compliance
          'notification_emails', 'slack_webhook_url', 'teams_webhook_url', 'crm_webhook_url',
          'crm_webhook_secret', 'digest_schedule', 'hipaa_mode', 'retention_days',
          // Prompt-substitution source fields surfaced in the Setup tab
          'address', 'services_list', 'staff_directory', 'scheduling_contact',
          'scheduling_link', 'transfer_phone', 'calendar_webhook_url',
        ])
        const updates: any = {}
        for (const k of Object.keys(raw)) {
          if (ALLOWED.has(k)) updates[k] = raw[k]
        }

        // Try the full update. If a column doesn't exist in prod, drop it and retry —
        // the schema drifts across environments (see answering_service.sql vs live).
        let updated: any = null
        for (let attempt = 0; attempt < 8; attempt++) {
          const { data, error } = await supabase
            .from('koto_inbound_agents')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', agent_id)
            .select()
            .single()
          if (!error) { updated = data; break }
          const m = /Could not find the '([^']+)' column/.exec(error.message || '')
          if (m && m[1] in updates) {
            delete updates[m[1]]
            continue
          }
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (update_retell && existing.retell_agent_id) {
          const retellUpdates: any = {}
          if (updates.agent_name || updates.name || updates.business_name) {
            retellUpdates.agent_name = updates.agent_name || updates.name || updates.business_name
          }
          if (updates.voice_id) retellUpdates.voice_id = updates.voice_id
          if (Object.keys(retellUpdates).length > 0) {
            try { await retellFetch(`/update-agent/${existing.retell_agent_id}`, 'PATCH', retellUpdates) } catch {}
          }
        }

        return NextResponse.json({ success: true, agent: updated })
      }

      // -------------------------------------------------------------------
      // Delete Agent
      // -------------------------------------------------------------------
      case 'delete_agent': {
        const { agent_id: deleteAgentId } = body
        if (!deleteAgentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

        const { data: agent, error: getErr } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', deleteAgentId)
          .single()
        if (getErr) throw getErr

        // Delete Retell agent
        if (agent.retell_agent_id) {
          try { await retellFetch(`/delete-agent/${agent.retell_agent_id}`, 'DELETE') } catch {}
        }

        // Release phone numbers
        const { data: phones } = await supabase
          .from('koto_inbound_phone_numbers')
          .select('*')
          .eq('agent_id', deleteAgentId)
        if (phones) {
          for (const phone of phones) {
            // Column is `retell_number_id` (set by provision_number); handle the legacy
            // `retell_phone_number_id` name too so older rows still clean up.
            const retellPhoneId = phone.retell_number_id || phone.retell_phone_number_id
            if (retellPhoneId) {
              try { await retellFetch(`/delete-phone-number/${retellPhoneId}`, 'DELETE') } catch {}
            }
          }
          await supabase.from('koto_inbound_phone_numbers').delete().eq('agent_id', deleteAgentId)
        }

        // Delete agent record
        const { error: delErr } = await supabase
          .from('koto_inbound_agents')
          .delete()
          .eq('id', deleteAgentId)
        if (delErr) throw delErr

        return NextResponse.json({ success: true })
      }

      // -------------------------------------------------------------------
      // Provision Phone (used by the New Agent wizard before agent exists,
      // and by the dashboard to attach a number to an existing agent)
      // -------------------------------------------------------------------
      case 'provision_number':
      case 'provision_phone': {
        const { agency_id: phoneAgencyId, agent_id: phoneAgentId, area_code: phoneAreaCode } = body

        const parsedAreaCode = parseInt(String(phoneAreaCode || '415'), 10)
        const phoneResult = await retellFetch('/create-phone-number', 'POST', {
          area_code: isNaN(parsedAreaCode) ? 415 : parsedAreaCode,
        })

        // Only persist when we have an owner to scope it to (agency or agent).
        let phoneRecord: any = null
        if (phoneAgencyId || phoneAgentId) {
          const { data, error: phoneErr } = await supabase
            .from('koto_inbound_phone_numbers')
            .insert({
              agency_id: phoneAgencyId || null,
              agent_id: phoneAgentId || null,
              phone_number: phoneResult.phone_number,
              retell_number_id: phoneResult.phone_number_id,
              area_code: String(phoneAreaCode || '415'),
            })
            .select()
            .single()
          if (phoneErr) throw phoneErr
          phoneRecord = data
        }

        return NextResponse.json({
          phone_number: phoneResult.phone_number,
          phone_number_id: phoneResult.phone_number_id,
          phone: phoneRecord,
        })
      }

      // -------------------------------------------------------------------
      // Webhook (Retell events)
      // -------------------------------------------------------------------
      case 'webhook': {
        const { event, call } = body

        // Pre-call: Retell asks us for dynamic variables. We use this moment to
        // check the spam blocklist and surface caller history into the prompt.
        if (event === 'call_inbound' && call) {
          try {
            const { data: agentInfo } = await supabase
              .from('koto_inbound_agents')
              .select('agency_id, id, business_name, name')
              .eq('retell_agent_id', call.agent_id)
              .maybeSingle()
            const agencyIdForCall = agentInfo?.agency_id || null
            const from = call.from_number || ''

            if (agencyIdForCall && await isSpamCaller(supabase, agencyIdForCall, from)) {
              return NextResponse.json({
                call_inbound: {
                  override_agent_id: null,
                  dynamic_variables: { is_spam: 'true' },
                  metadata: { blocked: 'spam' },
                },
                message: 'Spam caller blocked — call should be hung up.',
              })
            }

            const history = agencyIdForCall ? await buildCallerHistory(supabase, agencyIdForCall, from) : null
            const dyn: Record<string, string> = {}
            if (history) {
              dyn.known_caller = 'true'
              if (history.last_caller_name) dyn.caller_name = history.last_caller_name
              dyn.last_call_summary = history.last_call_summary || ''
              dyn.total_recent_calls = String(history.total_recent_calls)
            }
            return NextResponse.json({
              call_inbound: { dynamic_variables: dyn },
            })
          } catch (e: any) {
            console.error('[inbound call_inbound] failed:', e?.message)
            return NextResponse.json({ call_inbound: { dynamic_variables: {} } })
          }
        }

        if (event === 'call_ended' && call) {
          const transcript = call.transcript || ''
          const fromNumber = call.from_number || ''
          const callId = call.call_id
          const duration = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0
          const urgency = detectUrgency(transcript)

          // Resolve the agent + agency
          const { data: agentInfo } = await supabase
            .from('koto_inbound_agents')
            .select('*')
            .eq('retell_agent_id', call.agent_id)
            .single()
          const agency_id = agentInfo?.agency_id || null
          const db_agent_id = agentInfo?.id || null
          const businessName = agentInfo?.business_name || agentInfo?.name || 'your business'

          // Run all post-call AI passes in parallel: summary, outcome/sentiment, details, intent, quality
          const [summary, analysis, callerDetails, intent, quality] = await Promise.all([
            anthropicChat(
              'You are a call summarizer for an answering service. Summarize the following call transcript in 2-3 sentences. Include the caller\'s name if mentioned, their reason for calling, and any action items.',
              `Transcript:\n${transcript}`,
              512,
            ).catch(() => 'Summary unavailable.'),
            anthropicChat(
              'Analyze this call transcript. Return ONLY a JSON object with two fields: "outcome" (one of: completed, voicemail, missed, transferred, abandoned, appointment) and "sentiment" (one of: positive, neutral, negative, frustrated). No other text.',
              `Transcript:\n${transcript}`,
              256,
            ).then(s => { try { return JSON.parse(s) } catch { return {} } }).catch(() => ({})),
            extractCallerDetails(transcript, fromNumber),
            classifyIntent(transcript, urgency),
            scoreCallQuality(transcript),
          ])
          let outcome = analysis.outcome || 'completed'
          const sentiment = analysis.sentiment || 'neutral'
          // Voicemail override: if the caller hung up under 5 seconds, treat as voicemail-candidate
          if (duration > 0 && duration < 5) outcome = 'voicemail'

          // Archive the recording + render a voice version of the summary in parallel
          const [archivedRecordingUrl, voiceBuffer] = await Promise.all([
            archiveRecording(call.recording_url || '', callId),
            synthesizeVoiceSummary(summary),
          ])
          const summaryAudioUrl = voiceBuffer
            ? await uploadToBlob(`answering/summaries/${callId}.mp3`, voiceBuffer, 'audio/mpeg')
            : null

          // Derive a follow-up timestamp if the caller's details say they need one
          const followUpAt = (() => {
            if (!callerDetails?.follow_up_needed) return null
            // Default: follow up within 4 business hours (conservative). Emergency → 30 min.
            const offsetMs = urgency === 'emergency' ? 30 * 60 * 1000 : 4 * 60 * 60 * 1000
            return new Date(Date.now() + offsetMs).toISOString()
          })()

          // Insert call record (schema-tolerant — drop unknown columns and retry)
          const callRecordCandidate: any = {
            agency_id,
            agent_id: db_agent_id,
            retell_call_id: callId,
            caller_number: fromNumber,
            caller_phone: fromNumber, // legacy column name in some envs
            caller_name: callerDetails?.caller_name || null,
            transcript,
            summary,
            ai_summary: summary, // legacy column name in some envs
            duration_seconds: duration,
            recording_url: archivedRecordingUrl || call.recording_url || '',
            recording_archive_url: archivedRecordingUrl,
            summary_audio_url: summaryAudioUrl,
            caller_details: callerDetails,
            intake_data: callerDetails,
            urgency,
            outcome,
            sentiment,
            intent,
            quality_score: quality?.score ?? null,
            quality_notes: quality ? [quality.strengths, quality.improvements].filter(Boolean).join(' · ') : null,
            follow_up_at: followUpAt,
            follow_up_required: !!followUpAt,
            follow_up_notes: callerDetails?.follow_up_instructions || null,
          }
          let callRecord: any = null
          let lastErr: any = null
          for (let attempt = 0; attempt < 12; attempt++) {
            const res = await supabase.from('koto_inbound_calls').insert(callRecordCandidate).select().single()
            if (!res.error) { callRecord = res.data; lastErr = null; break }
            lastErr = res.error
            const m = /Could not find the '([^']+)' column/.exec(res.error.message || '')
            if (m && m[1] in callRecordCandidate) { delete callRecordCandidate[m[1]]; continue }
            break
          }
          if (lastErr || !callRecord) throw lastErr || new Error('insert failed')

          // Bill the call
          if (duration > 0 && agency_id) {
            const minutes = Math.ceil(duration / 60)
            try {
              await fetch(new URL('/api/billing', request.url).toString(), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'record_usage', agency_id,
                  feature: 'voice_inbound', quantity: minutes, unit: 'minutes',
                  unit_cost: 0.02,
                }),
              })
            } catch {}
          }

          // Per-question intake extraction (preserves the existing intake table)
          if (agentInfo?.intake_questions?.length) {
            try {
              const intakePrompt = `Based on this call transcript, extract answers to the following intake questions. Return a JSON array where each element has "question" (string) and "answer" (string or null if not answered).\n\nQuestions:\n${agentInfo.intake_questions.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n')}\n\nTranscript:\n${transcript}`
              const intakeRaw = await anthropicChat('Extract intake form answers from a call transcript. Return ONLY valid JSON.', intakePrompt, 1024)
              const intakeAnswers = JSON.parse(intakeRaw)
              if (Array.isArray(intakeAnswers)) {
                const intakeRecords = intakeAnswers.map((item: any) => ({
                  call_id: callRecord.id,
                  agent_id: db_agent_id,
                  agency_id,
                  question: item.question,
                  answer: item.answer || null,
                }))
                await supabase.from('koto_inbound_intakes').insert(intakeRecords)
              }
            } catch (err) {
              console.error('[inbound webhook] Intake extraction failed:', err)
            }
          }

          // Build the polished client email
          const callDetailUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/answering?call=${callRecord.id}`
          const emailHtml = buildClientEmail({
            businessName,
            urgency,
            outcome,
            sentiment,
            fromNumber,
            duration,
            summary,
            caller: callerDetails || {},
            transcript,
            recordingUrl: archivedRecordingUrl || call.recording_url,
            summaryAudioUrl,
            callDetailUrl,
          })

          // Intent-based routing: routing targets with a matching intent/urgency get their
          // own email + SMS. These are additive to the default notification_email.
          const routingTargets = db_agent_id ? await loadRoutingTargets(supabase, db_agent_id) : []
          const picked = pickRecipientsForIntent(routingTargets, intent, urgency)

          const emailRecipients = new Set<string>()
          if (agentInfo?.notification_email) emailRecipients.add(agentInfo.notification_email)
          if (Array.isArray(agentInfo?.notification_emails)) {
            for (const e of agentInfo.notification_emails) if (typeof e === 'string' && e) emailRecipients.add(e)
          }
          for (const e of picked.emails) emailRecipients.add(e)
          const uniqueRecipients = [...emailRecipients]

          if (uniqueRecipients.length > 0 && process.env.RESEND_API_KEY) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: EMAIL_FROM,
                  to: uniqueRecipients,
                  subject: `${urgency === 'emergency' ? '🚨 EMERGENCY' : urgency === 'high' ? '⚠️ Urgent' : 'New call'} — ${callerDetails?.caller_name || fromNumber || 'Unknown'} for ${businessName}`,
                  html: emailHtml,
                }),
              })
            } catch (emailErr) {
              console.error('[inbound webhook] Email notification failed:', emailErr)
            }
          }

          // SMS fan-out — default notification_phone plus any phones matched by intent routing
          const smsTargets = new Set<string>()
          if (agentInfo?.notification_phone) smsTargets.add(agentInfo.notification_phone)
          for (const p of picked.phones) smsTargets.add(p)
          if (smsTargets.size > 0) {
            const smsBody = [
              `${urgency === 'emergency' ? '🚨 EMERGENCY' : urgency === 'high' ? '⚠️ Urgent' : 'New call'}: ${callerDetails?.caller_name || fromNumber}`,
              callerDetails?.callback_number ? `Call back: ${callerDetails.callback_number}` : null,
              callerDetails?.reason_for_calling ? `Re: ${callerDetails.reason_for_calling}` : null,
              `Details: ${callDetailUrl}`,
            ].filter(Boolean).join('\n')
            await Promise.all([...smsTargets].map(to => sendSms(to, smsBody)))
          }

          // Slack / Teams integrations — pure fire-and-forget, one call each
          if (agentInfo?.slack_webhook_url) {
            await postToSlack(agentInfo.slack_webhook_url, {
              businessName, urgency,
              summary,
              caller: callerDetails || {},
              fromNumber,
              callDetailUrl,
            })
          }
          if (agentInfo?.teams_webhook_url) {
            await fireOutboundWebhook(agentInfo.teams_webhook_url, {
              '@type': 'MessageCard',
              '@context': 'https://schema.org/extensions',
              summary: `New call for ${businessName}`,
              themeColor: urgency === 'emergency' ? 'dc2626' : urgency === 'high' ? 'ea580c' : '16a34a',
              title: `${urgency.toUpperCase()} — ${callerDetails?.caller_name || fromNumber || 'Unknown'}`,
              text: summary,
              potentialAction: callDetailUrl ? [{ '@type': 'OpenUri', name: 'Open in Koto', targets: [{ os: 'default', uri: callDetailUrl }] }] : undefined,
            })
          }

          // CRM / Zapier — per-agent outbound webhook with the canonical JSON payload
          if (agentInfo?.crm_webhook_url) {
            await fireOutboundWebhook(agentInfo.crm_webhook_url, {
              event: 'call_completed',
              secret: agentInfo.crm_webhook_secret || undefined,
              agency_id,
              agent_id: db_agent_id,
              business_name: businessName,
              call: normalizeCallRow(callRecord),
              intent,
              quality,
              recording_url: archivedRecordingUrl || call.recording_url || null,
              summary_audio_url: summaryAudioUrl,
              call_detail_url: callDetailUrl,
            })
          }

          return NextResponse.json({ success: true, call: callRecord })
        }

        return NextResponse.json({ success: true, message: 'Event received' })
      }

      // -------------------------------------------------------------------
      // Prompt Editor — customize one section with Claude
      // -------------------------------------------------------------------
      case 'customize_section': {
        const { section_id, current_text, business_context } = body
        if (!section_id || typeof current_text !== 'string') {
          return NextResponse.json({ error: 'section_id and current_text required' }, { status: 400 })
        }
        const meta = DEFAULT_PROMPT_SECTIONS.find(s => s.id === section_id)
        if (!meta) return NextResponse.json({ error: 'unknown_section' }, { status: 400 })
        if (!meta.ai_customizable) {
          return NextResponse.json({ error: 'section is not AI-customizable' }, { status: 400 })
        }

        const ctx = business_context || {}
        const systemPrompt = `You are customizing one section of a system prompt for an AI phone receptionist. Rewrite the section below so it fits the specific business, keeping the same structure, intent, and mustache-style placeholders ({{like_this}}). Do not add new sections. Do not invent facts — only reference details given in the business context. Do not include headings or meta commentary. Return only the rewritten section text.

Section: ${meta.label} (id: ${meta.id})
Section purpose: ${meta.description}

Business context (JSON):
${JSON.stringify(ctx, null, 2)}`

        const userMsg = `Here is the current section. Rewrite it customized for this business. Preserve placeholders in double curly braces. Keep it the same approximate length.

---
${current_text}
---`

        const customized = await anthropicChat(systemPrompt, userMsg, 1200)
        return NextResponse.json({ text: customized.trim() })
      }

      // -------------------------------------------------------------------
      // Prompt Editor — compile + push to the Retell LLM
      // -------------------------------------------------------------------
      case 'sync_retell_prompt': {
        const { agent_id: syncAgentId } = body
        if (!syncAgentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

        const { data: row, error: rowErr } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', syncAgentId)
          .maybeSingle()
        if (rowErr || !row) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })

        const sections: Record<string, string> = { ...getDefaultSections(), ...((row as any).prompt_sections || {}) }
        // Substitute {{placeholders}} with values from the agent record so the
        // Retell LLM gets a fully resolved prompt — no literal {{tokens}} left.
        const resolvedSections: Record<string, string> = Object.fromEntries(
          Object.entries(sections).map(([id, text]) => [id, resolveSectionPlaceholders(text, row as any)])
        )
        const compiled = compilePromptSections(resolvedSections)

        const retellAgentId = (row as any).retell_agent_id
        const retellLlmId = (row as any).retell_llm_id
        if (!retellAgentId) {
          return NextResponse.json({ error: 'agent has no retell_agent_id' }, { status: 400 })
        }

        // Prefer updating the existing LLM; fall back to fetching it from the agent.
        let targetLlmId = retellLlmId
        if (!targetLlmId) {
          try {
            const agentInfo: any = await retellFetch(`/get-agent/${retellAgentId}`)
            targetLlmId = agentInfo?.response_engine?.llm_id
          } catch {}
        }
        if (!targetLlmId) {
          return NextResponse.json({ error: 'could not resolve retell_llm_id' }, { status: 500 })
        }

        try {
          await retellFetch(`/update-retell-llm/${targetLlmId}`, 'PATCH', {
            general_prompt: compiled,
          })
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'retell update failed' }, { status: 500 })
        }

        // Also push any saved voice/speech settings to the Retell agent so the
        // Voice Controls card in the UI is the source of truth. Always register
        // the webhook_url — existing agents created before webhooks were wired
        // need this patch to start firing call_ended events.
        const r: any = row
        const webhookBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'
        const agentPatch: Record<string, any> = {
          webhook_url: `${webhookBase}/api/inbound/webhook`,
        }
        if (r.voice_id) agentPatch.voice_id = r.voice_id
        if (typeof r.voice_speed === 'number') agentPatch.voice_speed = r.voice_speed
        if (typeof r.voice_temperature === 'number') agentPatch.voice_temperature = r.voice_temperature
        if (typeof r.responsiveness === 'number') agentPatch.responsiveness = r.responsiveness
        if (typeof r.interruption_sensitivity === 'number') agentPatch.interruption_sensitivity = r.interruption_sensitivity
        if (typeof r.enable_backchannel === 'boolean') agentPatch.enable_backchannel = r.enable_backchannel
        if (typeof r.backchannel_frequency === 'number') agentPatch.backchannel_frequency = r.backchannel_frequency
        if (r.ambient_sound !== undefined) agentPatch.ambient_sound = r.ambient_sound === 'none' ? null : r.ambient_sound
        if (typeof r.end_call_after_silence_ms === 'number') agentPatch.end_call_after_silence_ms = r.end_call_after_silence_ms
        if (typeof r.reminder_trigger_ms === 'number') agentPatch.reminder_trigger_ms = r.reminder_trigger_ms
        if (typeof r.reminder_max_count === 'number') agentPatch.reminder_max_count = r.reminder_max_count
        if (typeof r.max_call_duration_ms === 'number') agentPatch.max_call_duration_ms = r.max_call_duration_ms
        if (Object.keys(agentPatch).length > 0) {
          try { await retellFetch(`/update-agent/${retellAgentId}`, 'PATCH', agentPatch) } catch (e: any) {
            console.error('[sync_retell_prompt] agent patch failed (non-fatal):', e?.message)
          }
        }

        // Best-effort persist of retell_llm_id for next time
        if (!retellLlmId) {
          try {
            await supabase.from('koto_inbound_agents').update({ retell_llm_id: targetLlmId }).eq('id', syncAgentId)
          } catch {}
        }

        return NextResponse.json({ success: true, prompt_length: compiled.length })
      }

      // -------------------------------------------------------------------
      // Call lifecycle actions — resolve / follow-up / notes / spam / download
      // -------------------------------------------------------------------
      case 'mark_resolved': {
        const { call_id: mrId, resolved_by } = body
        if (!mrId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        const patch: Record<string, any> = {
          resolved_at: new Date().toISOString(),
          resolved_by: resolved_by || null,
          follow_up_required: false,
        }
        for (let i = 0; i < 4; i++) {
          const res = await supabase.from('koto_inbound_calls').update(patch).eq('id', mrId).select().maybeSingle()
          if (!res.error) return NextResponse.json({ success: true, call: normalizeCallRow(res.data) })
          const m = /Could not find the '([^']+)' column/.exec(res.error.message || '')
          if (m && m[1] in patch) { delete patch[m[1]]; continue }
          return NextResponse.json({ error: res.error.message }, { status: 500 })
        }
        return NextResponse.json({ error: 'update_failed' }, { status: 500 })
      }

      case 'set_follow_up': {
        const { call_id: fuId, follow_up_at, follow_up_notes, required = true } = body
        if (!fuId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        const patch: Record<string, any> = {
          follow_up_at: follow_up_at || null,
          follow_up_notes: follow_up_notes ?? null,
          follow_up_required: !!required,
        }
        for (let i = 0; i < 4; i++) {
          const res = await supabase.from('koto_inbound_calls').update(patch).eq('id', fuId).select().maybeSingle()
          if (!res.error) return NextResponse.json({ success: true, call: normalizeCallRow(res.data) })
          const m = /Could not find the '([^']+)' column/.exec(res.error.message || '')
          if (m && m[1] in patch) { delete patch[m[1]]; continue }
          return NextResponse.json({ error: res.error.message }, { status: 500 })
        }
        return NextResponse.json({ error: 'update_failed' }, { status: 500 })
      }

      case 'add_call_note': {
        const { call_id: anId, note } = body
        if (!anId || !note) return NextResponse.json({ error: 'call_id and note required' }, { status: 400 })
        // Append to follow_up_notes (simplest schema-tolerant path — no new table).
        const { data: existing } = await supabase.from('koto_inbound_calls').select('follow_up_notes').eq('id', anId).maybeSingle()
        const prev = existing?.follow_up_notes || ''
        const stamp = new Date().toISOString()
        const combined = prev ? `${prev}\n\n[${stamp}] ${note}` : `[${stamp}] ${note}`
        const res = await supabase.from('koto_inbound_calls').update({ follow_up_notes: combined }).eq('id', anId).select().maybeSingle()
        if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
        return NextResponse.json({ success: true, call: normalizeCallRow(res.data) })
      }

      case 'release_number': {
        // Release a Koto-provisioned phone number — deletes from Retell + DB.
        const { phone_number_id, phone_number, agency_id: relAgency } = body
        if (!phone_number && !phone_number_id) return NextResponse.json({ error: 'phone_number or phone_number_id required' }, { status: 400 })

        // Look up the Retell phone number ID if only the number was given.
        let retellPhoneId = phone_number_id
        if (!retellPhoneId && phone_number) {
          const { data: row } = await supabase
            .from('koto_inbound_phone_numbers')
            .select('retell_number_id, retell_phone_number_id')
            .eq('phone_number', phone_number)
            .maybeSingle()
          retellPhoneId = row?.retell_number_id || (row as any)?.retell_phone_number_id
        }

        if (retellPhoneId) {
          try { await retellFetch(`/delete-phone-number/${retellPhoneId}`, 'DELETE') } catch (e: any) {
            console.error('[release_number] Retell delete failed (continuing):', e?.message)
          }
        }

        // Remove from DB. Match by either phone_number or retell id, scoped to agency if given.
        let q = supabase.from('koto_inbound_phone_numbers').delete()
        if (phone_number) q = q.eq('phone_number', phone_number)
        if (retellPhoneId) q = q.or(`retell_number_id.eq.${retellPhoneId},retell_phone_number_id.eq.${retellPhoneId}`)
        if (relAgency) q = q.eq('agency_id', relAgency)
        await q

        // Detach from any agent that had this number set on their record.
        if (phone_number) {
          await supabase.from('koto_inbound_agents').update({ phone_number: null }).eq('phone_number', phone_number)
        }

        return NextResponse.json({ success: true })
      }

      case 'sync_all_retell_webhooks': {
        // Pushes webhook_url + the VOB-style voice defaults onto every Retell
        // agent for the given agency. Use this to fix legacy agents whose
        // Retell config still has backchannel on / high interruption / etc.
        const { agency_id: syncAgency } = body
        if (!syncAgency) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'}/api/inbound/webhook`
        const { data: agents } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('agency_id', syncAgency)
        let synced = 0, failed = 0
        for (const ag of agents || []) {
          if (!ag.retell_agent_id) continue
          // Start with the VOB-tuned baseline (no backchannel, patient), then
          // overlay any custom voice settings the agent has saved in the DB.
          const patch: Record<string, any> = {
            webhook_url: webhookUrl,
            enable_backchannel: false,
            interruption_sensitivity: 0.3,
            responsiveness: 0.7,
            voice_speed: 0.95,
            ambient_sound: null,
            end_call_after_silence_ms: 30000,
            reminder_trigger_ms: 10000,
            reminder_max_count: 2,
            max_call_duration_ms: 1800000,
          }
          if (ag.voice_id) patch.voice_id = ag.voice_id
          if (typeof ag.voice_speed === 'number') patch.voice_speed = ag.voice_speed
          if (typeof ag.voice_temperature === 'number') patch.voice_temperature = ag.voice_temperature
          if (typeof ag.responsiveness === 'number') patch.responsiveness = ag.responsiveness
          if (typeof ag.interruption_sensitivity === 'number') patch.interruption_sensitivity = ag.interruption_sensitivity
          if (typeof ag.enable_backchannel === 'boolean') patch.enable_backchannel = ag.enable_backchannel
          if (typeof ag.backchannel_frequency === 'number') patch.backchannel_frequency = ag.backchannel_frequency
          if (ag.ambient_sound !== undefined && ag.ambient_sound !== null) patch.ambient_sound = ag.ambient_sound === 'none' ? null : ag.ambient_sound
          if (typeof ag.end_call_after_silence_ms === 'number') patch.end_call_after_silence_ms = ag.end_call_after_silence_ms
          if (typeof ag.reminder_trigger_ms === 'number') patch.reminder_trigger_ms = ag.reminder_trigger_ms
          if (typeof ag.reminder_max_count === 'number') patch.reminder_max_count = ag.reminder_max_count
          if (typeof ag.max_call_duration_ms === 'number') patch.max_call_duration_ms = ag.max_call_duration_ms
          try {
            await retellFetch(`/update-agent/${ag.retell_agent_id}`, 'PATCH', patch)
            synced++
          } catch (e: any) {
            console.error('[sync_all_retell_webhooks] failed for', ag.id, e?.message)
            failed++
          }
        }
        return NextResponse.json({ success: true, synced, failed, webhook_url: webhookUrl })
      }

      case 'block_spam': {
        const { phone_number: spamNum, agency_id: spamAgency, reason } = body
        if (!spamNum || !spamAgency) return NextResponse.json({ error: 'phone_number and agency_id required' }, { status: 400 })
        try {
          await supabase.from('koto_inbound_spam_blocklist').insert({
            agency_id: spamAgency,
            phone_number: spamNum,
            reason: reason || 'manual',
          })
          return NextResponse.json({ success: true })
        } catch (e: any) {
          return NextResponse.json({ error: e?.message || 'block failed', hint: 'koto_inbound_spam_blocklist table may not exist yet — migration needed.' }, { status: 500 })
        }
      }

      case 'regenerate_summary_audio': {
        const { call_id: rsaId } = body
        if (!rsaId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })
        const { data: row } = await supabase.from('koto_inbound_calls').select('id, summary, ai_summary').eq('id', rsaId).maybeSingle()
        const text = row?.summary || row?.ai_summary || ''
        if (!text) return NextResponse.json({ error: 'no summary text' }, { status: 400 })
        const buf = await synthesizeVoiceSummary(text)
        if (!buf) return NextResponse.json({ error: 'TTS unavailable — set ELEVENLABS_API_KEY' }, { status: 500 })
        const url = await uploadToBlob(`answering/summaries/${rsaId}.mp3`, buf, 'audio/mpeg')
        if (!url) return NextResponse.json({ error: 'blob upload failed' }, { status: 500 })
        await supabase.from('koto_inbound_calls').update({ summary_audio_url: url }).eq('id', rsaId)
        return NextResponse.json({ success: true, summary_audio_url: url })
      }

      case 'send_digest': {
        // Weekly digest — one email per agent with a rollup of the last N days.
        const { agency_id: dAgency, days = 7 } = body
        if (!dAgency) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        const { data: agents } = await supabase.from('koto_inbound_agents').select('id, name, business_name, notification_email, notification_emails').eq('agency_id', dAgency)
        let sent = 0
        for (const ag of agents || []) {
          const { data: calls } = await supabase.from('koto_inbound_calls').select('*').eq('agent_id', ag.id).gte('created_at', since).order('created_at', { ascending: false })
          if (!calls || calls.length === 0) continue
          const recipients = new Set<string>()
          if (ag.notification_email) recipients.add(ag.notification_email)
          if (Array.isArray(ag.notification_emails)) for (const e of ag.notification_emails) if (e) recipients.add(e)
          if (recipients.size === 0 || !process.env.RESEND_API_KEY) continue
          const rows = (calls || []).slice(0, 50).map((c: any) => `<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${new Date(c.created_at).toLocaleString()}</td><td style="padding:6px;border-bottom:1px solid #f3f4f6;font-size:12px">${c.caller_name || c.caller_number || 'Unknown'}</td><td style="padding:6px;border-bottom:1px solid #f3f4f6;font-size:12px">${(c.ai_summary || c.summary || '').slice(0, 140)}</td><td style="padding:6px;border-bottom:1px solid #f3f4f6;font-size:12px">${c.urgency || '—'}</td></tr>`).join('')
          const html = `<div style="font-family:system-ui;max-width:700px"><h2 style="margin:0 0 8px">${ag.business_name || ag.name} — ${days}-day digest</h2><p style="color:#6b7280;font-size:13px;margin:0 0 14px">${calls.length} calls in the last ${days} days.</p><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px"><thead><tr style="background:#f9fafb"><th style="padding:6px;text-align:left;font-size:11px;color:#6b7280">Date</th><th style="padding:6px;text-align:left;font-size:11px;color:#6b7280">Caller</th><th style="padding:6px;text-align:left;font-size:11px;color:#6b7280">Summary</th><th style="padding:6px;text-align:left;font-size:11px;color:#6b7280">Urgency</th></tr></thead><tbody>${rows}</tbody></table></div>`
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Koto Answering Service <notifications@hellokoto.com>',
                to: [...recipients],
                subject: `${ag.business_name || ag.name} — ${days}-day call digest (${calls.length} calls)`,
                html,
              }),
            })
            sent++
          } catch {}
        }
        return NextResponse.json({ success: true, digests_sent: sent })
      }

      // -------------------------------------------------------------------
      // Generate Script
      // -------------------------------------------------------------------
      case 'generate_script': {
        // Accept `section` (new UI) or `script_type` (older caller).
        const scriptSection = body.section || body.script_type
        if (!scriptSection) {
          return NextResponse.json({ error: 'section required (greeting, open_hours, closed_hours, emergency, voicemail)' }, { status: 400 })
        }
        const ctx = body.business_context || {}
        const scriptBiz = body.business_name || ctx.name || ctx.business_name || 'the business'
        const scriptIndustry = body.business_type || ctx.industry || ctx.sic || 'general'
        const department = ctx.department ? ` (${ctx.department} department)` : ''
        const custom_instructions = body.custom_instructions

        const sectionGuide: Record<string, string> = {
          greeting: 'the opening greeting the agent says when a caller answers — warm, introduce the business, invite them to share why they called',
          open_hours: 'the response during business hours confirming the business is open and the agent is taking the message',
          closed_hours: 'the response outside business hours — explain hours, promise a callback, offer to take a message',
          emergency: 'the emergency response — acknowledge urgency, collect critical info, explain next steps',
          voicemail: 'a voicemail message callers hear when the mailbox is reached — short, professional, request name/number/reason',
        }
        const guide = sectionGuide[scriptSection] || `a ${scriptSection} script for an AI answering service`

        const systemPrompt = `You are an expert at writing professional answering service scripts. Write ${guide} for "${scriptBiz}"${department}, a ${scriptIndustry} business. The script should be conversational, warm, and professional. Keep it under 180 words and return only the script text — no headings or meta commentary.`
        const userMsg = custom_instructions
          ? `Additional instructions: ${custom_instructions}`
          : `Write the ${scriptSection} script now.`

        const script = await anthropicChat(systemPrompt, userMsg, 512)
        return NextResponse.json({ script })
      }

      // -------------------------------------------------------------------
      // Generate Questions
      // -------------------------------------------------------------------
      case 'generate_questions': {
        const { industry, business_description, num_questions, naics_code: qNaics, naics_title: qNaicsTitle } = body

        const naicsInfo = qNaics ? ` The business is classified under NAICS ${qNaics} (${qNaicsTitle}). Tailor questions to this specific industry — use correct terminology, ask about industry-specific needs, and consider regulatory requirements.` : ''
        const systemPrompt = `You are an expert at creating intake questionnaires for answering services. Generate intake questions that a virtual receptionist should ask callers. Return ONLY a JSON array of objects with "text" (string) and "type" (one of: text, phone, email, date, number, boolean).${naicsInfo}`
        const userMsg = `Generate ${num_questions || 6} intake questions for a ${industry || 'general'} business. ${business_description ? `Business description: ${business_description}` : ''}`

        const raw = await anthropicChat(systemPrompt, userMsg, 1024)
        let questions = []
        try {
          questions = JSON.parse(raw)
        } catch {
          // Try to extract JSON from response
          const match = raw.match(/\[[\s\S]*\]/)
          if (match) questions = JSON.parse(match[0])
        }

        return NextResponse.json({ questions })
      }

      // -------------------------------------------------------------------
      // Send Notifications (manual resend)
      // -------------------------------------------------------------------
      case 'send_notifications': {
        const { call_id: notifyCallId } = body
        if (!notifyCallId) return NextResponse.json({ error: 'call_id required' }, { status: 400 })

        const { data: callData, error: callFetchErr } = await supabase
          .from('koto_inbound_calls')
          .select('*')
          .eq('id', notifyCallId)
          .single()
        if (callFetchErr) throw callFetchErr

        const { data: agentData } = await supabase
          .from('koto_inbound_agents')
          .select('*')
          .eq('id', callData.agent_id)
          .single()

        const notifications: string[] = []

        // SMS
        if (agentData?.notification_phone) {
          notifications.push(`SMS logged for ${agentData.notification_phone}`)
          // TODO: Actual SMS via Twilio
        }

        // Email
        if (agentData?.notification_email && process.env.RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: EMAIL_FROM,
                to: [agentData.notification_email],
                subject: `[Resend] Call Notification - ${callData.caller_number || 'Unknown'}`,
                html: `
                  <h2>Call Notification (Resent)</h2>
                  <p><strong>From:</strong> ${callData.caller_number || 'Unknown'}</p>
                  <p><strong>Urgency:</strong> ${callData.urgency}</p>
                  <p><strong>Summary:</strong> ${callData.summary}</p>
                  ${callData.recording_url ? `<p><a href="${callData.recording_url}">Listen to Recording</a></p>` : ''}
                `.trim(),
              }),
            })
            notifications.push(`Email sent to ${agentData.notification_email}`)
          } catch (emailErr) {
            console.error('[inbound] Resend email failed:', emailErr)
            notifications.push('Email send failed')
          }
        }

        return NextResponse.json({ success: true, notifications })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[inbound POST]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

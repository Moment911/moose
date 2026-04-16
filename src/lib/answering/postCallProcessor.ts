/**
 * Post-call processor -- runs after a Retell call ends.
 * Ported from backend/src/services/post-call-processor.js.
 *
 * Responsibilities:
 *   1. Summarise transcript via Claude (intent + leadInfo extraction)
 *   2. Persist summary, intent, leadInfo onto koto_inbound_calls
 *   3. (Optional) Fire SMS follow-up via the existing /api/inbound channel
 *
 * GHL contact upsert is left to the existing GHL integration pipeline in Koto
 * (src/app/api/ghl/*). This module only generates the structured summary.
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''

type PostCallAnalysis = {
  summary: string
  intent: 'emergency' | 'sales' | 'support' | 'scheduling' | 'billing' | 'existing_client' | 'general' | 'unknown'
  leadInfo: {
    name?: string
    phone?: string
    email?: string
    address?: string
    [k: string]: any
  }
}

export async function summariseTranscript(transcript: string): Promise<PostCallAnalysis> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY required for post-call analysis')
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

  const system = `You are a call summariser. Output strict JSON with keys:
- summary (string, 2-3 sentences)
- intent (one of: emergency, sales, support, scheduling, billing, existing_client, general, unknown)
- leadInfo (object with optional: name, phone, email, address)
Do not include any other text or code fences.`

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    temperature: 0.1,
    system,
    messages: [{ role: 'user', content: transcript.slice(0, 12000) }],
  })

  const text = resp.content
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
    .replace(/^```json\s*|\s*```$/g, '')

  try {
    const parsed = JSON.parse(text)
    return {
      summary: String(parsed.summary || '').slice(0, 2000),
      intent: parsed.intent || 'unknown',
      leadInfo: parsed.leadInfo || {},
    }
  } catch {
    return { summary: text.slice(0, 500), intent: 'unknown', leadInfo: {} }
  }
}

export async function processEndedCall({ callId }: { callId: string }) {
  const supabase = sb()

  const { data: call } = await supabase
    .from('koto_inbound_calls')
    .select('id, transcript, ai_summary, intent, duration_seconds, caller_phone, agent_id, outcome')
    .eq('id', callId)
    .maybeSingle()

  if (!call) return { ok: false, reason: 'call_not_found' }
  if (!call.transcript) return { ok: false, reason: 'no_transcript' }
  if (call.ai_summary && call.intent) return { ok: true, skipped: true }

  let analysis: PostCallAnalysis
  try {
    analysis = await summariseTranscript(call.transcript)
  } catch (e: any) {
    return { ok: false, reason: 'llm_failed', error: e?.message }
  }

  await supabase
    .from('koto_inbound_calls')
    .update({
      ai_summary: analysis.summary,
      intent: analysis.intent,
      lead_info: analysis.leadInfo,
    })
    .eq('id', callId)

  return { ok: true, analysis }
}

export function shouldSendSmsFollowup(call: { status?: string; duration_seconds?: number }, intent: string): boolean {
  if (call.status === 'forwarded') return false
  if (intent === 'emergency') return false
  if (call.duration_seconds != null && call.duration_seconds < 10) return false
  return true
}

export function buildFollowupSms(companyName: string, intent: string): string {
  if (intent === 'scheduling') {
    return `Hi! Thanks for calling ${companyName}. We've logged your appointment request and someone will confirm shortly. Reply HELP for help, STOP to opt out.`
  }
  return `Hi! Thanks for calling ${companyName}. We've received your message and will follow up soon. Reply HELP for help, STOP to opt out.`
}

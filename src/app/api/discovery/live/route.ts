import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logTokenUsage } from '@/lib/tokenTracker'

// ─────────────────────────────────────────────────────────────
// Discovery Live Session API
//
// Two actions, both tuned for sub-5-second round-trips so the UX
// feels conversational instead of batchy.
//
// extract_fields
//   Input: a single just-spoken sentence + last ~2000 chars of
//   rolling transcript + the set of already-filled field ids +
//   the currently visible section id.
//
//   The engagement's sections are loaded and the "open" fields
//   are built — fields that are empty and not in already_populated.
//   Only the top 15 MOST RELEVANT open fields are sent to Claude
//   (current section first, then other sections) to keep the
//   prompt short and the latency low.
//
//   Claude returns an array of extractions: [{ section_id,
//   field_id, answer, confidence }]. The caller is responsible
//   for saving them via the normal save_field action so the
//   vault/audit pipelines still fire.
//
// live_coach_hint
//   Input: the just-spoken sentence + currently visible section
//   id + (optional) a short summary of what's already been filled
//   in the doc.
//
//   Returns a single short coaching hint (1-2 sentences, max 150
//   tokens) that reacts in real time to what the client just said.
//   Must never repeat asks for info that's already captured —
//   filled_context is passed to the model for that reason.
//
// Both actions degrade gracefully: any error path returns an
// empty/null response so the client can keep listening without
// the live session stalling.
// ─────────────────────────────────────────────────────────────

const FAST_MODEL = 'claude-haiku-4-5-20251001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Trigger words that hint at high-information sentences. The client
// already filters short sentences via the same list, but we use it
// server-side too as a secondary safety net so we never burn a Claude
// call on "yeah", "right", "mm-hmm".
export const TRIGGER_WORDS = [
  'use', 'using', 'platform', 'crm', 'software', 'system', 'tool',
  'spend', 'budget', 'month', 'year', 'revenue', 'employees', 'team',
  'google', 'facebook', 'meta', 'email', 'text', 'sms', 'ads', 'advertising',
  'website', 'leads', 'customers', 'clients', 'referral', 'reviews',
  'open rate', 'click', 'conversion', 'funnel', 'pipeline', 'follow up',
  'competitor', 'different', 'better', 'worse', 'problem', 'challenge', 'goal',
  'want', 'need', 'trying', 'worked', "didn't work", 'failed', 'success',
]

function isLikelyMeaningful(sentence: string): boolean {
  if (!sentence) return false
  const words = sentence.trim().split(/\s+/).length
  if (words >= 8) return true
  const lower = sentence.toLowerCase()
  return TRIGGER_WORDS.some((w) => lower.includes(w))
}

async function callClaude(opts: {
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FAST_MODEL,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })
    if (!res.ok) return null
    const d = await res.json()
    // Fire-and-forget token accounting
    void logTokenUsage({
      feature: 'discovery_live_extraction',
      model: FAST_MODEL,
      inputTokens: d.usage?.input_tokens || 0,
      outputTokens: d.usage?.output_tokens || 0,
    })
    const text = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim()
    return text || null
  } catch {
    return null
  }
}

function parseJsonSafe(text: string): any {
  if (!text) return null
  const cleaned = text.replace(/```json|```/g, '').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, engagement_id, agency_id } = body || {}

    if (!action || !engagement_id || !agency_id) {
      return NextResponse.json({ error: 'Missing action, engagement_id, or agency_id' }, { status: 400 })
    }

    const sb = getSupabase()

    // Load engagement (both actions need it).
    const { data: eng } = await sb
      .from('koto_discovery_engagements')
      .select('id, client_id, client_name, client_industry, sections')
      .eq('id', engagement_id)
      .eq('agency_id', agency_id)
      .maybeSingle()

    if (!eng) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
    }

    const sections: any[] = Array.isArray(eng.sections) ? eng.sections : []

    // ─────────────────────────────────────────────────────────
    // Action 1: extract_fields
    // ─────────────────────────────────────────────────────────
    if (action === 'extract_fields') {
      const transcriptChunk: string = typeof body.transcript_chunk === 'string' ? body.transcript_chunk.trim() : ''
      const fullTranscript: string = typeof body.full_transcript === 'string' ? body.full_transcript.slice(-2000) : ''
      const alreadyPopulated: Set<string> = new Set(Array.isArray(body.already_populated) ? body.already_populated : [])
      const currentSectionId: string | null = typeof body.current_section_id === 'string' ? body.current_section_id : null

      if (!transcriptChunk || !isLikelyMeaningful(transcriptChunk)) {
        return NextResponse.json({ extractions: [] })
      }

      // Build the list of open fields. Prioritize the currently visible
      // section so Claude sees the most relevant options first.
      type OpenField = { section_id: string; field_id: string; question: string; hint?: string }
      const openFields: OpenField[] = []

      const pushSectionFields = (sec: any) => {
        if (!sec || sec.visible === false) return
        for (const f of (sec.fields || [])) {
          if (f.never_share) continue
          if (alreadyPopulated.has(f.id)) continue
          const existingAnswer = typeof f.answer === 'string' ? f.answer.trim() : ''
          if (existingAnswer.length > 3) continue
          openFields.push({
            section_id: sec.id,
            field_id: f.id,
            question: String(f.question || ''),
            hint: f.hint ? String(f.hint) : undefined,
          })
        }
      }

      if (currentSectionId) {
        const current = sections.find((s) => s.id === currentSectionId)
        if (current) pushSectionFields(current)
      }
      for (const sec of sections) {
        if (sec.id === currentSectionId) continue
        pushSectionFields(sec)
      }

      if (openFields.length === 0) {
        return NextResponse.json({ extractions: [] })
      }

      const topFields = openFields.slice(0, 15)

      const systemPrompt = `You are extracting structured discovery answers from a live sales-call transcript in real time. You will be shown ONE new sentence the client just said plus a short rolling context and a list of open fields that still need answers. Most sentences will NOT answer any field — in that case return an empty array. Only extract when the sentence clearly, unambiguously answers a field. Never guess. Never fabricate. Return JSON only, no preamble, no markdown fences.`

      const userPrompt = `Client: ${eng.client_name || 'Unknown'}
Industry: ${eng.client_industry || 'Unknown'}

Rolling context (last ~2000 chars of transcript):
${fullTranscript || '(no context yet)'}

New sentence the client just said:
"${transcriptChunk}"

Open fields to check (answer any that this sentence clearly addresses):
${topFields.map((f) => `- ${f.section_id}/${f.field_id}: ${f.question}${f.hint ? ` (hint: ${f.hint})` : ''}`).join('\n')}

Return JSON with this exact shape:
{
  "extractions": [
    {
      "section_id": "section_06",
      "field_id": "06a",
      "answer": "short concrete answer extracted from the sentence",
      "confidence": 85
    }
  ]
}

Rules:
- Only extract when confidence >= 75.
- The answer must be grounded in the sentence the client just said. Do not hallucinate details that weren't spoken.
- Keep answers short and factual (1-3 sentences max).
- If the sentence doesn't clearly answer anything, return { "extractions": [] }.
- Only reference field_ids from the list above.`

      const text = await callClaude({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 400,
        timeoutMs: 5000,
      })
      const parsed = parseJsonSafe(text || '')

      const extractions: any[] = Array.isArray(parsed?.extractions) ? parsed.extractions : []

      // Server-side confidence guard + shape normalization
      const cleaned = extractions
        .filter((e) => e && typeof e === 'object')
        .filter((e) => typeof e.field_id === 'string' && typeof e.section_id === 'string')
        .filter((e) => typeof e.answer === 'string' && e.answer.trim().length > 2)
        .filter((e) => !alreadyPopulated.has(e.field_id))
        .filter((e) => {
          const conf = typeof e.confidence === 'number' ? e.confidence : 0
          return conf >= 75
        })
        .map((e) => ({
          section_id: e.section_id,
          field_id: e.field_id,
          answer: String(e.answer).trim(),
          confidence: Math.min(100, Math.round(e.confidence || 0)),
        }))

      return NextResponse.json({ extractions: cleaned })
    }

    // ─────────────────────────────────────────────────────────
    // Action 2: live_coach_hint
    // ─────────────────────────────────────────────────────────
    if (action === 'live_coach_hint') {
      const transcriptChunk: string = typeof body.transcript_chunk === 'string' ? body.transcript_chunk.trim() : ''
      const currentSectionId: string | null = typeof body.current_section_id === 'string' ? body.current_section_id : null
      const filledContext: string = typeof body.filled_context === 'string' ? body.filled_context.slice(0, 1200) : ''

      if (!transcriptChunk || !isLikelyMeaningful(transcriptChunk)) {
        return NextResponse.json({ hint: null })
      }

      const currentSection = currentSectionId ? sections.find((s) => s.id === currentSectionId) : null

      const systemPrompt = `You are a senior marketing strategist listening in on a live discovery call. You give ONE short, actionable coaching hint to the agency user based on what the client just said. Hints must be specific to what you heard — never generic. If the client's sentence doesn't suggest a high-value follow-up, return null. Never re-ask about something that's already been captured. Return JSON only, no preamble.`

      const userPrompt = `Client: ${eng.client_name || 'Unknown'}
Industry: ${eng.client_industry || 'Unknown'}

${currentSection ? `The agency user is currently in section: ${currentSection.title}${currentSection.subtitle ? ' — ' + currentSection.subtitle : ''}` : ''}

${filledContext ? `Already captured in the doc (do NOT ask about these again):\n${filledContext}` : ''}

The client just said:
"${transcriptChunk}"

Return JSON with this exact shape:
{
  "hint": "One-sentence tactical follow-up question or tip — or null if nothing worth saying",
  "triggered_by": "A 2-6 word echo of the phrase that triggered this hint (for UI display)"
}

Rules:
- hint: max ~140 characters, written as a direct instruction to the agency user (e.g. "Ask about their follow-up SLA — they mentioned 'eventually'").
- Only fire when the client said something strategically important. Most sentences don't warrant a hint — return null in those cases.
- Never ask about things already in the "Already captured" list above.`

      const text = await callClaude({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 150,
        timeoutMs: 4000,
      })
      const parsed = parseJsonSafe(text || '')

      if (!parsed || typeof parsed !== 'object') {
        return NextResponse.json({ hint: null })
      }

      const hint = typeof parsed.hint === 'string' && parsed.hint.trim().length > 5
        ? parsed.hint.trim()
        : null

      const triggeredBy = typeof parsed.triggered_by === 'string' && parsed.triggered_by.trim()
        ? parsed.triggered_by.trim().slice(0, 80)
        : transcriptChunk.slice(0, 50)

      return NextResponse.json({
        hint,
        triggered_by: hint ? triggeredBy : null,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

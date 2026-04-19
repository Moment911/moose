// Scout persona rebuild cron.
//
// For each opportunity with activity since its last persona rebuild (or
// no persona yet), reads the recent activity stream and asks Claude Haiku
// to synthesize a buyer persona. Updates koto_opportunities.persona_json.
//
// Runs nightly via vercel.json. Can also be invoked ad-hoc with
//   Authorization: Bearer $CRON_SECRET
// and ?limit=N to cap per-run batch size (default 50).
//
// Non-throwing per-opp — one bad record should never stop the batch.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MODEL = 'claude-haiku-4-5-20251001'
const ACTIVITY_WINDOW = 25
const DEFAULT_LIMIT = 50

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

interface PersonaSynth {
  summary?: string
  role?: string
  buying_stage?: string
  pain_points?: string[]
  objections?: string[]
  preferred_channels?: string[]
  best_contact_time?: string
  communication_style?: string
  signals?: string[]
  next_best_action?: string
}

const SYSTEM_PROMPT = `You are analyzing a sales opportunity's touch history to build a concise, pragmatic buyer persona for a sales rep.

Read the recent activity stream (calls, emails, proposals, meetings, invoices, SMS, signals) and return a JSON object capturing what the rep should know before their next touch. Be concrete. If the evidence doesn't support a field, omit it — do not guess.

Return ONLY a JSON object with these keys (all optional):
{
  "summary": "1-2 sentence overview of who this person is in the sales process",
  "role": "one of: Decision-maker | Influencer | Researcher | Gatekeeper | Unknown",
  "buying_stage": "one of: Awareness | Consideration | Decision | Post-purchase | Stalled",
  "pain_points": ["concrete issues mentioned or implied"],
  "objections": ["concerns raised on calls or in replies"],
  "preferred_channels": ["email", "call", "sms"],
  "best_contact_time": "specific window if pattern visible, else omit",
  "communication_style": "short phrase like 'direct and technical' or 'price-sensitive'",
  "signals": ["specific concrete signals — e.g. 'opened proposal 3 times in 24h'"],
  "next_best_action": "one-sentence recommendation for the rep"
}

No prose, no markdown fences, no prefix — JSON only.`

function buildUserPrompt(
  opp: any,
  activities: any[],
  documents: any[],
): string {
  const ident = [
    opp.company_name && `Company: ${opp.company_name}`,
    opp.contact_name && `Contact: ${opp.contact_name}`,
    opp.industry && `Industry: ${opp.industry}`,
    opp.stage && `Stage: ${opp.stage}`,
    opp.deal_value && `Deal value: $${opp.deal_value}`,
    opp.pain_point && `Known pain: ${opp.pain_point}`,
    opp.objection && `Known objection: ${opp.objection}`,
  ].filter(Boolean).join('\n')

  const timeline = activities.map((a: any) => {
    const when = new Date(a.created_at).toISOString().slice(0, 16)
    const parts: string[] = [`[${when}] ${a.activity_type}`]
    if (a.description) parts.push(`— ${String(a.description).slice(0, 200)}`)
    if (a.metadata && typeof a.metadata === 'object') {
      const m = a.metadata
      if (m.sentiment) parts.push(`sentiment=${m.sentiment}`)
      if (m.duration_seconds) parts.push(`duration=${m.duration_seconds}s`)
      if (m.stage_reached) parts.push(`reached=${m.stage_reached}`)
      if (m.device) parts.push(`device=${m.device}`)
      if (m.forward_company) parts.push(`forwarded-to=${m.forward_company}`)
    }
    return parts.join(' ')
  }).join('\n')

  const docLines = documents.length
    ? '\n\nDocuments:\n' + documents.map((d: any) =>
        `- ${d.document_type} ${d.status}${d.total_value ? ` ($${d.total_value})` : ''}${d.title ? ` — ${d.title}` : ''}`
      ).join('\n')
    : ''

  return `${ident}\n\nActivity timeline (most recent last):\n${timeline}${docLines}`
}

async function rebuildOne(
  s: ReturnType<typeof sb>,
  ai: Anthropic,
  opp: any,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Fetch recent activities + documents in parallel
  const [actsRes, docsRes] = await Promise.all([
    s.from('koto_opportunity_activities')
      .select('activity_type, description, metadata, created_at')
      .eq('opportunity_id', opp.id)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_WINDOW),
    s.from('koto_opportunity_documents')
      .select('document_type, status, title, total_value')
      .eq('opportunity_id', opp.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const activities = (actsRes.data || []).reverse()
  if (activities.length === 0) {
    return { ok: true } // nothing to synthesize yet
  }

  const userPrompt = buildUserPrompt(opp, activities, docsRes.data || [])

  let persona: PersonaSynth = {}
  let inputTokens = 0
  let outputTokens = 0
  try {
    const resp = await ai.messages.create({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    inputTokens = resp.usage?.input_tokens || 0
    outputTokens = resp.usage?.output_tokens || 0

    const text = resp.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    persona = JSON.parse(text) as PersonaSynth
  } catch (e: any) {
    return { ok: false, error: `claude: ${e?.message || 'unknown'}` }
  }

  // Attach metadata to the persona blob so we can tell when it was last rebuilt
  const enriched: Record<string, any> = {
    ...persona,
    rebuilt_at: new Date().toISOString(),
    activity_count_analyzed: activities.length,
    model: MODEL,
  }

  // Update the opportunity
  try {
    await s
      .from('koto_opportunities')
      .update({ persona_json: enriched })
      .eq('id', opp.id)
  } catch (e: any) {
    return { ok: false, error: `update: ${e?.message || 'unknown'}` }
  }

  // Log token usage (fire and forget — never block)
  logTokenUsage({
    feature: 'scout_persona_rebuild',
    model: MODEL,
    inputTokens,
    outputTokens,
    agencyId: opp.agency_id,
    metadata: { opportunity_id: opp.id, activities: activities.length },
  }).catch(() => {})

  return { ok: true }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '', 10) || DEFAULT_LIMIT, 1),
    200,
  )

  const s = sb()
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Pick candidates: opportunities whose last_touch_at is newer than their
  // persona_json.rebuilt_at (or persona not yet set). Cheap SQL filter; we
  // refine in JS since jsonb path comparison varies by Postgres version.
  const { data: candidates, error } = await s
    .from('koto_opportunities')
    .select('id, agency_id, company_name, contact_name, industry, stage, deal_value, pain_point, objection, persona_json, last_touch_at')
    .not('last_touch_at', 'is', null)
    .order('last_touch_at', { ascending: false })
    .limit(limit * 3) // overfetch; we filter below

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const needsRebuild = (candidates || []).filter((o: any) => {
    const rebuiltAt: string | undefined = o?.persona_json?.rebuilt_at
    if (!rebuiltAt) return true
    if (!o.last_touch_at) return false
    return new Date(o.last_touch_at).getTime() > new Date(rebuiltAt).getTime()
  }).slice(0, limit)

  let updated = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const opp of needsRebuild) {
    const res = await rebuildOne(s, ai, opp)
    if (res.ok) updated += 1
    else errors.push({ id: opp.id, error: res.error })
  }

  return NextResponse.json({
    scanned: (candidates || []).length,
    candidates: needsRebuild.length,
    updated,
    errors,
  })
}

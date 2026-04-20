// Scout seller-site scanner.
//
// POST { agency_id, agent_id?, url, seller_industry_slug? }
//
// Pipeline:
//   1. Crawl — homepage + up to 7 prioritized internal pages
//   2. Extract — Claude Sonnet pulls structured seller profile
//   3. Generate — Claude Sonnet produces 40-60 discovery questions
//      tagged with services_qualified + stage, using prospect vocabulary
//   4. Save — scout_seller_profiles row, a new scout_question_banks row
//      ('scan:<host>:<YYYY-MM-DD>'), and all questions linked to it
//   5. Return summary { profile_id, bank_id, services, question_count }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { crawlSellerSite } from '@/lib/scout/scanner/crawl'
import { logTokenUsage } from '@/lib/tokenTracker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MODEL_EXTRACT = 'claude-sonnet-4-5-20250929'
const MODEL_GENERATE = 'claude-sonnet-4-5-20250929'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

async function claudeJson(model: string, system: string, user: string, maxTokens = 4000): Promise<{ data: any; tokensIn: number; tokensOut: number }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.25,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    throw new Error(`Claude ${resp.status} ${t.slice(0, 200)}`)
  }
  const body: any = await resp.json()
  const text: string = body?.content?.[0]?.text || '[]'
  const cleaned = text.replace(/```json|```/g, '').trim()
  const data = JSON.parse(cleaned)
  return { data, tokensIn: body?.usage?.input_tokens || 0, tokensOut: body?.usage?.output_tokens || 0 }
}

const EXTRACT_SYSTEM = `You analyze a B2B marketing/agency website and extract a structured seller profile used to generate cold-call discovery questions.

Return JSON with this exact shape (no prose, no markdown):
{
  "services": [{ "name": "...", "slug": "...", "category": "traffic|conversion|brand|tech_data|content|other", "description": "..." }],
  "positioning": ["taglines, hero copy, differentiators"],
  "proof_points": ["numbers, stats, outcomes — e.g. '340% avg lead lift', '$73M paid media managed'"],
  "target_customer": "one-sentence description of who they sell to",
  "target_signals": { "size": "SMB|mid-market|enterprise|mixed", "industries_called_out": [], "geographic_markers": [] },
  "process_phases": ["Audit", "Strategy", "Launch", "Optimize"],
  "lead_magnets": ["free audit, assessment, consultation, downloadable report, ..."],
  "vocabulary": ["10-20 distinctive repeated words or phrases from the seller's voice"]
}

Rules:
- services: capture EVERY distinct service, no lumping. If the site lists SEO, Paid Media, Social, Content, and AI/CRM separately, return 5 entries — not one "digital marketing".
- vocabulary: include the seller's signature words even if weird (e.g., "momenta", "compounding force", "velocity")
- proof_points: only include specifics with numbers or concrete claims
- If a field isn't evident from the text, return an empty array or empty string — don't guess`

const GENERATE_SYSTEM = `You generate cold-call discovery questions for a sales agent representing the seller whose profile you are given.

Return JSON with this exact shape (no prose, no markdown):
{
  "questions": [
    {
      "stage": "opener|current_state|pain|decision|budget|timeline|competition|proof|closer",
      "text": "the actual question the agent will ask, phrased in the PROSPECT's everyday language",
      "services_qualified": ["slug_of_each_service_this_question_probes_for", "or 'all'"],
      "priority": 1
    },
    ...
  ]
}

Hard rules:
- Generate 40-60 questions total, distributed across stages (opener 4-6, current_state 7-10, pain 8-12, decision 4-6, budget 4-6, timeline 3-5, competition 3-5, proof 3-5, closer 4-6).
- Use the PROSPECT's vocabulary, NOT the seller's. If the seller uses jargon like "momenta" or "compounding force", translate it to plain language ("getting more leads every month instead of starting from zero").
- Each question must map to at least one specific service the seller offers (services_qualified). Only use 'all' for universal openers/closers/budget/timeline.
- Questions should surface pain the seller can solve — make them concrete, open-ended, answerable in one sentence.
- Use {{company_name}}, {{prospect_name}}, {{agent_name}}, {{seller_name}}, {{industry}} as placeholder variables where it reads naturally.
- Do not repeat the seller's proof points in questions — those are for the pitch phase, not discovery.
- priority: 1 for high-leverage (should be tried first), 2 for supporting, 3 for niche.`

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { agency_id, agent_id, url, seller_industry_slug } = body
  if (!agency_id || !url) {
    return NextResponse.json({ error: 'agency_id and url required' }, { status: 400 })
  }

  const s = sb()

  // ── Stage 1: Crawl ──────────────────────────────────────────────
  let crawl
  try {
    crawl = await crawlSellerSite(String(url))
  } catch (e: any) {
    return NextResponse.json({ error: `Crawl failed: ${e?.message || 'unknown'}` }, { status: 422 })
  }
  if (crawl.pages.length === 0 || crawl.total_chars < 300) {
    return NextResponse.json({ error: 'No extractable content found at that URL' }, { status: 422 })
  }

  // Build the combined text corpus for Claude
  const corpus = crawl.pages
    .map((p) => `===== ${p.url} =====\n${p.title ? `TITLE: ${p.title}\n` : ''}${p.text}`)
    .join('\n\n')
    .slice(0, 80_000)

  // ── Stage 2: Extract ────────────────────────────────────────────
  let extract
  try {
    extract = await claudeJson(MODEL_EXTRACT, EXTRACT_SYSTEM, corpus, 3500)
  } catch (e: any) {
    return NextResponse.json({ error: `Extract failed: ${e?.message || 'unknown'}` }, { status: 500 })
  }
  const profile = extract.data || {}

  // ── Stage 3: Generate questions ────────────────────────────────
  const genPrompt =
    `Seller profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
    `Seller industry: ${seller_industry_slug || 'unknown'}\n` +
    `Source URL: ${url}\n\n` +
    `Produce the question bank now.`

  let generated
  try {
    generated = await claudeJson(MODEL_GENERATE, GENERATE_SYSTEM, genPrompt, 7000)
  } catch (e: any) {
    return NextResponse.json({ error: `Generate failed: ${e?.message || 'unknown'}` }, { status: 500 })
  }
  const questions: any[] = Array.isArray(generated.data?.questions) ? generated.data.questions : []
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Generator returned no questions' }, { status: 500 })
  }

  // Log token usage (fire and forget)
  logTokenUsage({
    feature: 'scout_scanner_extract',
    model: MODEL_EXTRACT,
    inputTokens: extract.tokensIn,
    outputTokens: extract.tokensOut,
    agencyId: agency_id,
    metadata: { url, pages_crawled: crawl.pages.length },
  }).catch(() => {})
  logTokenUsage({
    feature: 'scout_scanner_generate',
    model: MODEL_GENERATE,
    inputTokens: generated.tokensIn,
    outputTokens: generated.tokensOut,
    agencyId: agency_id,
    metadata: { url, question_count: questions.length },
  }).catch(() => {})

  // ── Stage 4: Save ──────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const bankSource = `scan:${crawl.host}:${today}`

  // Seller profile row
  const { data: profileRow, error: profileErr } = await s.from('scout_seller_profiles').insert({
    agency_id,
    agent_id: agent_id || null,
    url,
    host: crawl.host,
    seller_industry_slug: seller_industry_slug || null,
    services: profile.services || [],
    positioning: profile.positioning || [],
    proof_points: profile.proof_points || [],
    target_customer: profile.target_customer || null,
    target_signals: profile.target_signals || {},
    process_phases: profile.process_phases || [],
    lead_magnets: profile.lead_magnets || [],
    vocabulary: profile.vocabulary || [],
    pages_crawled: crawl.pages.length,
    crawl_duration_ms: crawl.duration_ms,
    extract_tokens_in: extract.tokensIn,
    extract_tokens_out: extract.tokensOut,
    raw_extract: profile,
  }).select('id').single()
  if (profileErr || !profileRow) {
    return NextResponse.json({ error: `Save profile failed: ${profileErr?.message || 'unknown'}` }, { status: 500 })
  }

  // Question bank row
  const bankName = `${crawl.host} — scanned ${today}`
  const { data: bankRow, error: bankErr } = await s.from('scout_question_banks').insert({
    agency_id,
    agent_id: agent_id || null,
    seller_industry_slug: seller_industry_slug || null,
    seller_profile_id: profileRow.id,
    name: bankName,
    source: bankSource,
    status: 'exploration',
    question_count: questions.length,
  }).select('id').single()
  if (bankErr || !bankRow) {
    return NextResponse.json({ error: `Save bank failed: ${bankErr?.message || 'unknown'}` }, { status: 500 })
  }

  // Question rows
  const qRows = questions
    .filter((q: any) => typeof q?.text === 'string' && q.text.length > 10)
    .map((q: any) => ({
      agency_id,
      bank_id: bankRow.id,
      stage: String(q.stage || 'current_state').toLowerCase(),
      question_text: String(q.text).slice(0, 800),
      question_type: String(q.stage || 'discovery').toLowerCase(),
      services_qualified: Array.isArray(q.services_qualified) ? q.services_qualified.slice(0, 10) : ['all'],
      exploration_status: 'exploration',
      source: bankSource,
      direction: 'outbound_only',
      source_system: 'scan',
      priority: Math.min(Math.max(Number(q.priority) || 2, 1), 5),
    }))

  if (qRows.length > 0) {
    const { error: qErr } = await s.from('scout_questions').insert(qRows)
    if (qErr) {
      return NextResponse.json({ error: `Save questions failed: ${qErr.message}`, bank_id: bankRow.id }, { status: 500 })
    }
  }

  // Activate the new bank on the agent (if agent_id given)
  if (agent_id) {
    await s.from('scout_voice_agents').update({
      active_bank_id: bankRow.id,
      seller_website_url: url,
      bank_mode: 'custom',
    }).eq('id', agent_id)
  }

  return NextResponse.json({
    profile_id: profileRow.id,
    bank_id: bankRow.id,
    bank_source: bankSource,
    host: crawl.host,
    services_count: Array.isArray(profile.services) ? profile.services.length : 0,
    services: profile.services || [],
    vocabulary: profile.vocabulary || [],
    question_count: qRows.length,
    pages_crawled: crawl.pages.length,
    crawl_duration_ms: crawl.duration_ms,
  })
}

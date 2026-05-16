// ─────────────────────────────────────────────────────────────
// Newsletter Intel Engine — Phase G
//
// One unique alias per competitor brand. Resend inbound webhook
// or manual paste-import delivers emails. Claude Haiku classifies
// journey stage (welcome | promo | nurture | cart_abandon |
// win_back | announcement | digest | other), emotion, and CTAs.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import * as cheerio from 'cheerio'
import { logTokenUsage } from '@/lib/tokenTracker'

const MODEL = 'claude-haiku-4-5-20251001'
const CLASSIFIER_TIMEOUT = 12_000
const CLASSIFIER_MAX = 400

// Inbound domain — change to your Resend-configured inbound domain.
// Falls back to a hellokoto-inbound.com placeholder until configured.
const INBOUND_DOMAIN = process.env.KOTO_INBOUND_DOMAIN || 'inbound.hellokoto.com'

export interface ParsedEmail {
  from_address: string
  from_name?: string
  subject: string
  body_html?: string
  body_text?: string
  links: { url: string; anchor: string }[]
  cta_texts: { text: string; url: string }[]
  preview_text: string
}

// ─────────────────────────────────────────────────────────────
// 1. Alias management
// ─────────────────────────────────────────────────────────────
export async function createEmailAlias(
  s: SupabaseClient,
  body: { client_id: string; brand_name: string; notes?: string },
): Promise<{ alias: any; subscribe_to: string }> {
  const { client_id, brand_name, notes } = body
  if (!client_id || !brand_name) throw new Error('client_id and brand_name required')

  // Generate a unique email address. Pattern: intel-{8 random hex}@inbound-domain
  const hash = randomBytes(4).toString('hex')
  const alias_email = `intel-${hash}@${INBOUND_DOMAIN}`

  const { data, error } = await s.from('kotoiq_competitor_email_aliases')
    .insert({ client_id, brand_name, alias_email, notes: notes || null })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { alias: data, subscribe_to: alias_email }
}

export async function listEmailAliases(s: SupabaseClient, body: { client_id: string }) {
  if (!body.client_id) throw new Error('client_id required')
  const { data, error } = await s.from('kotoiq_competitor_email_aliases')
    .select('*')
    .eq('client_id', body.client_id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return { aliases: data || [] }
}

export async function deleteEmailAlias(s: SupabaseClient, body: { id: string }) {
  if (!body.id) throw new Error('id required')
  const { error } = await s.from('kotoiq_competitor_email_aliases').update({ is_active: false }).eq('id', body.id)
  if (error) throw new Error(error.message)
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────
// 2. Email parsing (HTML → structured)
// ─────────────────────────────────────────────────────────────
export function parseEmailHtml(html: string, from_address?: string, subject?: string): ParsedEmail {
  if (!html) {
    return {
      from_address: from_address || '',
      subject: subject || '',
      body_html: '',
      body_text: '',
      links: [],
      cta_texts: [],
      preview_text: '',
    }
  }

  const $ = cheerio.load(html)
  $('style, script, head').remove()

  const body_text = ($('body').text() || $.text()).replace(/\s+/g, ' ').trim()
  const preview_text = body_text.slice(0, 200)

  const links: { url: string; anchor: string }[] = []
  const cta_texts: { text: string; url: string }[] = []

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim()
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return
    const anchor = $(el).text().replace(/\s+/g, ' ').trim()
    if (!anchor) return

    const isButton = !!($(el).attr('class')?.match(/btn|button|cta/i)
      || $(el).find('button, [class*=btn], [class*=button]').length
      || $(el).parents('table').first().attr('class')?.match(/btn|button/i))

    const item = { text: anchor.slice(0, 100), url: href.slice(0, 500) }
    if (links.length < 50) links.push({ url: item.url, anchor: item.text })
    if ((isButton || anchor.length <= 30) && cta_texts.length < 8) {
      cta_texts.push(item)
    }
  })

  return {
    from_address: from_address || '',
    subject: subject || '',
    body_html: html.slice(0, 200_000),
    body_text: body_text.slice(0, 20_000),
    links,
    cta_texts,
    preview_text,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Claude Haiku classifier
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You classify competitor marketing emails for intelligence purposes.

Given the from address, subject line, and a body excerpt, return STRICT JSON only:

{
  "journey_stage": "welcome" | "promo" | "nurture" | "cart_abandon" | "win_back" | "announcement" | "digest" | "other",
  "emotion": "urgent" | "informational" | "playful" | "exclusive" | "other",
  "promo_detected": "free shipping" | "20% off" | "<short string>" | null
}

Rules:
- promo: discount, sale, free trial, free shipping, BOGO, limited time
- announcement: new product/feature launch, company news
- digest: weekly/monthly roundup, "this week in"
- nurture: educational tips, how-to content
- welcome: new subscriber onboarding
- cart_abandon: "you left something behind", "complete your order"
- win_back: "we miss you", "come back"
- other: anything that doesn't fit

Be conservative — only mark promo when there's a clear offer. Emotion gauges tone; promo_detected captures the literal offer string if present.

No prose, no markdown.`

export async function classifyEmail(
  parsed: ParsedEmail,
  ctx: { brand_name: string; clientId?: string; agencyId?: string | null } = { brand_name: '' },
): Promise<{
  journey_stage: string
  emotion: string
  promo_detected: string | null
  cost_usd: number
  error?: string
}> {
  const fallback = { journey_stage: 'other', emotion: 'other', promo_detected: null, cost_usd: 0, error: '' }
  if (!process.env.ANTHROPIC_API_KEY) return { ...fallback, error: 'no_api_key' }

  const user = [
    `Brand: ${ctx.brand_name}`,
    `From: ${parsed.from_address}`,
    `Subject: ${parsed.subject}`,
    `Preview: ${parsed.preview_text}`,
    `Body excerpt: ${(parsed.body_text || '').slice(0, 1500)}`,
  ].join('\n')

  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), CLASSIFIER_TIMEOUT)
    let msg
    try {
      msg = await ai.messages.create({
        model: MODEL,
        max_tokens: CLASSIFIER_MAX,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: user }],
      })
    } finally {
      clearTimeout(t)
    }

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const inT = msg.usage?.input_tokens || 0
    const outT = msg.usage?.output_tokens || 0
    const cost_usd = (inT / 1_000_000) * 1.0 + (outT / 1_000_000) * 5.0

    void logTokenUsage({
      feature: 'newsletter_intel_classifier',
      model: MODEL,
      inputTokens: inT,
      outputTokens: outT,
      agencyId: ctx.agencyId || null,
      metadata: { brand: ctx.brand_name, client_id: ctx.clientId },
    })

    const parsed_json = safeJson(raw)
    if (!parsed_json) return { ...fallback, cost_usd, error: 'parse_failed' }

    const validStages = ['welcome', 'promo', 'nurture', 'cart_abandon', 'win_back', 'announcement', 'digest', 'other']
    const validEmotions = ['urgent', 'informational', 'playful', 'exclusive', 'other']

    return {
      journey_stage: validStages.includes(parsed_json.journey_stage) ? parsed_json.journey_stage : 'other',
      emotion: validEmotions.includes(parsed_json.emotion) ? parsed_json.emotion : 'other',
      promo_detected: parsed_json.promo_detected ? String(parsed_json.promo_detected).slice(0, 200) : null,
      cost_usd,
    }
  } catch (e: any) {
    return { ...fallback, error: e?.message || String(e) }
  }
}

function safeJson(raw: string): any | null {
  if (!raw) return null
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

// ─────────────────────────────────────────────────────────────
// 4. Persist an email (used by webhook + manual paste)
// ─────────────────────────────────────────────────────────────
export async function persistCompetitorEmail(
  s: SupabaseClient,
  body: {
    client_id: string
    brand_name: string
    alias_id?: string | null
    from_address: string
    from_name?: string
    subject: string
    body_html?: string
    body_text?: string
    sent_at?: string
    source?: 'webhook' | 'manual_paste'
    agency_id?: string | null
  },
): Promise<{ id: string; classification: any }> {
  const html = body.body_html || ''
  const parsed = html
    ? parseEmailHtml(html, body.from_address, body.subject)
    : {
        from_address: body.from_address,
        subject: body.subject,
        body_html: '',
        body_text: (body.body_text || '').slice(0, 20_000),
        preview_text: (body.body_text || '').slice(0, 200),
        links: [],
        cta_texts: [],
      } as ParsedEmail

  const classified = await classifyEmail(parsed, {
    brand_name: body.brand_name,
    clientId: body.client_id,
    agencyId: body.agency_id,
  })

  const { data, error } = await s.from('kotoiq_competitor_emails').insert({
    client_id: body.client_id,
    alias_id: body.alias_id || null,
    brand_name: body.brand_name,
    from_address: body.from_address,
    from_name: body.from_name || null,
    subject: body.subject || null,
    preview_text: parsed.preview_text,
    body_html: parsed.body_html || null,
    body_text: parsed.body_text || null,
    links: parsed.links,
    cta_texts: parsed.cta_texts,
    journey_stage: classified.journey_stage,
    emotion: classified.emotion,
    promo_detected: classified.promo_detected,
    sent_at: body.sent_at || new Date().toISOString(),
    ingestion_source: body.source || 'webhook',
    classifier_cost_usd: classified.cost_usd,
  }).select('id').single()

  if (error) throw new Error(error.message)
  return { id: data.id, classification: classified }
}

// ─────────────────────────────────────────────────────────────
// 5. Read APIs
// ─────────────────────────────────────────────────────────────
export async function listCompetitorEmails(
  s: SupabaseClient,
  body: { client_id: string; brand_name?: string; journey_stage?: string; limit?: number },
) {
  const { client_id, brand_name, journey_stage, limit = 50 } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_competitor_emails')
    .select('id, brand_name, from_address, from_name, subject, preview_text, cta_texts, journey_stage, emotion, promo_detected, sent_at, received_at, ingestion_source')
    .eq('client_id', client_id)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (brand_name) q = q.eq('brand_name', brand_name)
  if (journey_stage) q = q.eq('journey_stage', journey_stage)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { emails: data || [] }
}

export async function getNewsletterOverview(s: SupabaseClient, body: { client_id: string }) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data: emails } = await s.from('kotoiq_competitor_emails')
    .select('brand_name, journey_stage, promo_detected, received_at')
    .eq('client_id', client_id)

  const rows = emails || []
  const brands = new Set<string>()
  const stages: Record<string, number> = {}
  let promos = 0
  let recent7 = 0
  for (const r of rows) {
    brands.add(r.brand_name)
    if (r.journey_stage) stages[r.journey_stage] = (stages[r.journey_stage] || 0) + 1
    if (r.promo_detected) promos += 1
    if (Date.now() - new Date(r.received_at).getTime() < 7 * 86400000) recent7 += 1
  }

  return {
    total_emails: rows.length,
    brands_tracked: brands.size,
    journey_stages: stages,
    promos_detected: promos,
    received_7d: recent7,
  }
}

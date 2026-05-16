// ─────────────────────────────────────────────────────────────
// AEO Visibility Engine — KotoIQ Phase A
//
// Continuous tracking of how each client's brand and competitors
// appear in answers from ChatGPT, Claude, Gemini, Perplexity,
// and Google AI Overviews.
//
// Public API:
//   - setupClientForAEO    — initial seed + add self as competitor
//   - runAEOVisibilityScan — run all prompts × 5 engines, persist
//   - getShareOfVoice      — aggregate Share of Voice over time
//   - getPromptMatrix      — engine × prompt presence grid
//   - getCitedSources      — which client URLs got cited
//   - getCompetitorCompare — head-to-head vs each tracked competitor
//   - getOverviewStats     — 4 KPI cards (SoV, prompts, engines, velocity)
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runChatGPT } from './aeoEngines/chatgpt'
import { runClaude } from './aeoEngines/claude'
import { runGemini } from './aeoEngines/gemini'
import { runPerplexity } from './aeoEngines/perplexity'
import { runGoogleAIO } from './aeoEngines/googleAio'
import type { AeoEngineKey, AeoEngineResponse } from './aeoEngines/types'
import { parseMentions, type TrackedBrand } from './aeoMentionParser'
import { seedPromptsForClient, type ClientSeedContext } from './aeoPromptSeeder'

export const ALL_ENGINES: AeoEngineKey[] = ['chatgpt', 'claude', 'gemini', 'perplexity', 'google_aio']

// ─────────────────────────────────────────────────────────────
// 1. Setup a client for AEO tracking
// Creates: self-as-competitor row + 40 seeded prompts (optional)
// ─────────────────────────────────────────────────────────────
export async function setupClientForAEO(
  s: SupabaseClient,
  body: {
    client_id: string
    agency_id?: string | null
    seed_prompts?: boolean        // default true
    seed_self_competitor?: boolean // default true
  },
): Promise<{
  prompts_seeded: number
  self_added: boolean
  cost_usd: number
  errors: string[]
}> {
  const { client_id, agency_id, seed_prompts = true, seed_self_competitor = true } = body
  if (!client_id) throw new Error('client_id required')

  const errors: string[] = []
  let cost_usd = 0
  let prompts_seeded = 0
  let self_added = false

  // Load client profile
  const { data: client } = await s.from('clients').select('*').eq('id', client_id).single()
  if (!client) throw new Error(`client ${client_id} not found`)

  const ctx: ClientSeedContext = {
    business_name: client.business_name || client.name,
    industry: client.industry || client.primary_service,
    primary_service: client.primary_service,
    target_customer: client.target_customer,
    marketing_budget: client.marketing_budget,
    unique_selling_prop: client.unique_selling_prop,
    city: client.city,
    state: client.state,
    service_area: client.service_area,
    website: client.website,
  }

  // 1a. Self as competitor — so the parser tracks the client's own brand
  if (seed_self_competitor && (client.business_name || client.name)) {
    const brand_name = (client.business_name || client.name).trim()
    const domain = (client.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || null

    const { error } = await s.from('kotoiq_aeo_competitors').upsert({
      client_id,
      brand_name,
      domain,
      is_self: true,
    }, { onConflict: 'client_id,brand_name' })

    if (error) errors.push(`add self: ${error.message}`)
    else self_added = true
  }

  // 1b. Seed prompts
  if (seed_prompts) {
    const seed = await seedPromptsForClient(ctx, { agencyId: agency_id, clientId: client_id })
    cost_usd += seed.cost_usd
    if (seed.error) errors.push(`seed: ${seed.error}`)

    if (seed.prompts.length) {
      const rows = seed.prompts.map(p => ({
        client_id,
        prompt: p.prompt,
        category: p.category,
        intent: p.intent,
        created_by: 'ai_seed',
      }))
      const { error } = await s.from('kotoiq_aeo_prompts').insert(rows)
      if (error) errors.push(`insert prompts: ${error.message}`)
      else prompts_seeded = rows.length
    }
  }

  return { prompts_seeded, self_added, cost_usd, errors }
}

// ─────────────────────────────────────────────────────────────
// 2. Run a full AEO visibility scan for one client
// All active prompts × 5 engines, parsed for mentions, persisted.
// ─────────────────────────────────────────────────────────────
export async function runAEOVisibilityScan(
  s: SupabaseClient,
  body: {
    client_id: string
    agency_id?: string | null
    engines?: AeoEngineKey[]
    prompt_limit?: number
  },
): Promise<{
  prompts_run: number
  engine_calls: number
  successes: number
  failures: number
  total_cost_usd: number
  ran_at: string
}> {
  const { client_id, agency_id, engines = ALL_ENGINES, prompt_limit } = body
  if (!client_id) throw new Error('client_id required')

  // Load active prompts + tracked brands
  const promptQuery = s.from('kotoiq_aeo_prompts')
    .select('id, prompt, category')
    .eq('client_id', client_id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const { data: prompts } = prompt_limit
    ? await promptQuery.limit(prompt_limit)
    : await promptQuery

  const { data: competitorRows } = await s.from('kotoiq_aeo_competitors')
    .select('brand_name, aliases, domain, is_self')
    .eq('client_id', client_id)

  const trackedBrands: TrackedBrand[] = (competitorRows || []).map(c => ({
    brand_name: c.brand_name,
    aliases: c.aliases || [],
    domain: c.domain || undefined,
    is_self: !!c.is_self,
  }))

  if (!prompts?.length) {
    return { prompts_run: 0, engine_calls: 0, successes: 0, failures: 0, total_cost_usd: 0, ran_at: new Date().toISOString() }
  }

  const selfBrandName = trackedBrands.find(b => b.is_self)?.brand_name

  const runners: Record<AeoEngineKey, (p: string, o: any) => Promise<AeoEngineResponse>> = {
    chatgpt:    runChatGPT,
    claude:     runClaude,
    gemini:     runGemini,
    perplexity: runPerplexity,
    google_aio: runGoogleAIO,
  }

  let engine_calls = 0
  let successes = 0
  let failures = 0
  let total_cost_usd = 0
  const ran_at = new Date().toISOString()

  for (const p of prompts) {
    const results = await Promise.allSettled(
      engines.map(eng => runners[eng](p.prompt, { agencyId: agency_id, clientId: client_id, feature: 'aeo_visibility' })),
    )

    const rows: any[] = []
    for (let i = 0; i < results.length; i++) {
      const eng = engines[i]
      const settled = results[i]
      engine_calls++

      let response: AeoEngineResponse
      if (settled.status === 'fulfilled') {
        response = settled.value
      } else {
        response = {
          engine: eng,
          text: '',
          cited_urls: [],
          response_ms: 0,
          cost_usd: 0,
          error: settled.reason?.message || String(settled.reason),
        }
      }

      if (response.error) failures++
      else successes++

      total_cost_usd += response.cost_usd || 0

      // Parse mentions only when we have text
      let mentions: any[] = []
      let cited_urls = response.cited_urls
      let parser_cost = 0

      if (response.text && trackedBrands.length) {
        const parsed = await parseMentions(response, trackedBrands, { agencyId: agency_id, clientId: client_id })
        mentions = parsed.brand_mentions
        cited_urls = parsed.cited_urls
        parser_cost = parsed.parser_cost_usd
        total_cost_usd += parser_cost
      }

      const selfMention = selfBrandName
        ? mentions.find(m => m.brand === selfBrandName)
        : undefined

      rows.push({
        prompt_id: p.id,
        client_id,
        engine: eng,
        raw_response: response.text || null,
        response_ms: response.response_ms || 0,
        cited_urls,
        brand_mentions: mentions,
        mention_count: mentions.length,
        client_mentioned: !!selfMention,
        client_position: selfMention?.position || null,
        error: response.error || null,
        cost_usd: (response.cost_usd || 0) + parser_cost,
        run_at: ran_at,
      })
    }

    if (rows.length) {
      const { error } = await s.from('kotoiq_aeo_runs').insert(rows)
      if (error) {
        // Don't stop the scan on a write failure — log and continue
        // eslint-disable-next-line no-console
        console.warn('[aeoVisibility] insert error', error.message)
      }
    }
  }

  return {
    prompts_run: prompts.length,
    engine_calls,
    successes,
    failures,
    total_cost_usd,
    ran_at,
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Aggregates / read APIs for the UI
// ─────────────────────────────────────────────────────────────

export interface ShareOfVoiceBucket {
  bucket_start: string   // ISO date
  total_runs: number     // engine × prompt runs in this bucket
  per_brand: Record<string, { mentions: number; share: number }>
}

/**
 * Share of Voice over time. Buckets results by week. For each week,
 * computes: per-brand mention count, divided by total mentions that
 * week, to get share. Returns last 12 buckets by default.
 */
export async function getShareOfVoice(
  s: SupabaseClient,
  body: { client_id: string; weeks?: number },
): Promise<{ buckets: ShareOfVoiceBucket[]; tracked_brands: string[] }> {
  const { client_id, weeks = 12 } = body
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: brandsRows } = await s.from('kotoiq_aeo_competitors')
    .select('brand_name, is_self')
    .eq('client_id', client_id)

  const tracked_brands = (brandsRows || []).map(b => b.brand_name)

  const { data: runs } = await s.from('kotoiq_aeo_runs')
    .select('run_at, brand_mentions')
    .eq('client_id', client_id)
    .gte('run_at', since)
    .order('run_at', { ascending: true })

  // Bucket by ISO week (start = Monday)
  const buckets: Map<string, ShareOfVoiceBucket> = new Map()
  for (const r of runs || []) {
    const wk = isoWeekStart(new Date(r.run_at))
    let bucket = buckets.get(wk)
    if (!bucket) {
      bucket = { bucket_start: wk, total_runs: 0, per_brand: {} }
      buckets.set(wk, bucket)
    }
    bucket.total_runs += 1
    for (const m of (r.brand_mentions || [])) {
      if (!m?.brand) continue
      const cell = bucket.per_brand[m.brand] || { mentions: 0, share: 0 }
      cell.mentions += 1
      bucket.per_brand[m.brand] = cell
    }
  }

  // Compute share %
  for (const b of buckets.values()) {
    const totalMentions = Object.values(b.per_brand).reduce((s, c) => s + c.mentions, 0)
    if (totalMentions === 0) continue
    for (const k of Object.keys(b.per_brand)) {
      b.per_brand[k].share = Math.round((b.per_brand[k].mentions / totalMentions) * 100)
    }
  }

  return {
    buckets: Array.from(buckets.values()).sort((a, b) => a.bucket_start.localeCompare(b.bucket_start)),
    tracked_brands,
  }
}

/**
 * Engine × prompt grid showing where the client's brand appears.
 * For each (prompt, engine) cell, returns:
 *  - mentioned: boolean
 *  - position: 1, 2, 3, ... if mentioned
 *  - sentiment: positive | neutral | negative
 * Uses the most-recent run per (prompt, engine).
 */
export async function getPromptMatrix(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{
  prompts: { id: string; prompt: string; category: string }[]
  engines: AeoEngineKey[]
  matrix: Record<string, Record<AeoEngineKey, { mentioned: boolean; position: number | null; sentiment: string | null; run_at: string }>>
}> {
  const { client_id } = body

  const { data: prompts } = await s.from('kotoiq_aeo_prompts')
    .select('id, prompt, category')
    .eq('client_id', client_id)
    .eq('is_active', true)
    .order('category', { ascending: true })

  if (!prompts?.length) {
    return { prompts: [], engines: ALL_ENGINES, matrix: {} }
  }

  // Latest run per (prompt, engine)
  const matrix: Record<string, any> = {}
  for (const p of prompts) matrix[p.id] = {}

  const { data: latestRuns } = await s.from('kotoiq_aeo_runs')
    .select('prompt_id, engine, client_mentioned, client_position, run_at, brand_mentions')
    .eq('client_id', client_id)
    .in('prompt_id', prompts.map(p => p.id))
    .order('run_at', { ascending: false })

  const seen = new Set<string>()
  for (const r of latestRuns || []) {
    const key = `${r.prompt_id}:${r.engine}`
    if (seen.has(key)) continue
    seen.add(key)
    const selfMention = (r.brand_mentions || []).find((m: any) => m?.position)
    matrix[r.prompt_id][r.engine] = {
      mentioned: !!r.client_mentioned,
      position: r.client_position,
      sentiment: selfMention?.sentiment || null,
      run_at: r.run_at,
    }
  }

  return { prompts, engines: ALL_ENGINES, matrix }
}

/**
 * Aggregate which URLs are getting cited across all engine responses
 * for this client. Useful to see "AI engines are pulling /pricing page
 * for our brand questions" — feeds page-level optimization decisions.
 */
export async function getCitedSources(
  s: SupabaseClient,
  body: { client_id: string; days?: number; limit?: number },
): Promise<{ items: { url: string; count: number; domains: string }[] }> {
  const { client_id, days = 30, limit = 50 } = body
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: runs } = await s.from('kotoiq_aeo_runs')
    .select('cited_urls')
    .eq('client_id', client_id)
    .gte('run_at', since)

  const counts = new Map<string, { count: number; domain: string }>()
  for (const r of runs || []) {
    for (const u of (r.cited_urls || [])) {
      const url = u?.url
      if (!url) continue
      const domain = safeDomain(url)
      const prior = counts.get(url) || { count: 0, domain }
      counts.set(url, { count: prior.count + 1, domain })
    }
  }

  const items = Array.from(counts.entries())
    .map(([url, v]) => ({ url, count: v.count, domains: v.domain }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return { items }
}

/**
 * Head-to-head Share of Voice for the client vs each tracked competitor
 * over a recent window. Returns a single row per competitor.
 */
export async function getCompetitorCompare(
  s: SupabaseClient,
  body: { client_id: string; days?: number },
): Promise<{
  client_brand: string | null
  rows: { brand: string; is_self: boolean; mentions: number; share: number; avg_position: number | null }[]
  window_days: number
}> {
  const { client_id, days = 30 } = body
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: brandsRows } = await s.from('kotoiq_aeo_competitors')
    .select('brand_name, is_self')
    .eq('client_id', client_id)

  const brandSelf = (brandsRows || []).find(b => b.is_self)
  const client_brand = brandSelf?.brand_name || null

  const { data: runs } = await s.from('kotoiq_aeo_runs')
    .select('brand_mentions')
    .eq('client_id', client_id)
    .gte('run_at', since)

  const tallies = new Map<string, { mentions: number; positions: number[] }>()
  let total = 0
  for (const r of runs || []) {
    for (const m of (r.brand_mentions || [])) {
      if (!m?.brand) continue
      const t = tallies.get(m.brand) || { mentions: 0, positions: [] }
      t.mentions += 1
      if (m.position && m.position > 0) t.positions.push(m.position)
      tallies.set(m.brand, t)
      total += 1
    }
  }

  const selfBrandsSet = new Set((brandsRows || []).filter(b => b.is_self).map(b => b.brand_name))
  const rows = Array.from(tallies.entries())
    .map(([brand, t]) => ({
      brand,
      is_self: selfBrandsSet.has(brand),
      mentions: t.mentions,
      share: total ? Math.round((t.mentions / total) * 100) : 0,
      avg_position: t.positions.length ? Number((t.positions.reduce((a, b) => a + b, 0) / t.positions.length).toFixed(2)) : null,
    }))
    .sort((a, b) => b.mentions - a.mentions)

  return { client_brand, rows, window_days: days }
}

/**
 * Top-of-page KPI cards for the dashboard.
 */
export async function getOverviewStats(
  s: SupabaseClient,
  body: { client_id: string },
): Promise<{
  share_of_voice: number          // % over last 30 days
  share_of_voice_delta: number    // pp change vs prior 30 days
  prompts_tracked: number
  engines_covered: number
  citation_velocity: number       // total client citations in last 7 days
  citation_velocity_delta: number // delta vs prior 7 days
  last_scan_at: string | null
}> {
  const { client_id } = body
  const now = Date.now()

  const [c30, c30prior, c7, c7prior, prompts, lastRun] = await Promise.all([
    getCompetitorCompare(s, { client_id, days: 30 }),
    countMentions(s, client_id, 60, 30),
    getCompetitorCompare(s, { client_id, days: 7 }),
    countMentions(s, client_id, 14, 7),
    s.from('kotoiq_aeo_prompts').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('is_active', true),
    s.from('kotoiq_aeo_runs').select('run_at').eq('client_id', client_id).order('run_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const selfRow30 = c30.rows.find(r => r.is_self)
  const sov30 = selfRow30?.share || 0

  const prior30 = c30prior.totalMentions === 0 ? 0 : Math.round((c30prior.selfMentions / c30prior.totalMentions) * 100)
  const sovDelta = sov30 - prior30

  const cv7 = c7.rows.find(r => r.is_self)?.mentions || 0
  const cvDelta = cv7 - c7prior.selfMentions

  const engines_covered = ALL_ENGINES.length

  return {
    share_of_voice: sov30,
    share_of_voice_delta: sovDelta,
    prompts_tracked: prompts.count || 0,
    engines_covered,
    citation_velocity: cv7,
    citation_velocity_delta: cvDelta,
    last_scan_at: lastRun.data?.run_at || null,
  }
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

async function countMentions(
  s: SupabaseClient,
  client_id: string,
  daysAgoStart: number,
  daysAgoEnd: number,
): Promise<{ selfMentions: number; totalMentions: number }> {
  const start = new Date(Date.now() - daysAgoStart * 86400000).toISOString()
  const end = new Date(Date.now() - daysAgoEnd * 86400000).toISOString()
  const { data: runs } = await s.from('kotoiq_aeo_runs')
    .select('brand_mentions')
    .eq('client_id', client_id)
    .gte('run_at', start)
    .lt('run_at', end)

  const { data: selfRow } = await s.from('kotoiq_aeo_competitors')
    .select('brand_name')
    .eq('client_id', client_id)
    .eq('is_self', true)
    .maybeSingle()

  const selfName = selfRow?.brand_name
  let self = 0
  let total = 0
  for (const r of runs || []) {
    for (const m of (r.brand_mentions || [])) {
      if (!m?.brand) continue
      total += 1
      if (m.brand === selfName) self += 1
    }
  }
  return { selfMentions: self, totalMentions: total }
}

function isoWeekStart(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7  // 1-7, Mon=1
  date.setUTCDate(date.getUTCDate() - (day - 1))
  return date.toISOString().slice(0, 10)
}

function safeDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return '' }
}

// ─────────────────────────────────────────────────────────────
// /api/token-usage
//
// AI cost tracking for Koto. Logs individual API calls across all
// supported providers (Anthropic, OpenAI, Google, Retell voice) and
// rolls them up for the /token-usage dashboard.
//
// Actions:
//   - log            single call logger (used by tokenTracker)
//   - summary        dashboard rollup (by feature/model/day/provider/api_key)
//   - manual_log     add a row by hand (for Gemini etc. with no API)
//   - import_csv     paste an Anthropic Console usage CSV to backfill
//
// All rows land in koto_token_usage. Subscription/flat-fee costs
// (Claude.ai Max Plan, refunds, etc.) land in koto_platform_costs
// and are surfaced alongside metered API costs in the summary.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

// ─────────────────────────────────────────────────────────────
// Pricing per million tokens (April 2026).
// Anything unknown falls back to Sonnet 4 pricing.
// Retell voice is priced per-minute, stored as output_tokens = minutes.
// ─────────────────────────────────────────────────────────────
interface Price { provider: string; input: number; output: number }
const PRICING: Record<string, Price> = {
  // Anthropic / Claude
  'claude-haiku-4-5':            { provider: 'anthropic', input: 0.80,  output: 4.00  },
  'claude-haiku-4-5-20251001':   { provider: 'anthropic', input: 0.80,  output: 4.00  },
  'claude-3-5-haiku-20241022':   { provider: 'anthropic', input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':           { provider: 'anthropic', input: 3.00,  output: 15.00 },
  'claude-sonnet-4-5-20250929':  { provider: 'anthropic', input: 3.00,  output: 15.00 },
  'claude-sonnet-4-20250514':    { provider: 'anthropic', input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20241022':  { provider: 'anthropic', input: 3.00,  output: 15.00 },
  'claude-opus-4-6':             { provider: 'anthropic', input: 15.00, output: 75.00 },
  'claude-opus-4-20250514':      { provider: 'anthropic', input: 15.00, output: 75.00 },

  // OpenAI / ChatGPT
  'gpt-4o':                      { provider: 'openai', input: 2.50,  output: 10.00 },
  'gpt-4o-mini':                 { provider: 'openai', input: 0.15,  output: 0.60  },
  'gpt-4-turbo':                 { provider: 'openai', input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':                { provider: 'openai', input: 0.50,  output: 1.50  },
  'o1':                          { provider: 'openai', input: 15.00, output: 60.00 },
  'o1-mini':                     { provider: 'openai', input: 3.00,  output: 12.00 },

  // Google / Gemini
  'gemini-2.5-flash':            { provider: 'google', input: 0.15,  output: 0.60  },
  'gemini-2.5-pro':              { provider: 'google', input: 1.25,  output: 10.00 },
  'gemini-1.5-flash':            { provider: 'google', input: 0.075, output: 0.30  },
  'gemini-1.5-pro':              { provider: 'google', input: 1.25,  output: 5.00  },

  // Retell voice (minutes stored as output_tokens, ~$0.05/min)
  'retell-voice':                { provider: 'retell', input: 0.00,  output: 50.00 }, // $0.05/min * 1M = $50k per "million minutes"

  default:                       { provider: 'anthropic', input: 3.00, output: 15.00 },
}

function providerFor(model: string): string {
  if (PRICING[model]) return PRICING[model].provider
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai'
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('retell')) return 'retell'
  return 'other'
}

function getCost(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model] || PRICING.default
  return {
    input_cost: (inputTokens / 1_000_000) * price.input,
    output_cost: (outputTokens / 1_000_000) * price.output,
  }
}

// ─────────────────────────────────────────────────────────────
// Anthropic CSV parser. Console export columns:
//   usage_date_utc, model_version, api_key, workspace, usage_type,
//   context_window, usage_input_tokens_no_cache,
//   usage_input_tokens_cache_write_5m, usage_input_tokens_cache_write_1h,
//   usage_input_tokens_cache_read, usage_output_tokens,
//   web_search_count, inference_geo, speed
// ─────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0])
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (cols[idx] || '').trim() })
    out.push(row)
  }
  return out
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ; continue }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

// Heuristic mapping from Anthropic api_key label → Koto feature tag
function apiKeyToFeature(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('momenta audit') || l.includes('audit')) return 'external_audit'
  if (l.includes('momenta app') || l.includes('koto')) return 'koto_app'
  if (l.includes('copilot') || l.includes('obsidian')) return 'obsidian_copilot'
  return 'external'
}

// ─────────────────────────────────────────────────────────────
// Cost category buckets for the Expense Intelligence dashboard.
// Every cost_type in koto_platform_costs + every provider in
// koto_token_usage maps to exactly one category.
// ─────────────────────────────────────────────────────────────
const CATEGORY_FOR_COST_TYPE: Record<string, string> = {
  // AI & LLMs
  anthropic_api:          'ai_llms',
  anthropic_subscription: 'ai_llms',
  claude_ai_max:          'ai_llms',
  claude_ai_extra:        'ai_llms',
  openai_api:             'ai_llms',
  gemini_api:             'ai_llms',
  heygen_api:             'ai_llms',
  // Voice & Phone
  retell_voice:    'voice_phone',
  retell_numbers:  'voice_phone',
  telnyx_numbers:  'voice_phone',
  telnyx_sms:      'voice_phone',
  twilio_voice:    'voice_phone',
  twilio_sms:      'voice_phone',
  // Infrastructure
  vercel:           'infrastructure',
  supabase:         'infrastructure',
  supabase_storage: 'infrastructure',
  // Data & Search
  google_places: 'data_search',
  google_ads:    'data_search',
  google_search: 'data_search',
  brave_search:  'data_search',
  ipinfo:        'data_search',
  // Business Tools
  resend_email: 'business_tools',
  stripe_fees:  'business_tools',
  ghl:          'business_tools',
}

function categoryFor(costType: string): string {
  return CATEGORY_FOR_COST_TYPE[costType] || 'other'
}

function providerCategory(provider: string): string {
  if (provider === 'anthropic' || provider === 'openai' || provider === 'google') return 'ai_llms'
  if (provider === 'retell') return 'voice_phone'
  return 'other'
}

// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // ── log ────────────────────────────────────────────────
    if (action === 'log') {
      const { agency_id, session_id, feature, model, input_tokens, output_tokens, metadata } = body
      if (!feature || !model || input_tokens === undefined || output_tokens === undefined) {
        return NextResponse.json({ error: 'feature, model, input_tokens, output_tokens required' }, { status: 400 })
      }
      const { input_cost, output_cost } = getCost(model, input_tokens, output_tokens)
      const { data, error } = await sb().from('koto_token_usage').insert({
        provider: providerFor(model),
        agency_id: agency_id || null,
        session_id: session_id || null,
        feature,
        model,
        input_tokens,
        output_tokens,
        input_cost,
        output_cost,
        metadata: metadata || {},
      }).select().single()
      if (error) {
        console.warn('[token-usage log] insert failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ logged: true, data })
    }

    // ── manual_log ─────────────────────────────────────────
    // For providers without a usage API (Gemini), or for one-off
    // backfills where you know the totals but not per-call breakdown.
    if (action === 'manual_log') {
      const {
        provider, model, feature, input_tokens, output_tokens,
        cost_override, date, metadata,
      } = body
      if (!model || !feature) {
        return NextResponse.json({ error: 'model and feature required' }, { status: 400 })
      }
      const inTok = Number(input_tokens || 0)
      const outTok = Number(output_tokens || 0)
      let inputCost: number, outputCost: number
      if (cost_override !== undefined && cost_override !== null) {
        // Split override 50/50 across input/output for display purposes
        inputCost = Number(cost_override) / 2
        outputCost = Number(cost_override) / 2
      } else {
        const c = getCost(model, inTok, outTok)
        inputCost = c.input_cost
        outputCost = c.output_cost
      }
      const createdAt = date ? `${date}T12:00:00Z` : new Date().toISOString()
      const { data, error } = await sb().from('koto_token_usage').insert({
        provider: provider || providerFor(model),
        session_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        feature,
        model,
        input_tokens: inTok,
        output_tokens: outTok,
        input_cost: inputCost,
        output_cost: outputCost,
        metadata: { ...(metadata || {}), manually_logged: true },
        created_at: createdAt,
      }).select().single()
      if (error) {
        console.warn('[token-usage manual_log] insert failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ logged: true, data })
    }

    // ── import_csv ─────────────────────────────────────────
    // Paste an Anthropic Console monthly usage export. Parses the
    // 14-column schema, calculates cost from PRICING, inserts one
    // row per (date × model × api_key), and uses a deterministic
    // session_id so re-imports are safe.
    if (action === 'import_csv') {
      const csv: string = body.csv_content || body.csv || ''
      if (!csv.trim()) {
        return NextResponse.json({ error: 'csv_content required' }, { status: 400 })
      }

      const rows = parseCsv(csv)
      if (rows.length === 0) {
        return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })
      }

      const insertRows: any[] = []
      let skipped = 0
      let rawCostSum = 0

      for (const r of rows) {
        const date = r.usage_date_utc || r.date || ''
        const model = r.model_version || r.model || ''
        const apiKey = r.api_key || ''
        if (!date || !model) { skipped++; continue }

        const inNoCache = Number(r.usage_input_tokens_no_cache || 0)
        const inCache5m = Number(r.usage_input_tokens_cache_write_5m || 0)
        const inCache1h = Number(r.usage_input_tokens_cache_write_1h || 0)
        const inCacheRead = Number(r.usage_input_tokens_cache_read || 0)
        const totalIn = inNoCache + inCache5m + inCache1h + inCacheRead
        const totalOut = Number(r.usage_output_tokens || 0)

        if (totalIn === 0 && totalOut === 0) { skipped++; continue }

        const price = PRICING[model] || PRICING.default
        // Weighted: uncached @ 1x, cache_read @ 0.1x, cache_write @ 1.25x
        const uncachedCost = (inNoCache / 1_000_000) * price.input
        const cacheReadCost = (inCacheRead / 1_000_000) * price.input * 0.1
        const cacheWriteCost = ((inCache5m + inCache1h) / 1_000_000) * price.input * 1.25
        const inputCost = uncachedCost + cacheReadCost + cacheWriteCost
        const outputCost = (totalOut / 1_000_000) * price.output
        rawCostSum += inputCost + outputCost

        const feature = apiKeyToFeature(apiKey)
        const sessionId = `csv_${date}_${model}_${apiKey.replace(/\s+/g, '_')}`

        insertRows.push({
          provider: providerFor(model),
          session_id: sessionId,
          feature,
          model,
          input_tokens: totalIn,
          output_tokens: totalOut,
          input_cost: Number(inputCost.toFixed(6)),
          output_cost: Number(outputCost.toFixed(6)),
          metadata: {
            is_historical: true,
            source: 'csv_import',
            api_key_label: apiKey,
            workspace: r.workspace || null,
            usage_type: r.usage_type || null,
            context_window: r.context_window || null,
            web_search_count: Number(r.web_search_count || 0),
            inference_geo: r.inference_geo || null,
            speed: r.speed || null,
            breakdown: {
              uncached_input: inNoCache,
              cache_read_input: inCacheRead,
              cache_creation_5m: inCache5m,
              cache_creation_1h: inCache1h,
            },
          },
          created_at: `${date}T12:00:00Z`,
        })
      }

      if (insertRows.length === 0) {
        return NextResponse.json({
          ok: true,
          imported: 0,
          skipped,
          message: 'Nothing to import — all rows were empty or malformed.',
        })
      }

      // Idempotent: delete any rows with the same session_ids first,
      // then insert. Safer than ON CONFLICT because our session_id
      // unique index is partial.
      const sessionIds = insertRows.map((r) => r.session_id)
      await sb().from('koto_token_usage').delete().in('session_id', sessionIds)

      const { error: insErr } = await sb().from('koto_token_usage').insert(insertRows)
      if (insErr) {
        console.warn('[token-usage import_csv] insert failed:', insErr.message)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        imported: insertRows.length,
        skipped,
        total_cost: Number(rawCostSum.toFixed(4)),
      })
    }

    // ── summary ────────────────────────────────────────────
    if (action === 'summary') {
      const { agency_id, days = 30, provider: providerFilter = 'all' } = body
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      let q = sb()
        .from('koto_token_usage')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (agency_id) q = q.eq('agency_id', agency_id)
      if (providerFilter && providerFilter !== 'all') q = q.eq('provider', providerFilter)

      const { data, error } = await q
      if (error) {
        console.warn('[token-usage summary] fetch failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const rows = data || []

      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalCost = 0
      const byFeature: Record<string, any> = {}
      const byModel: Record<string, any> = {}
      const byDay: Record<string, any> = {}
      const byProvider: Record<string, any> = {}
      const byApiKey: Record<string, any> = {}

      for (const r of rows) {
        totalInputTokens += r.input_tokens
        totalOutputTokens += r.output_tokens
        const cost = Number(r.total_cost)
        totalCost += cost

        const feature = r.feature || 'unknown'
        if (!byFeature[feature]) byFeature[feature] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        byFeature[feature].input_tokens += r.input_tokens
        byFeature[feature].output_tokens += r.output_tokens
        byFeature[feature].total_cost += cost
        byFeature[feature].calls += 1

        const m = r.model
        if (!byModel[m]) byModel[m] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        byModel[m].input_tokens += r.input_tokens
        byModel[m].output_tokens += r.output_tokens
        byModel[m].total_cost += cost
        byModel[m].calls += 1

        const p = r.provider || 'anthropic'
        if (!byProvider[p]) byProvider[p] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        byProvider[p].input_tokens += r.input_tokens
        byProvider[p].output_tokens += r.output_tokens
        byProvider[p].total_cost += cost
        byProvider[p].calls += 1

        const apiKey = r.metadata?.api_key_label || '(internal)'
        if (!byApiKey[apiKey]) byApiKey[apiKey] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        byApiKey[apiKey].input_tokens += r.input_tokens
        byApiKey[apiKey].output_tokens += r.output_tokens
        byApiKey[apiKey].total_cost += cost
        byApiKey[apiKey].calls += 1

        const day = String(r.created_at).slice(0, 10)
        if (!byDay[day]) byDay[day] = { total_tokens: 0, total_cost: 0, calls: 0 }
        byDay[day].total_tokens += r.input_tokens + r.output_tokens
        byDay[day].total_cost += cost
        byDay[day].calls += 1
      }

      // Flat-fee platform costs (Claude.ai subscription, refunds, etc.)
      const sinceDate = since.slice(0, 10)
      const { data: platformRows } = await sb()
        .from('koto_platform_costs')
        .select('*')
        .gte('date', sinceDate)
        .order('date', { ascending: false })

      const platformTotal = (platformRows || []).reduce((a: number, r: any) => a + Number(r.amount), 0)
      const byPlatformType: Record<string, any> = {}
      for (const r of platformRows || []) {
        const t = r.cost_type
        if (!byPlatformType[t]) byPlatformType[t] = { total: 0, entries: 0 }
        byPlatformType[t].total += Number(r.amount)
        byPlatformType[t].entries += 1
      }

      const recent = rows.slice(0, 50).map((r) => ({
        id: r.id,
        provider: r.provider,
        feature: r.feature,
        model: r.model,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        total_cost: Number(r.total_cost),
        created_at: r.created_at,
        metadata: r.metadata,
      }))

      return NextResponse.json({
        days,
        provider_filter: providerFilter,
        total_calls: rows.length,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        total_cost: totalCost,
        by_feature: byFeature,
        by_model: byModel,
        by_provider: byProvider,
        by_api_key: byApiKey,
        by_day: byDay,
        platform_costs: {
          total: Number(platformTotal.toFixed(2)),
          entries: (platformRows || []).length,
          by_type: byPlatformType,
          recent: (platformRows || []).slice(0, 20),
        },
        grand_total: Number((totalCost + platformTotal).toFixed(2)),
        recent,
      })
    }

    // ── log_platform_cost ─────────────────────────────────
    // Record a flat-fee line item (Vercel Pro, Supabase Pro, GHL,
    // Retell number rental, one-off Places API charges, etc.).
    if (action === 'log_platform_cost') {
      const { agency_id, cost_type, amount, unit_count, description, date, metadata } = body
      if (!cost_type || amount === undefined) {
        return NextResponse.json({ error: 'cost_type and amount required' }, { status: 400 })
      }
      const { data, error } = await sb().from('koto_platform_costs').insert({
        agency_id: agency_id || null,
        cost_type,
        amount: Number(amount),
        unit_count: unit_count ?? 1,
        description: description || null,
        date: date || new Date().toISOString().slice(0, 10),
        metadata: metadata || {},
      }).select().single()
      if (error) {
        console.warn('[token-usage log_platform_cost] insert failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ logged: true, data })
    }

    // ── platform_summary ──────────────────────────────────
    if (action === 'platform_summary') {
      const { date_from, date_to } = body
      const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const to = date_to || new Date().toISOString().slice(0, 10)

      const { data, error } = await sb()
        .from('koto_platform_costs')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const rows = data || []
      let total = 0
      const byType: Record<string, any> = {}
      const byCategory: Record<string, any> = {}
      for (const r of rows) {
        const amt = Number(r.amount)
        total += amt
        const t = r.cost_type
        if (!byType[t]) byType[t] = { total: 0, entries: 0 }
        byType[t].total += amt
        byType[t].entries += 1
        const cat = categoryFor(t)
        if (!byCategory[cat]) byCategory[cat] = { total: 0, entries: 0 }
        byCategory[cat].total += amt
        byCategory[cat].entries += 1
      }

      return NextResponse.json({
        date_from: from,
        date_to: to,
        total: Number(total.toFixed(2)),
        by_type: byType,
        by_category: byCategory,
        rows,
      })
    }

    // ── cog_overview ──────────────────────────────────────
    // The master summary for CogReportPage. Combines
    // koto_token_usage (metered API calls) + koto_platform_costs
    // (flat fees) into one category-bucketed expense view.
    if (action === 'cog_overview') {
      const { days = 30 } = body
      const since = new Date(Date.now() - days * 86400000).toISOString()
      const sinceDate = since.slice(0, 10)

      // Metered API calls
      const { data: tokenRows } = await sb()
        .from('koto_token_usage')
        .select('*')
        .gte('created_at', since)
      // Flat-fee costs
      const { data: platformRows } = await sb()
        .from('koto_platform_costs')
        .select('*')
        .gte('date', sinceDate)

      const tokens = tokenRows || []
      const platform = platformRows || []

      // Category totals
      const byCategory: Record<string, any> = {
        ai_llms:         { label: 'AI & LLMs',       color: '#8b5cf6', total: 0, sources: {} },
        voice_phone:     { label: 'Voice & Phone',   color: '#00C2CB', total: 0, sources: {} },
        infrastructure:  { label: 'Infrastructure',  color: '#16a34a', total: 0, sources: {} },
        data_search:     { label: 'Data & Search',   color: '#f59e0b', total: 0, sources: {} },
        business_tools:  { label: 'Business Tools',  color: '#E6007E', total: 0, sources: {} },
        other:           { label: 'Other',           color: '#9ca3af', total: 0, sources: {} },
      }

      // Service-level breakdown
      const byService: Record<string, any> = {}
      const ensureService = (key: string, label: string, category: string) => {
        if (!byService[key]) {
          byService[key] = {
            key, label, category,
            api_cost: 0, platform_cost: 0, total: 0,
            calls: 0, tokens: 0,
          }
        }
      }

      // Fold token-usage rows
      for (const r of tokens) {
        const cost = Number(r.total_cost)
        const cat = providerCategory(r.provider || 'anthropic')
        byCategory[cat].total += cost
        const serviceKey = r.provider || 'other'
        const serviceLabel = ({ anthropic: 'Anthropic API', openai: 'OpenAI API', google: 'Google Gemini', retell: 'Retell Voice', other: 'Other AI' } as any)[serviceKey] || serviceKey
        ensureService(serviceKey, serviceLabel, cat)
        byService[serviceKey].api_cost += cost
        byService[serviceKey].total += cost
        byService[serviceKey].calls += 1
        byService[serviceKey].tokens += r.input_tokens + r.output_tokens
        if (!byCategory[cat].sources[serviceKey]) byCategory[cat].sources[serviceKey] = 0
        byCategory[cat].sources[serviceKey] += cost
      }

      // Fold platform cost rows
      const SERVICE_META: Record<string, { label: string; icon: string }> = {
        vercel:                 { label: 'Vercel',            icon: '⚡' },
        supabase:               { label: 'Supabase',          icon: '🗄️' },
        ghl:                    { label: 'GoHighLevel',       icon: '🔗' },
        claude_ai_max:          { label: 'Claude.ai Max Plan', icon: '🧠' },
        claude_ai_extra:        { label: 'Claude.ai Extras',  icon: '🧠' },
        anthropic_subscription: { label: 'Claude.ai Max Plan', icon: '🧠' },
        retell_numbers:         { label: 'Retell Numbers',    icon: '☎️' },
        retell_voice:           { label: 'Retell Voice',      icon: '🎙️' },
        telnyx_numbers:         { label: 'Telnyx Numbers',    icon: '☎️' },
        telnyx_sms:             { label: 'Telnyx SMS',        icon: '💬' },
        twilio_voice:           { label: 'Twilio Voice',      icon: '☎️' },
        twilio_sms:             { label: 'Twilio SMS',        icon: '💬' },
        google_places:          { label: 'Google Places',     icon: '🗺️' },
        google_ads:             { label: 'Google Ads',        icon: '📊' },
        brave_search:           { label: 'Brave Search',      icon: '🔍' },
        resend_email:           { label: 'Resend',            icon: '📧' },
        stripe_fees:            { label: 'Stripe',            icon: '💳' },
        heygen_api:             { label: 'HeyGen',            icon: '🎬' },
      }

      for (const r of platform) {
        const amt = Number(r.amount)
        const cat = categoryFor(r.cost_type)
        byCategory[cat].total += amt
        const meta = SERVICE_META[r.cost_type] || { label: r.cost_type, icon: '📦' }
        const serviceKey = r.cost_type
        ensureService(serviceKey, meta.label, cat)
        byService[serviceKey].platform_cost += amt
        byService[serviceKey].total += amt
        if (!byCategory[cat].sources[serviceKey]) byCategory[cat].sources[serviceKey] = 0
        byCategory[cat].sources[serviceKey] += amt
      }

      const grandTotal = Object.values(byCategory).reduce((a: number, c: any) => a + c.total, 0)

      return NextResponse.json({
        days,
        grand_total: Number(grandTotal.toFixed(2)),
        by_category: byCategory,
        by_service: Object.values(byService).sort((a: any, b: any) => b.total - a.total),
        api_rows: tokens.length,
        platform_rows: platform.length,
      })
    }

    // ── month_trend ───────────────────────────────────────
    // Returns stacked cost-per-day for the last N months so the
    // dashboard can render a stacked area chart. Each day carries
    // the total cost in each of the 6 categories plus a grand.
    // Pulls from BOTH koto_token_usage and koto_platform_costs.
    if (action === 'month_trend') {
      const { months = 3 } = body
      const since = new Date()
      since.setUTCMonth(since.getUTCMonth() - months)
      since.setUTCDate(1)
      since.setUTCHours(0, 0, 0, 0)
      const sinceIso = since.toISOString()
      const sinceDate = sinceIso.slice(0, 10)

      const [tokensRes, platformRes] = await Promise.all([
        sb().from('koto_token_usage').select('provider, total_cost, created_at').gte('created_at', sinceIso),
        sb().from('koto_platform_costs').select('cost_type, amount, date').gte('date', sinceDate),
      ])

      const byDay: Record<string, Record<string, number>> = {}
      const ensure = (day: string) => {
        if (!byDay[day]) {
          byDay[day] = { ai_llms: 0, voice_phone: 0, infrastructure: 0, data_search: 0, business_tools: 0, other: 0, total: 0 }
        }
        return byDay[day]
      }

      for (const r of tokensRes.data || []) {
        const day = String(r.created_at).slice(0, 10)
        const cat = providerCategory(r.provider || 'anthropic')
        const bucket = ensure(day)
        const c = Number(r.total_cost)
        bucket[cat] += c
        bucket.total += c
      }

      for (const r of platformRes.data || []) {
        const day = String(r.date)
        const cat = categoryFor(r.cost_type)
        const bucket = ensure(day)
        const c = Number(r.amount)
        bucket[cat] += c
        bucket.total += c
      }

      // Sort ascending by day so the chart draws left-to-right
      const days = Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, vals]) => ({ day, ...vals }))

      // Month rollup
      const byMonth: Record<string, Record<string, number>> = {}
      for (const d of days) {
        const month = d.day.slice(0, 7)
        if (!byMonth[month]) {
          byMonth[month] = { ai_llms: 0, voice_phone: 0, infrastructure: 0, data_search: 0, business_tools: 0, other: 0, total: 0 }
        }
        for (const k of Object.keys(byMonth[month])) {
          byMonth[month][k] += (d as any)[k] || 0
        }
      }

      return NextResponse.json({
        months,
        days,
        by_month: byMonth,
      })
    }

    // ── feature_breakdown ─────────────────────────────────
    // Rolls up koto_token_usage by feature, returning for each:
    //   - total_calls, total_cost, total_tokens
    //   - avg_cost_per_call (= total_cost / total_calls)
    //   - primary_model (most-used model for that feature)
    // Used by the CogReportPage "Cost per Feature" table.
    if (action === 'feature_breakdown') {
      const { days = 30, agency_id } = body
      const since = new Date(Date.now() - days * 86400000).toISOString()
      let q = sb()
        .from('koto_token_usage')
        .select('feature, model, total_cost, input_tokens, output_tokens')
        .gte('created_at', since)
      if (agency_id) q = q.eq('agency_id', agency_id)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const rows: any[] = data || []
      const byFeature: Record<string, any> = {}
      for (const r of rows) {
        const f = r.feature || 'unknown'
        if (!byFeature[f]) {
          byFeature[f] = {
            feature: f,
            calls: 0,
            total_cost: 0,
            input_tokens: 0,
            output_tokens: 0,
            models: {} as Record<string, number>,
          }
        }
        byFeature[f].calls += 1
        byFeature[f].total_cost += Number(r.total_cost)
        byFeature[f].input_tokens += r.input_tokens
        byFeature[f].output_tokens += r.output_tokens
        byFeature[f].models[r.model] = (byFeature[f].models[r.model] || 0) + 1
      }

      const out = Object.values(byFeature).map((f: any) => {
        const primaryModel = Object.entries(f.models).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null
        return {
          feature: f.feature,
          calls: f.calls,
          total_cost: Number(f.total_cost.toFixed(6)),
          avg_cost_per_call: Number((f.total_cost / Math.max(1, f.calls)).toFixed(6)),
          total_tokens: f.input_tokens + f.output_tokens,
          input_tokens: f.input_tokens,
          output_tokens: f.output_tokens,
          primary_model: primaryModel,
        }
      }).sort((a: any, b: any) => b.total_cost - a.total_cost)

      return NextResponse.json({ features: out, days, total_rows: rows.length })
    }

    // ── get_budgets ───────────────────────────────────────
    if (action === 'get_budgets') {
      const { agency_id } = body
      let q = sb().from('koto_category_budgets').select('*').order('category')
      if (agency_id) q = q.eq('agency_id', agency_id)
      else q = q.is('agency_id', null)
      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ budgets: data || [] })
    }

    // ── set_budget ────────────────────────────────────────
    // Upsert per-category monthly budget. category = ai_llms |
    // voice_phone | infrastructure | data_search | business_tools |
    // other | 'total'. alert_threshold_pct defaults to 80.
    if (action === 'set_budget') {
      const { agency_id, category, monthly_budget, alert_threshold_pct } = body
      if (!category || monthly_budget === undefined) {
        return NextResponse.json({ error: 'category and monthly_budget required' }, { status: 400 })
      }
      // Upsert by (agency_id, category)
      const sbClient = sb()
      const { data: existing } = await sbClient
        .from('koto_category_budgets')
        .select('id')
        .eq('category', category)
        .is('agency_id', agency_id || null)
        .maybeSingle()
      if (existing?.id) {
        const { data, error } = await sbClient.from('koto_category_budgets').update({
          monthly_budget: Number(monthly_budget),
          alert_threshold_pct: alert_threshold_pct || 80,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ budget: data })
      } else {
        const { data, error } = await sbClient.from('koto_category_budgets').insert({
          agency_id: agency_id || null,
          category,
          monthly_budget: Number(monthly_budget),
          alert_threshold_pct: alert_threshold_pct || 80,
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ budget: data })
      }
    }

    // ── delete_budget ─────────────────────────────────────
    if (action === 'delete_budget') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const { error } = await sb().from('koto_category_budgets').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── sync_openai ───────────────────────────────────────
    // Pulls daily usage from OpenAI for the last N days and
    // writes one row per (day × model) into koto_token_usage
    // with provider='openai'. Only covers the last 90 days —
    // OpenAI's usage endpoint doesn't go further back.
    //
    // Requires OPENAI_API_KEY. If unset, returns { available: false }.
    // Idempotent via session_id = openai_{date}_{snapshot_id}.
    if (action === 'sync_openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ available: false, error: 'OPENAI_API_KEY not set — add it in Vercel env vars' })
      }
      const { days = 30 } = body
      const targetDays: string[] = []
      for (let i = 0; i < Math.min(days, 90); i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
        targetDays.push(d)
      }

      let totalInserted = 0
      let totalCost = 0
      const errors: string[] = []

      for (const day of targetDays) {
        try {
          const res = await fetch(`https://api.openai.com/v1/usage?date=${day}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(15000),
          })
          if (!res.ok) {
            errors.push(`${day}: ${res.status}`)
            continue
          }
          const usage = await res.json()
          const lines: any[] = usage?.data || []
          if (lines.length === 0) continue

          // Dedupe — delete existing rows for this day+model then re-insert.
          const sessionIds = lines.map((l: any, idx: number) => `openai_${day}_${l.snapshot_id || l.model || 'unknown'}_${idx}`)
          await sb().from('koto_token_usage').delete().in('session_id', sessionIds)

          const rows: any[] = []
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i]
            const model = l.snapshot_id || l.model || 'gpt-4o'
            const inTok = Number(l.n_context_tokens_total || l.n_prompt_tokens_total || 0)
            const outTok = Number(l.n_generated_tokens_total || l.n_completion_tokens_total || 0)
            if (inTok === 0 && outTok === 0) continue
            const price = PRICING[model] || PRICING.default
            const inputCost = (inTok / 1_000_000) * price.input
            const outputCost = (outTok / 1_000_000) * price.output
            totalCost += inputCost + outputCost
            rows.push({
              provider: 'openai',
              session_id: sessionIds[i],
              feature: 'openai_sync',
              model,
              input_tokens: inTok,
              output_tokens: outTok,
              input_cost: Number(inputCost.toFixed(6)),
              output_cost: Number(outputCost.toFixed(6)),
              metadata: {
                source: 'openai_usage_api',
                is_historical: true,
                day,
                n_requests: l.n_requests || 0,
                operation: l.operation || null,
              },
              created_at: `${day}T12:00:00Z`,
            })
          }
          if (rows.length > 0) {
            const { error: insErr } = await sb().from('koto_token_usage').insert(rows)
            if (insErr) {
              errors.push(`${day} insert: ${insErr.message}`)
            } else {
              totalInserted += rows.length
            }
          }
        } catch (e: any) {
          errors.push(`${day}: ${e.message}`)
        }
      }

      return NextResponse.json({
        available: true,
        synced: totalInserted,
        total_cost: Number(totalCost.toFixed(4)),
        days_checked: targetDays.length,
        errors: errors.length ? errors.slice(0, 10) : undefined,
      })
    }

    // ── sync_retell_calls ─────────────────────────────────
    // Pulls recent calls from Retell API, converts duration to
    // minutes, and logs each as a row in koto_token_usage with
    // model='retell-voice'. Idempotent via session_id = call_id.
    if (action === 'sync_retell_calls') {
      const apiKey = process.env.RETELL_API_KEY
      if (!apiKey) {
        return NextResponse.json({ available: false, error: 'RETELL_API_KEY not set' }, { status: 400 })
      }
      const { limit = 500 } = body
      try {
        const res = await fetch('https://api.retellai.com/v2/list-calls', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit }),
          signal: AbortSignal.timeout(30000),
        })
        if (!res.ok) {
          const text = await res.text()
          console.warn('[sync_retell_calls] API error:', res.status, text.slice(0, 300))
          return NextResponse.json({ error: `Retell API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 })
        }
        const calls: any[] = await res.json()

        // Existing session_ids we've already logged
        const ids = calls.map((c) => c.call_id).filter(Boolean)
        const { data: existing } = await sb()
          .from('koto_token_usage')
          .select('session_id')
          .in('session_id', ids)
        const already = new Set((existing || []).map((r: any) => r.session_id))

        const toInsert: any[] = []
        let totalMinutes = 0
        let totalCost = 0

        for (const call of calls) {
          if (!call.call_id || already.has(call.call_id)) continue
          const durationMs = call.duration_ms || call.end_timestamp - call.start_timestamp || 0
          if (durationMs <= 0) continue
          const minutes = Math.ceil(durationMs / 60000)
          const cost = minutes * 0.05
          totalMinutes += minutes
          totalCost += cost
          const startedAt = call.start_timestamp
            ? new Date(call.start_timestamp).toISOString()
            : new Date().toISOString()
          toInsert.push({
            provider: 'retell',
            session_id: call.call_id,
            feature: 'voice_onboarding',
            model: 'retell-voice',
            input_tokens: 0,
            output_tokens: minutes,
            input_cost: 0,
            output_cost: cost,
            metadata: {
              retell_call_id: call.call_id,
              agent_id: call.agent_id || null,
              from_number: call.from_number || null,
              to_number: call.to_number || null,
              duration_ms: durationMs,
              duration_minutes: minutes,
              source: 'retell_sync',
            },
            created_at: startedAt,
          })
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await sb().from('koto_token_usage').insert(toInsert)
          if (insErr) {
            console.warn('[sync_retell_calls] insert failed:', insErr.message)
            return NextResponse.json({ error: insErr.message }, { status: 500 })
          }
        }

        return NextResponse.json({
          synced: toInsert.length,
          skipped: calls.length - toInsert.length,
          total_minutes: totalMinutes,
          total_cost: Number(totalCost.toFixed(4)),
          calls_fetched: calls.length,
        })
      } catch (e: any) {
        console.error('[sync_retell_calls] fatal:', e)
        return NextResponse.json({ error: e?.message || 'sync failed' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[token-usage fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

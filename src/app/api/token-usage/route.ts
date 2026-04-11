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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[token-usage fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

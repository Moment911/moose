// ─────────────────────────────────────────────────────────────
// /api/token-usage
//
// Logs individual Claude API calls (action=log) and returns a
// rolled-up summary by feature / model / day (action=summary).
// Non-critical infrastructure — all server-side AI routes call
// logTokenUsage() from src/lib/tokenTracker.ts fire-and-forget.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

// Pricing per million tokens (Claude 4 family, April 2026).
// Anything unknown falls back to Sonnet pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  default: { input: 3.00, output: 15.00 },
}

function getCost(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model] || PRICING.default
  return {
    input_cost: (inputTokens / 1_000_000) * price.input,
    output_cost: (outputTokens / 1_000_000) * price.output,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // ── log ────────────────────────────────────────────────
    if (action === 'log') {
      const {
        agency_id,
        session_id,
        feature,
        model,
        input_tokens,
        output_tokens,
        metadata,
      } = body

      if (!feature || !model || input_tokens === undefined || output_tokens === undefined) {
        return NextResponse.json(
          { error: 'feature, model, input_tokens, output_tokens required' },
          { status: 400 },
        )
      }

      const { input_cost, output_cost } = getCost(model, input_tokens, output_tokens)

      const { data, error } = await sb()
        .from('koto_token_usage')
        .insert({
          agency_id: agency_id || null,
          session_id: session_id || null,
          feature,
          model,
          input_tokens,
          output_tokens,
          input_cost,
          output_cost,
          metadata: metadata || {},
        })
        .select()
        .single()

      if (error) {
        console.warn('[token-usage log] insert failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ logged: true, data })
    }

    // ── summary ────────────────────────────────────────────
    if (action === 'summary') {
      const { agency_id, days = 30 } = body
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      let q = sb()
        .from('koto_token_usage')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (agency_id) q = q.eq('agency_id', agency_id)

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

      for (const r of rows) {
        totalInputTokens += r.input_tokens
        totalOutputTokens += r.output_tokens
        const cost = Number(r.total_cost)
        totalCost += cost

        if (!byFeature[r.feature]) {
          byFeature[r.feature] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        }
        byFeature[r.feature].input_tokens += r.input_tokens
        byFeature[r.feature].output_tokens += r.output_tokens
        byFeature[r.feature].total_cost += cost
        byFeature[r.feature].calls += 1

        const m = r.model
        if (!byModel[m]) {
          byModel[m] = { input_tokens: 0, output_tokens: 0, total_cost: 0, calls: 0 }
        }
        byModel[m].input_tokens += r.input_tokens
        byModel[m].output_tokens += r.output_tokens
        byModel[m].total_cost += cost
        byModel[m].calls += 1

        const day = String(r.created_at).slice(0, 10)
        if (!byDay[day]) byDay[day] = { total_tokens: 0, total_cost: 0, calls: 0 }
        byDay[day].total_tokens += r.input_tokens + r.output_tokens
        byDay[day].total_cost += cost
        byDay[day].calls += 1
      }

      const recent = rows.slice(0, 50).map((r) => ({
        id: r.id,
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
        total_calls: rows.length,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        total_cost: totalCost,
        by_feature: byFeature,
        by_model: byModel,
        by_day: byDay,
        recent,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[token-usage fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

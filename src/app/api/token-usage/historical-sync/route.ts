// ─────────────────────────────────────────────────────────────
// /api/token-usage/historical-sync
//
// One-shot (and re-runnable) backfill of historical Anthropic
// usage into koto_token_usage. Hits the Admin API endpoint
//
//   GET https://api.anthropic.com/v1/organizations/usage_report/messages
//
// which returns per-day usage grouped by model. Rows land in
// koto_token_usage with feature='historical' so they're clearly
// distinguishable from live tracking (feature='proposal_generation'
// etc.) while still showing up in the summary rollups.
//
// Requires ANTHROPIC_ADMIN_KEY (starts with sk-ant-admin01-…).
// The regular ANTHROPIC_API_KEY does NOT work — this endpoint is
// organization-scoped and only Org Owners can mint admin keys.
//
// POST body: { start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD',
//              dry_run?: boolean, overwrite?: boolean }
//
// Idempotency: a day+model pair is only inserted once with
// feature='historical'. Second run on the same window is a no-op
// unless `overwrite: true` is passed (deletes existing historical
// rows in the window first).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY || ''
const ADMIN_URL = 'https://api.anthropic.com/v1/organizations/usage_report/messages'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Pricing per million tokens. Cache read is 0.1x input, cache
// creation is 1.25x input (Anthropic's published multipliers).
// Unknown models fall through to Sonnet pricing so we never
// fail closed with zero cost.
interface Price { input: number; output: number }
const PRICING: Record<string, Price> = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  default: { input: 3.00, output: 15.00 },
}

function priceFor(model: string): Price {
  if (PRICING[model]) return PRICING[model]
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5']
  if (model.includes('opus')) return PRICING['claude-opus-4-6']
  if (model.includes('sonnet')) return PRICING['claude-sonnet-4-6']
  return PRICING.default
}

// Anthropic caps 1d granularity at 31 buckets per request, so we
// chunk any longer window into 31-day pages. The chunk size is
// inclusive — [start, start+chunk) — with the final chunk clipped
// at `end`.
function chunks(start: Date, end: Date, days = 31): Array<{ starting_at: string; ending_at: string }> {
  const out: Array<{ starting_at: string; ending_at: string }> = []
  const cursor = new Date(start)
  while (cursor < end) {
    const chunkEnd = new Date(cursor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + days)
    const clipped = chunkEnd > end ? end : chunkEnd
    out.push({
      starting_at: cursor.toISOString(),
      ending_at: clipped.toISOString(),
    })
    cursor.setTime(clipped.getTime())
  }
  return out
}

interface AnthropicUsageResult {
  uncached_input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens?: number
    ephemeral_1h_input_tokens?: number
  }
  model?: string | null
}
interface AnthropicBucket {
  starting_at: string
  ending_at: string
  results: AnthropicUsageResult[]
}
interface AnthropicResponse {
  data: AnthropicBucket[]
  has_more?: boolean
  next_page?: string | null
}

async function fetchUsageChunk(starting_at: string, ending_at: string): Promise<AnthropicBucket[]> {
  const allBuckets: AnthropicBucket[] = []
  let page: string | null = null
  let safety = 0

  while (safety++ < 50) {
    const params = new URLSearchParams({
      starting_at,
      ending_at,
      bucket_width: '1d',
      limit: '31',
    })
    // group_by=model must be repeated per value
    params.append('group_by[]', 'model')
    if (page) params.set('page', page)

    const url = `${ADMIN_URL}?${params.toString()}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': ADMIN_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Admin API ${res.status}: ${text.slice(0, 500)}`)
    }

    const body = (await res.json()) as AnthropicResponse
    allBuckets.push(...(body.data || []))

    if (!body.has_more || !body.next_page) break
    page = body.next_page
  }

  return allBuckets
}

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_ADMIN_KEY not configured. Generate an Admin API key at console.anthropic.com → Settings → API Keys → Admin Keys and set it in Vercel.' },
        { status: 400 },
      )
    }

    const body = await req.json()
    const startStr: string = body.start_date || ''
    const endStr: string = body.end_date || new Date().toISOString().slice(0, 10)
    const dryRun: boolean = !!body.dry_run
    const overwrite: boolean = !!body.overwrite

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' }, { status: 400 })
    }

    const start = new Date(`${startStr}T00:00:00Z`)
    const end = new Date(`${endStr}T00:00:00Z`)
    if (!(end > start)) {
      return NextResponse.json({ error: 'end_date must be after start_date' }, { status: 400 })
    }

    console.log(`[historical-sync] ${startStr} → ${endStr} (dryRun=${dryRun}, overwrite=${overwrite})`)

    const s = sb()

    // Idempotency — nuke existing historical rows in this window
    // if the caller asked for an overwrite.
    if (overwrite && !dryRun) {
      const { error: delErr } = await s
        .from('koto_token_usage')
        .delete()
        .eq('feature', 'historical')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
      if (delErr) console.warn('[historical-sync] overwrite delete failed:', delErr.message)
    }

    // Already-synced days (for idempotent re-runs). Key = YYYY-MM-DD|model
    const existingKeys = new Set<string>()
    if (!overwrite) {
      const { data: existing } = await s
        .from('koto_token_usage')
        .select('created_at, model')
        .eq('feature', 'historical')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
      for (const row of existing || []) {
        const day = String(row.created_at).slice(0, 10)
        existingKeys.add(`${day}|${row.model}`)
      }
    }

    // Fetch all chunks
    const windows = chunks(start, end, 31)
    let totalBuckets = 0
    let skipped = 0
    const toInsert: any[] = []
    const perDayTotals: Record<string, { input: number; output: number; cost: number; calls: number }> = {}

    for (const w of windows) {
      const buckets = await fetchUsageChunk(w.starting_at, w.ending_at)
      totalBuckets += buckets.length

      for (const bucket of buckets) {
        const day = bucket.starting_at.slice(0, 10)

        for (const r of bucket.results || []) {
          const model = r.model || 'unknown'
          const key = `${day}|${model}`

          const uncached = r.uncached_input_tokens || 0
          const cacheRead = r.cache_read_input_tokens || 0
          const cache5m = r.cache_creation?.ephemeral_5m_input_tokens || 0
          const cache1h = r.cache_creation?.ephemeral_1h_input_tokens || 0
          const output = r.output_tokens || 0

          const totalInput = uncached + cacheRead + cache5m + cache1h

          // Nothing happened this day for this model — skip
          if (totalInput === 0 && output === 0) continue

          if (existingKeys.has(key)) {
            skipped++
            continue
          }

          const price = priceFor(model)
          // Weighted input cost — cache read 0.1x, cache creation 1.25x
          const uncachedCost = (uncached / 1_000_000) * price.input
          const cacheReadCost = (cacheRead / 1_000_000) * price.input * 0.1
          const cacheCreateCost = ((cache5m + cache1h) / 1_000_000) * price.input * 1.25
          const inputCost = uncachedCost + cacheReadCost + cacheCreateCost
          const outputCost = (output / 1_000_000) * price.output

          const row = {
            agency_id: null,
            session_id: null,
            feature: 'historical',
            model,
            input_tokens: totalInput,
            output_tokens: output,
            input_cost: Number(inputCost.toFixed(6)),
            output_cost: Number(outputCost.toFixed(6)),
            metadata: {
              historical: true,
              source: 'anthropic_admin_api',
              day,
              bucket_start: bucket.starting_at,
              bucket_end: bucket.ending_at,
              breakdown: {
                uncached_input: uncached,
                cache_read_input: cacheRead,
                cache_creation_5m: cache5m,
                cache_creation_1h: cache1h,
              },
            },
            // Pin created_at to the bucket start so the dashboard's
            // daily rollup groups these with the right day.
            created_at: bucket.starting_at,
          }
          toInsert.push(row)

          const dayCost = inputCost + outputCost
          if (!perDayTotals[day]) perDayTotals[day] = { input: 0, output: 0, cost: 0, calls: 0 }
          perDayTotals[day].input += totalInput
          perDayTotals[day].output += output
          perDayTotals[day].cost += dayCost
          perDayTotals[day].calls += 1
        }
      }
    }

    console.log(`[historical-sync] fetched ${totalBuckets} buckets → ${toInsert.length} rows to insert (skipped ${skipped})`)

    if (dryRun) {
      const totalCost = toInsert.reduce((a, r) => a + r.input_cost + r.output_cost, 0)
      const totalInput = toInsert.reduce((a, r) => a + r.input_tokens, 0)
      const totalOutput = toInsert.reduce((a, r) => a + r.output_tokens, 0)
      return NextResponse.json({
        dry_run: true,
        start_date: startStr,
        end_date: endStr,
        buckets_fetched: totalBuckets,
        rows_would_insert: toInsert.length,
        rows_skipped: skipped,
        total_input_tokens: totalInput,
        total_output_tokens: totalOutput,
        total_cost: Number(totalCost.toFixed(4)),
        by_day: perDayTotals,
        sample: toInsert.slice(0, 5),
      })
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped,
        message: 'Nothing to insert — window already synced or empty.',
      })
    }

    // Batch insert 500 at a time
    let inserted = 0
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500)
      const { error } = await s.from('koto_token_usage').insert(batch)
      if (error) {
        console.error('[historical-sync] batch insert failed:', error.message)
        return NextResponse.json({
          ok: false,
          error: error.message,
          inserted_so_far: inserted,
        }, { status: 500 })
      }
      inserted += batch.length
    }

    const totalCost = toInsert.reduce((a, r) => a + r.input_cost + r.output_cost, 0)
    return NextResponse.json({
      ok: true,
      start_date: startStr,
      end_date: endStr,
      inserted,
      skipped,
      buckets_fetched: totalBuckets,
      total_cost: Number(totalCost.toFixed(4)),
    })
  } catch (e: any) {
    console.error('[historical-sync fatal]', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

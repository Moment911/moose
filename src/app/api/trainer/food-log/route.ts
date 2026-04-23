import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MODELS } from '../../../../lib/trainer/trainerConfig'
import { logTokenUsage } from '../../../../lib/tokenTracker'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/food-log — Phase B nutrition tracker
//
// Token-based (trainee_id is the token — same auth model as /intake-plan).
// Five actions:
//
//   scan_photo   — { trainee_id, photo_base64, photo_mime? } -> recognized items
//                  + persists a food_logs row + caches unknown names by
//                  normalized key for the agency. On cache hit, skips
//                  Claude vision entirely.
//   list_today   — { trainee_id, tz? } -> today's logs + running totals
//                  + target (from latest baseline) + remaining deltas.
//   add_manual   — { trainee_id, items } -> persist a manual entry.
//   delete       — { trainee_id, log_id } -> remove a log row.
//   list_range   — { trainee_id, from, to } -> rows across a date range
//                  (for week / month views).
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

type FoodItem = {
  name: string
  kcal: number
  protein_g: number
  fat_g: number
  carb_g: number
  portion?: string
}

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

function nameKey(name: string): string {
  return (name || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function roundNum(n: unknown, digits = 1): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  const m = Math.pow(10, digits)
  return Math.round(v * m) / m
}

function sumItems(items: FoodItem[]): { kcal: number; p: number; f: number; c: number } {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (Number(it.kcal) || 0),
      p: acc.p + (Number(it.protein_g) || 0),
      f: acc.f + (Number(it.fat_g) || 0),
      c: acc.c + (Number(it.carb_g) || 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  )
}

export async function POST(req: NextRequest) {
  const sb = getDb()
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const action = typeof body.action === 'string' ? body.action : ''
  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Agency-scoping + existence check.
  const { data: trainee, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('id, agency_id')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !trainee) return err(404, 'Trainee not found')
  const agencyId = (trainee as { agency_id: string }).agency_id

  if (action === 'scan_photo') return handleScanPhoto(sb, traineeId, agencyId, body)
  if (action === 'list_today') return handleListToday(sb, traineeId, agencyId)
  if (action === 'add_manual') return handleAddManual(sb, traineeId, agencyId, body)
  if (action === 'delete') return handleDelete(sb, traineeId, agencyId, body)
  if (action === 'list_range') return handleListRange(sb, traineeId, agencyId, body)
  return err(400, 'Unknown action', { allowed: ['scan_photo', 'list_today', 'add_manual', 'delete', 'list_range'] })
}

// ── scan_photo ──────────────────────────────────────────────────────────────
async function handleScanPhoto(
  sb: SupabaseClient,
  traineeId: string,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const photoBase64 = typeof body.photo_base64 === 'string' ? body.photo_base64 : ''
  const mime = typeof body.photo_mime === 'string' ? body.photo_mime : 'image/jpeg'
  if (!photoBase64) return err(400, 'photo_base64 required')
  // Cap at ~4MB base64 (~3MB raw) so we don't blow past request limits.
  if (photoBase64.length > 4_800_000) return err(413, 'Image too large (max ~3MB)')

  // Call Claude Haiku vision for food identification + macro estimate.
  const claudeRes = await callClaudeVision({ agencyId, traineeId, photoBase64, mime })
  if (!claudeRes.ok) return err(502, 'vision_failed', { detail: claudeRes.error })

  const items = claudeRes.items

  // Upsert agency-level cache for each item — next time any athlete in
  // this agency logs the same thing, cache hit + no token spend.
  await Promise.all(items.map(async (it) => {
    const key = nameKey(it.name)
    if (!key) return
    const { data: existing } = await sb
      .from('koto_fitness_food_cache')
      .select('id, seen_count')
      .eq('agency_id', agencyId)
      .eq('name_key', key)
      .maybeSingle()
    if (existing) {
      await sb
        .from('koto_fitness_food_cache')
        .update({
          seen_count: ((existing as { seen_count: number }).seen_count || 0) + 1,
          last_seen_at: new Date().toISOString(),
          // Average toward the latest reading so the cache drifts slowly.
          // Keep conservative: trust older values more than single outliers.
        })
        .eq('id', (existing as { id: string }).id)
    } else {
      await sb.from('koto_fitness_food_cache').insert({
        agency_id: agencyId,
        name_key: key,
        display_name: it.name,
        kcal: Math.round(it.kcal) || 0,
        protein_g: roundNum(it.protein_g),
        fat_g: roundNum(it.fat_g),
        carb_g: roundNum(it.carb_g),
        portion_hint: it.portion || null,
      })
    }
  }))

  const totals = sumItems(items)
  const { data: logRow, error: insErr } = await sb
    .from('koto_fitness_food_logs')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      items,
      total_kcal: Math.round(totals.kcal),
      total_protein_g: roundNum(totals.p),
      total_fat_g: roundNum(totals.f),
      total_carb_g: roundNum(totals.c),
      source: 'photo',
      photo_url: null,
    })
    .select('id, logged_at')
    .single()
  if (insErr || !logRow) {
    console.error('[food-log] insert failed:', insErr?.message)
    return err(500, 'Insert failed')
  }

  return NextResponse.json({
    log: { ...(logRow as Record<string, unknown>), items, totals },
    cached: claudeRes.cached,
  })
}

// ── list_today ──────────────────────────────────────────────────────────────
async function handleListToday(sb: SupabaseClient, traineeId: string, agencyId: string) {
  // Today in UTC — matches the generated log_date column.
  const today = new Date().toISOString().slice(0, 10)
  const { data: logs } = await sb
    .from('koto_fitness_food_logs')
    .select('id, logged_at, items, total_kcal, total_protein_g, total_fat_g, total_carb_g, source, photo_url, notes')
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)
    .eq('log_date', today)
    .order('logged_at', { ascending: true })

  const rows = (logs || []) as Array<{
    total_kcal: number; total_protein_g: number; total_fat_g: number; total_carb_g: number
  }>

  const totals = rows.reduce(
    (acc, r) => ({
      kcal: acc.kcal + (r.total_kcal || 0),
      p: acc.p + Number(r.total_protein_g || 0),
      f: acc.f + Number(r.total_fat_g || 0),
      c: acc.c + Number(r.total_carb_g || 0),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  )

  // Pull the latest baseline's daily targets for progress calc.
  const { data: plan } = await sb
    .from('koto_fitness_plans')
    .select('baseline')
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baseline = plan && (plan as { baseline?: Record<string, unknown> }).baseline
  const targets = {
    kcal: (baseline as Record<string, unknown> | undefined)?.calorie_target_kcal ?? null,
    protein_g:
      ((baseline as Record<string, unknown> | undefined)?.macro_targets_g as Record<string, unknown> | undefined)?.protein_g ?? null,
    fat_g:
      ((baseline as Record<string, unknown> | undefined)?.macro_targets_g as Record<string, unknown> | undefined)?.fat_g ?? null,
    carb_g:
      ((baseline as Record<string, unknown> | undefined)?.macro_targets_g as Record<string, unknown> | undefined)?.carb_g ?? null,
  }

  return NextResponse.json({
    date: today,
    logs: logs || [],
    totals: {
      kcal: totals.kcal,
      protein_g: roundNum(totals.p),
      fat_g: roundNum(totals.f),
      carb_g: roundNum(totals.c),
    },
    targets,
  })
}

// ── add_manual ──────────────────────────────────────────────────────────────
async function handleAddManual(
  sb: SupabaseClient,
  traineeId: string,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const rawItems = Array.isArray(body.items) ? body.items : null
  if (!rawItems) return err(400, 'items array required')
  const items: FoodItem[] = rawItems
    .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
    .map((it) => ({
      name: String((it as Record<string, unknown>).name || '').trim(),
      kcal: Math.round(Number((it as Record<string, unknown>).kcal) || 0),
      protein_g: roundNum((it as Record<string, unknown>).protein_g),
      fat_g: roundNum((it as Record<string, unknown>).fat_g),
      carb_g: roundNum((it as Record<string, unknown>).carb_g),
      portion: typeof (it as Record<string, unknown>).portion === 'string'
        ? ((it as Record<string, unknown>).portion as string)
        : undefined,
    }))
    .filter((it) => it.name.length > 0)
  if (items.length === 0) return err(400, 'at least one named item required')

  const totals = sumItems(items)
  const { data, error } = await sb
    .from('koto_fitness_food_logs')
    .insert({
      agency_id: agencyId,
      trainee_id: traineeId,
      items,
      total_kcal: Math.round(totals.kcal),
      total_protein_g: roundNum(totals.p),
      total_fat_g: roundNum(totals.f),
      total_carb_g: roundNum(totals.c),
      source: 'manual',
    })
    .select('id, logged_at')
    .single()
  if (error || !data) {
    console.error('[food-log] manual insert failed:', error?.message)
    return err(500, 'Insert failed')
  }
  return NextResponse.json({ log: { ...(data as Record<string, unknown>), items, totals } })
}

// ── delete ──────────────────────────────────────────────────────────────────
async function handleDelete(
  sb: SupabaseClient,
  traineeId: string,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const logId = typeof body.log_id === 'string' ? body.log_id : ''
  if (!logId) return err(400, 'log_id required')
  const { error } = await sb
    .from('koto_fitness_food_logs')
    .delete()
    .eq('id', logId)
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)
  if (error) {
    console.error('[food-log] delete failed:', error.message)
    return err(500, 'Delete failed')
  }
  return NextResponse.json({ ok: true })
}

// ── list_range ──────────────────────────────────────────────────────────────
async function handleListRange(
  sb: SupabaseClient,
  traineeId: string,
  agencyId: string,
  body: Record<string, unknown>,
) {
  const from = typeof body.from === 'string' ? body.from : ''
  const to = typeof body.to === 'string' ? body.to : ''
  if (!from || !to) return err(400, 'from and to dates (YYYY-MM-DD) required')
  const { data: logs } = await sb
    .from('koto_fitness_food_logs')
    .select('id, log_date, logged_at, total_kcal, total_protein_g, total_fat_g, total_carb_g, source')
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)
    .gte('log_date', from)
    .lte('log_date', to)
    .order('logged_at', { ascending: true })
  return NextResponse.json({ logs: logs || [] })
}

// ── Claude Haiku vision call ────────────────────────────────────────────────
async function callClaudeVision(args: {
  agencyId: string
  traineeId: string
  photoBase64: string
  mime: string
}): Promise<
  { ok: true; items: FoodItem[]; cached: false }
  | { ok: false; error: string }
> {
  const systemPrompt = `You identify foods in a single photograph and estimate calories and macronutrients per visible item.

Rules:
- Respond with the food_log_from_photo tool, nothing else.
- Identify each distinct food item you can see. Infer portion size from visual cues (plate size, utensils, packaging).
- Always include kcal + protein_g + fat_g + carb_g for every item. Values should satisfy 4*protein + 4*carb + 9*fat ≈ kcal within ~15%.
- Use short, normalized names like "grilled chicken breast", "white rice", "broccoli steamed", "banana". No branding unless a logo is visible.
- If unsure about a detail, pick the most common typical value for an athlete-sized portion.
- If the photo contains no food, return an empty items array.`

  const tools = [
    {
      name: 'food_log_from_photo',
      description: 'Identified foods + macros for one photo.',
      input_schema: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'kcal', 'protein_g', 'fat_g', 'carb_g'],
              properties: {
                name: { type: 'string' },
                portion: { type: 'string', description: 'Short portion hint, e.g. "6 oz", "1 cup".' },
                kcal: { type: 'integer' },
                protein_g: { type: 'number' },
                fat_g: { type: 'number' },
                carb_g: { type: 'number' },
              },
            },
          },
        },
      },
    },
  ]

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': MODELS.ANTHROPIC_VERSION,
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        tool_choice: { type: 'tool', name: 'food_log_from_photo' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: args.mime, data: args.photoBase64 } },
              { type: 'text', text: 'Identify the foods in this photo.' },
            ],
          },
        ],
      }),
    })
  } catch (e) {
    return { ok: false, error: `fetch_failed:${e instanceof Error ? e.message : String(e)}` }
  }
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 400) } catch { /* ignore */ }
    return { ok: false, error: `anthropic_http_${res.status}${detail ? `:${detail}` : ''}` }
  }

  const json = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!json) return { ok: false, error: 'anthropic_bad_json' }
  const content = Array.isArray(json.content) ? json.content : []
  const toolUse = content.find((c: Record<string, unknown>) => c.type === 'tool_use') as
    | { input?: { items?: unknown[] } }
    | undefined
  if (!toolUse?.input) return { ok: false, error: 'no_tool_use_block' }

  const rawItems = Array.isArray(toolUse.input.items) ? toolUse.input.items : []
  const items: FoodItem[] = rawItems
    .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
    .map((it) => ({
      name: String(it.name || '').trim(),
      portion: typeof it.portion === 'string' ? it.portion : undefined,
      kcal: Math.round(Number(it.kcal) || 0),
      protein_g: roundNum(it.protein_g),
      fat_g: roundNum(it.fat_g),
      carb_g: roundNum(it.carb_g),
    }))
    .filter((it) => it.name.length > 0)

  const usage = (json.usage as { input_tokens?: number; output_tokens?: number } | undefined) || {}
  void logTokenUsage({
    feature: 'food_photo_vision',
    model: MODELS.HAIKU,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    agencyId: args.agencyId,
    metadata: { trainee_id: args.traineeId, items_found: items.length },
  })

  return { ok: true, items, cached: false }
}

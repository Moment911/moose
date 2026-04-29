import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/trainer/llm-rules
//
// CRUD for LLM prompt overrides. Stored in koto_llm_rules table.
// Auth: agency user (trainer/admin role).
//
// GET  → returns all rules as { rules: Record<string, string> }
// POST → { action: 'save', section_key: string, content: string }
//      → { action: 'reset', section_key: string }  (deletes override)
//      → { action: 'save_all', rules: Record<string, string> }
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

// The table is simple: section_key (PK), content (text), updated_at, updated_by.
// If it doesn't exist yet, we create it on first write.
async function ensureTable(sb: ReturnType<typeof getDb>) {
  // Try a read — if it fails with 42P01, table doesn't exist.
  // Admin must run the migration: supabase/migrations/20260429_koto_llm_rules.sql
  const { error } = await sb.from('koto_llm_rules').select('section_key').limit(1)
  if (error?.code === '42P01') {
    console.warn('[llm-rules] koto_llm_rules table does not exist. Run the migration.')
  }
}

export async function GET() {
  const sb = getDb()
  await ensureTable(sb)

  const { data, error: dbErr } = await sb
    .from('koto_llm_rules')
    .select('section_key, content, updated_at')
    .order('section_key')

  if (dbErr) {
    // Table might not exist yet — return empty
    return NextResponse.json({ rules: {} })
  }

  const rules: Record<string, string> = {}
  for (const row of (data || [])) {
    rules[row.section_key] = row.content
  }

  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const sb = getDb()
  await ensureTable(sb)

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch { return err(400, 'Invalid JSON') }

  const action = body.action as string

  if (action === 'save') {
    const key = body.section_key as string
    const content = body.content as string
    if (!key || typeof content !== 'string') return err(400, 'section_key and content required')

    const { error: upsertErr } = await sb
      .from('koto_llm_rules')
      .upsert({
        section_key: key,
        content,
        updated_at: new Date().toISOString(),
        updated_by: (body.updated_by as string) || null,
      }, { onConflict: 'section_key' })

    if (upsertErr) return err(500, upsertErr.message)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reset') {
    const key = body.section_key as string
    if (!key) return err(400, 'section_key required')
    await sb.from('koto_llm_rules').delete().eq('section_key', key)
    return NextResponse.json({ ok: true })
  }

  if (action === 'save_all') {
    const rules = body.rules as Record<string, string>
    if (!rules || typeof rules !== 'object') return err(400, 'rules object required')

    const rows = Object.entries(rules).map(([key, content]) => ({
      section_key: key,
      content,
      updated_at: new Date().toISOString(),
      updated_by: (body.updated_by as string) || null,
    }))

    const { error: upsertErr } = await sb
      .from('koto_llm_rules')
      .upsert(rows, { onConflict: 'section_key' })

    if (upsertErr) return err(500, upsertErr.message)
    return NextResponse.json({ ok: true })
  }

  return err(400, 'Unknown action')
}

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HELP_ARTICLES } from '@/lib/helpContent'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )
}

// ─────────────────────────────────────────────────────────────
// POST — upsert every help article from src/lib/helpContent.ts
// into koto_help_articles. Conflict key is `slug`.
// Safe to re-run: existing articles are updated in place.
// ─────────────────────────────────────────────────────────────
export async function POST(_req: NextRequest) {
  try {
    const s = sb()
    const rows = HELP_ARTICLES.map((a) => ({
      slug: a.slug,
      module: a.module,
      section: a.section || null,
      title: a.title,
      content: a.content,
      summary: a.summary,
      keywords: a.keywords,
      order_in_module: a.order_in_module,
      is_published: true,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await s
      .from('koto_help_articles')
      .upsert(rows, { onConflict: 'slug' })

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({
      ok: true,
      upserted: rows.length,
      modules: [...new Set(rows.map((r) => r.module))].length,
    })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

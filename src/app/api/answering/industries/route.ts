/**
 * GET /api/answering/industries
 *   Returns the list of industry templates (HVAC, Legal, Medical, Generic).
 *   Reads from koto_inbound_industries if populated, otherwise falls back to
 *   the bundled JSON in src/data/answeringIndustries/.
 *
 * POST /api/answering/industries  { slug }
 *   Upserts the builtin industry templates into koto_inbound_industries.
 *   Safe to call repeatedly -- used by scripts/seed-answering-industries.mjs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILTIN_INDUSTRIES, getIndustryBySlug } from '@/lib/answering/industries'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function GET() {
  const supabase = sb()
  const { data } = await supabase
    .from('koto_inbound_industries')
    .select('slug, display_name, default_greeting, topic_boundaries, intake_schema, default_routing_rules, llm_overrides, is_builtin, updated_at')
    .order('display_name', { ascending: true })

  if (data && data.length > 0) {
    return NextResponse.json({ industries: data, source: 'db' })
  }

  // Fallback: bundled defaults (pre-seed state)
  const industries = BUILTIN_INDUSTRIES.map(i => ({
    slug: i.slug,
    display_name: i.displayName,
    default_greeting: i.defaultGreeting,
    topic_boundaries: i.topicBoundaries || { allowed: [], forbidden: [] },
    intake_schema: i.intakeSchema || { fields: [] },
    default_routing_rules: (i as any).defaultRoutingRules || [],
    llm_overrides: (i as any).llmOverrides || {},
    is_builtin: true,
    updated_at: null,
  }))
  return NextResponse.json({ industries, source: 'bundled' })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action, slug } = body

  if (action === 'seed_all') {
    const supabase = sb()
    const rows = BUILTIN_INDUSTRIES.map(i => ({
      slug: i.slug,
      display_name: i.displayName,
      default_greeting: i.defaultGreeting,
      system_prompt_template: i.systemPromptTemplate,
      topic_boundaries: i.topicBoundaries || { allowed: [], forbidden: [] },
      intake_schema: i.intakeSchema || { fields: [] },
      default_routing_rules: (i as any).defaultRoutingRules || [],
      llm_overrides: (i as any).llmOverrides || {},
      is_builtin: true,
      updated_at: new Date().toISOString(),
    }))
    const { error, count } = await supabase
      .from('koto_inbound_industries')
      .upsert(rows, { onConflict: 'slug', count: 'exact' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ seeded: rows.length, count })
  }

  if (action === 'get_one' && slug) {
    const supabase = sb()
    const { data } = await supabase
      .from('koto_inbound_industries')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (data) return NextResponse.json({ industry: data })
    const fallback = getIndustryBySlug(slug)
    if (!fallback) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ industry: fallback, source: 'bundled' })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}

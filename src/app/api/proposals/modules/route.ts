import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agency_id  = searchParams.get('agency_id')
  const module_type = searchParams.get('type')
  const search     = searchParams.get('search')

  const sb = getSupabase()
  let q = sb.from('proposal_modules').select('*').eq('agency_id', agency_id).order('usage_count', { ascending: false })
  if (module_type && module_type !== 'all') q = q.eq('module_type', module_type)
  if (search) q = q.ilike('title', `%${search}%`)

  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also get voice profile
  const { data: voice } = await sb.from('proposal_voice_profile').select('*').eq('agency_id', agency_id).single()
  const { data: docs }  = await sb.from('proposal_source_docs').select('id,file_name,doc_type,modules_extracted,parsed_at,status').eq('agency_id', agency_id).order('created_at', { ascending: false }).limit(20)

  return NextResponse.json({ modules: data || [], voice_profile: voice, source_docs: docs || [] })
}

export async function POST(req: NextRequest) {
  const { action, agency_id, module_id, module, content } = await req.json()

  const sb = getSupabase()

  // Refine a module with AI
  if (action === 'refine') {
    const { data: voice } = await sb.from('proposal_voice_profile').select('*').eq('agency_id', agency_id).single()
    const { data: mod }   = await sb.from('proposal_modules').select('*').eq('id', module_id).single()
    if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

    const prompt = `You are refining a module for a marketing agency proposal.

AGENCY VOICE PROFILE:
${voice ? `Tone: ${voice.tone}\nStyle: ${voice.writing_style}\nCommon phrases: ${voice.common_phrases?.join(', ')}\nSample: ${voice.writing_sample}` : 'Professional and clear'}

ORIGINAL MODULE (${mod.module_type}):
${mod.content}

Rewrite this to be more professional, compelling, and polished while EXACTLY matching the agency's voice above.
Return ONLY the rewritten text — no commentary, no JSON.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    const refined = data.content?.[0]?.text?.trim()

    await sb.from('proposal_modules').update({ refined_content: refined }).eq('id', module_id)
    return NextResponse.json({ refined })
  }

  // Create new module manually
  if (action === 'create') {
    const { data, error } = await sb.from('proposal_modules').insert({ agency_id, ...module }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ module: data })
  }

  // Update module
  if (action === 'update') {
    const { data, error } = await sb.from('proposal_modules').update(module).eq('id', module_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ module: data })
  }

  // Delete module
  if (action === 'delete') {
    await sb.from('proposal_modules').delete().eq('id', module_id)
    return NextResponse.json({ ok: true })
  }

  // Toggle favorite
  if (action === 'favorite') {
    const { data: mod } = await sb.from('proposal_modules').select('is_favorite').eq('id', module_id).single()
    await sb.from('proposal_modules').update({ is_favorite: !mod?.is_favorite }).eq('id', module_id)
    return NextResponse.json({ is_favorite: !mod?.is_favorite })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

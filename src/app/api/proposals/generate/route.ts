import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const {
      agency_id,
      client_name,
      client_industry,
      doc_type,        // proposal|sow|agreement
      module_ids,      // selected module IDs to include
      custom_context,  // any extra context (project goals, special notes)
      refine_tone,     // additional tone instructions
    } = await req.json()

    if (!agency_id) return NextResponse.json({ error: 'agency_id required' }, { status: 400 })

    const sb = getSupabase()

    // Load selected modules
    const { data: modules } = await sb.from('proposal_modules')
      .select('*').in('id', module_ids || []).order('module_type')

    // Load voice profile
    const { data: voice } = await sb.from('proposal_voice_profile')
      .select('*').eq('agency_id', agency_id).single()

    // Load agency info
    const { data: agency } = await sb.from('agencies')
      .select('name,brand_name').eq('id', agency_id).single()

    const agencyName = agency?.brand_name || agency?.name || 'Your Agency'

    const modulesText = (modules || []).map(m =>
      `[${m.module_type.toUpperCase()}] ${m.title}\n${m.refined_content || m.content}`
    ).join('\n\n---\n\n')

    const prompt = `You are writing a ${doc_type} for ${agencyName}.

AGENCY VOICE PROFILE:
${voice ? `
Tone: ${voice.tone}
Style: ${voice.writing_style}
Common phrases they use: ${voice.common_phrases?.join(', ')}
How they present pricing: ${voice.pricing_style}
Signature elements they always include: ${voice.signature_elements?.join(', ')}
Writing sample (match this voice exactly): "${voice.writing_sample}"
` : 'Professional, clear, and confident.'}

CLIENT: ${client_name || 'the client'}
INDUSTRY: ${client_industry || 'their industry'}
DOCUMENT TYPE: ${doc_type}
${custom_context ? `ADDITIONAL CONTEXT: ${custom_context}` : ''}
${refine_tone ? `TONE INSTRUCTIONS: ${refine_tone}` : ''}

SELECTED MODULES TO INCLUDE:
${modulesText || '(No modules selected — generate a complete document from scratch based on voice profile)'}

Write a complete, polished ${doc_type} that:
1. Sounds EXACTLY like the agency's voice profile above
2. Is personalized for ${client_name || 'the client'}
3. Flows naturally — weave the modules together, don't just concatenate them
4. Includes a compelling intro and strong closing
5. Is professional, specific, and persuasive

Return the complete document as clean text (no JSON, no markdown headers, just the document).`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const generated = data.content?.[0]?.text?.trim()

    // Increment usage count on used modules
    if (module_ids?.length) {
      for (const id of module_ids) {
        const { data: mod } = await sb.from('proposal_modules').select('usage_count').eq('id', id).single()
        await sb.from('proposal_modules').update({ usage_count: (mod?.usage_count || 0) + 1 }).eq('id', id)
      }
    }

    return NextResponse.json({ generated, voice_profile: voice })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

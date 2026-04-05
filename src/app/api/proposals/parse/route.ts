import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Extract text from base64 file ────────────────────────────────────────────
function extractTextFromBase64(base64: string, fileType: string): string {
  // For plain text files, decode directly
  if (fileType === 'txt' || fileType === 'text/plain') {
    return Buffer.from(base64, 'base64').toString('utf-8')
  }
  // For PDF and DOCX, we pass the raw content to Claude with vision
  return base64
}

// ── Ask Claude to parse the document and extract modules ─────────────────────
async function parseDocumentWithClaude(text: string, fileName: string, docType: string, isBase64: boolean, mimeType: string) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const systemPrompt = `You are an expert at analyzing marketing agency proposals, SOWs, and agreements.
Your job is to extract reusable building blocks from uploaded documents so they can be saved as a module library.
You also analyze the writing style and voice to help generate future documents that match the author's style.
Be precise — extract actual text from the document, don't paraphrase.`

  const extractionPrompt = `Analyze this ${docType} document and extract all reusable modules.

For each module you find, identify:
- Its type (service, scope, deliverables, pricing, timeline, payment_terms, guarantee, intro, closing, legal, terms)  
- A clear title
- The exact content text
- Any pricing mentioned
- Relevant tags

Also analyze the overall writing style, tone, and voice.

Return ONLY valid JSON:
{
  "doc_summary": "1-2 sentence summary of what this document is",
  "doc_type": "proposal|sow|agreement",
  "voice_profile": {
    "tone": "professional|conversational|authoritative|friendly",
    "writing_style": "brief description of their writing style",
    "common_phrases": ["phrase 1", "phrase 2", "phrase 3"],
    "pricing_style": "how they present pricing",
    "signature_elements": ["things they always include"],
    "writing_sample": "a representative paragraph that captures their voice"
  },
  "modules": [
    {
      "module_type": "intro|service|scope|deliverables|pricing|timeline|payment_terms|guarantee|closing|legal",
      "title": "clear descriptive title",
      "content": "exact text from the document",
      "price_hint": null or numeric value,
      "price_type": null or "monthly|one_time|custom",
      "tags": ["tag1", "tag2"]
    }
  ]
}`

  let messageContent: any[]

  if (isBase64 && (mimeType === 'application/pdf' || mimeType.includes('pdf'))) {
    // Send as PDF document for Claude to read
    messageContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: text }
      },
      { type: 'text', text: extractionPrompt }
    ]
  } else {
    messageContent = [{ type: 'text', text: `DOCUMENT CONTENT:\n\n${text}\n\n${extractionPrompt}` }]
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${err}`)
  }

  const data = await res.json()
  let responseText = data.content?.[0]?.text?.trim() || '{}'
  responseText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  const s = responseText.indexOf('{'), e = responseText.lastIndexOf('}')
  if (s >= 0 && e > s) responseText = responseText.slice(s, e + 1)
  return JSON.parse(responseText)
}

// ── Save extracted modules and update voice profile ──────────────────────────
async function saveExtractedData(
  agencyId: string,
  docId: string,
  parsed: any
) {
  const sb = getSupabase()

  // Save modules
  const modules = (parsed.modules || []).map((m: any) => ({
    agency_id:    agencyId,
    source_doc_id: docId,
    module_type:  m.module_type || 'service',
    title:        m.title || 'Untitled Module',
    content:      m.content || '',
    tags:         m.tags || [],
    price_hint:   m.price_hint || null,
    price_type:   m.price_type || null,
  }))

  let savedCount = 0
  if (modules.length > 0) {
    const { data: inserted, error } = await sb.from('proposal_modules').insert(modules).select('id')
    if (!error) savedCount = inserted?.length || 0
  }

  // Update or create voice profile
  const vp = parsed.voice_profile
  if (vp) {
    const { data: existing } = await sb.from('proposal_voice_profile')
      .select('*').eq('agency_id', agencyId).single()

    if (existing) {
      // Merge with existing profile
      const mergedPhrases = [...new Set([...(existing.common_phrases || []), ...(vp.common_phrases || [])])]
      const mergedElements = [...new Set([...(existing.signature_elements || []), ...(vp.signature_elements || [])])]
      await sb.from('proposal_voice_profile').update({
        tone:               vp.tone || existing.tone,
        writing_style:      vp.writing_style || existing.writing_style,
        common_phrases:     mergedPhrases.slice(0, 20),
        pricing_style:      vp.pricing_style || existing.pricing_style,
        signature_elements: mergedElements.slice(0, 15),
        writing_sample:     vp.writing_sample || existing.writing_sample,
        doc_count:          (existing.doc_count || 0) + 1,
        last_updated:       new Date().toISOString(),
      }).eq('agency_id', agencyId)
    } else {
      await sb.from('proposal_voice_profile').insert({
        agency_id:          agencyId,
        tone:               vp.tone,
        writing_style:      vp.writing_style,
        common_phrases:     vp.common_phrases || [],
        pricing_style:      vp.pricing_style,
        signature_elements: vp.signature_elements || [],
        writing_sample:     vp.writing_sample,
        doc_count:          1,
      })
    }
  }

  return savedCount
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { agency_id, file_name, file_type, file_data, doc_type } = await req.json()

    if (!agency_id || !file_data) {
      return NextResponse.json({ error: 'agency_id and file_data required' }, { status: 400 })
    }

    const sb = getSupabase()

    // Create source doc record
    const { data: doc, error: docErr } = await sb.from('proposal_source_docs').insert({
      agency_id,
      file_name:  file_name || 'Untitled',
      file_type:  file_type || 'txt',
      doc_type:   doc_type || 'proposal',
      status:     'parsing',
    }).select().single()

    if (docErr) throw new Error(docErr.message)

    // Determine if we can send as PDF or must extract text
    const isPdf     = file_type?.includes('pdf')
    const isText    = file_type?.includes('text') || file_type?.includes('txt')
    const mimeType  = isPdf ? 'application/pdf' : 'text/plain'

    // For text files, decode; for PDFs pass base64 directly to Claude
    const content = isText
      ? Buffer.from(file_data, 'base64').toString('utf-8')
      : file_data

    // Parse with Claude
    const parsed = await parseDocumentWithClaude(content, file_name, doc_type || 'proposal', !isText, mimeType)

    // Save modules and update voice profile
    const savedCount = await saveExtractedData(agency_id, doc.id, parsed)

    // Update doc record as done
    await sb.from('proposal_source_docs').update({
      status:           'done',
      raw_text:         isText ? content : null,
      modules_extracted: savedCount,
      parsed_at:        new Date().toISOString(),
    }).eq('id', doc.id)

    return NextResponse.json({
      doc_id:           doc.id,
      modules_extracted: savedCount,
      doc_summary:      parsed.doc_summary,
      doc_type:         parsed.doc_type,
      voice_profile:    parsed.voice_profile,
      modules:          parsed.modules,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

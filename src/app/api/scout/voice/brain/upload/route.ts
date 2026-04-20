// Scout voice brain — PDF upload ingest.
//
// POST multipart form with fields:
//   file              (required)  PDF file, <= 20 MB
//   agency_id         (required)
//   scope             (optional, default 'global_pattern')
//   scope_value       (optional)
//   direction         (optional, default 'both')
//   source_label      (optional, defaults to filename)
//   max_facts         (optional, default 25)
//
// Flow:
//   1. Validate + size cap
//   2. Upload to Vercel Blob (keeps the source for audit/debug)
//   3. Parse PDF text with pdf-parse
//   4. Hand the extracted text to Claude Haiku with the same strict-JSON
//      extraction schema as /api/scout/voice ingest_knowledge
//   5. Insert facts into scout_voice_knowledge
//
// Requires env vars:
//   BLOB_READ_WRITE_TOKEN  (Vercel Blob)
//   ANTHROPIC_API_KEY      (fact extraction)
//   SUPABASE_SERVICE_ROLE_KEY

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 20 * 1024 * 1024
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const SYSTEM_PROMPT = `You extract high-leverage cold-calling knowledge from reference material into structured facts.

Read the material the user pastes and return a JSON array of fact objects:
[
  {
    "fact": "one concrete actionable statement — specific, testable, useful on a live call",
    "category": "pitch_angle | pain_point | objection_response | timing | decision_maker | hot_button | opener | closer",
    "confidence": 0.5 to 0.95
  },
  ...
]

Rules:
- Each fact is self-contained, no context needed to apply it mid-call.
- Skip generic platitudes ("build rapport", "be a good listener"). Only specifics.
- Skip facts the source contradicts or marks uncertain.
- Max 25 facts per pass. Pick the most useful.
- Return ONLY the JSON array, no prose.`

async function extractPdfText(buf: Buffer): Promise<string> {
  // pdf-parse is CommonJS and imports a debug helper at the module entry
  // that reads a local test PDF when not invoked from inside lib/. Require
  // the lib subpath directly to sidestep that behavior.
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (data: Buffer) => Promise<{ text: string }>
  const parsed = await pdfParse(buf)
  return parsed.text || ''
}

async function extractFactsWithClaude(text: string): Promise<any[]> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 60000) }],
    }),
  })
  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    throw new Error(`Claude ${resp.status} ${t.slice(0, 200)}`)
  }
  const data: any = await resp.json()
  const rawText: string = data?.content?.[0]?.text || '[]'
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed)) throw new Error('Claude did not return a JSON array')
  return parsed
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured — add it in Vercel env' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const agency_id = String(form.get('agency_id') || '')
  const scope = String(form.get('scope') || 'global_pattern')
  const scope_value = form.get('scope_value') ? String(form.get('scope_value')) : null
  const direction = String(form.get('direction') || 'both')
  const maxFacts = Math.min(Math.max(parseInt(String(form.get('max_facts') || '25'), 10) || 25, 1), 50)
  const source_label = form.get('source_label') ? String(form.get('source_label')) : (file?.name || null)

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!agency_id) return NextResponse.json({ error: 'agency_id is required' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `File too large (> 20 MB)` }, { status: 413 })
  if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported in this endpoint. Use the paste-text ingest for other formats.' }, { status: 400 })
  }

  const arrayBuf = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  // 1. Store the source file in Blob for audit / re-ingest
  let blobUrl: string | null = null
  try {
    const blob = await put(`scout-voice/brain/${agency_id}/${Date.now()}-${(file.name || 'ref.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`, buf, {
      access: 'public',
      contentType: 'application/pdf',
    })
    blobUrl = blob.url
  } catch (e: any) {
    // Non-fatal: proceed with extraction even if blob storage fails
  }

  // 2. Extract text
  let text = ''
  try {
    text = await extractPdfText(buf)
  } catch (e: any) {
    return NextResponse.json({ error: `PDF parse failed: ${e?.message || 'unknown'}` }, { status: 422 })
  }
  if (!text || text.trim().length < 40) {
    return NextResponse.json({ error: 'PDF contained no extractable text (scanned image? try OCR first)' }, { status: 422 })
  }

  // 3. Extract facts with Claude
  let facts: any[] = []
  try {
    facts = await extractFactsWithClaude(text)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Claude extraction failed' }, { status: 500 })
  }

  // 4. Insert into brain
  const rows = facts.slice(0, maxFacts).map((f: any) => ({
    agency_id,
    scope,
    scope_value,
    direction,
    source_system: 'pdf_upload',
    fact: String(f.fact || '').slice(0, 1000),
    fact_category: String(f.category || 'hot_button').slice(0, 60),
    confidence_score: Math.min(1, Math.max(0, Number(f.confidence) || 0.6)),
    times_confirmed: 1,
  })).filter((r: any) => r.fact.length > 10)

  if (rows.length === 0) {
    return NextResponse.json({
      inserted: 0,
      extracted_text_chars: text.length,
      blob_url: blobUrl,
      note: 'No useful facts extracted from this PDF',
    })
  }

  const s = sb()
  const { error } = await s.from('scout_voice_knowledge').insert(rows)
  if (error) return NextResponse.json({ error: error.message, blob_url: blobUrl }, { status: 500 })

  return NextResponse.json({
    inserted: rows.length,
    extracted_text_chars: text.length,
    source_label,
    blob_url: blobUrl,
  })
}

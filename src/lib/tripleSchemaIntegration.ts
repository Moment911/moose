// ─────────────────────────────────────────────────────────────
// tripleSchemaIntegration.ts
//
// Bridges the Triple Generator (semanticAgentsTier3) output into
// valid JSON-LD @graph structured data. Two entry points:
//
//   convertTriplesToSchema     — pure helper (triples → JSON-LD)
//   autoInjectSchemaFromPage   — action handler: fetch page, run
//                                triple generator, emit JSON-LD,
//                                persist to kotoiq_schema_audit.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { runTripleGenerator } from '@/lib/semanticAgentsTier3'

type SB = any
type AI = Anthropic

const MODEL = 'claude-sonnet-4-20250514'

export interface Triple {
  subject: string
  predicate: string
  object: string
  confidence?: number
}

export interface SchemaConversionParams {
  triples: Triple[]
  business_name: string
  page_url: string
  page_type: string // e.g. "LocalBusiness", "Service", "Article", "FAQPage"
  agencyId?: string
}

export interface SchemaConversionResult {
  json_ld: Record<string, any>
  schema_types_used: string[]
  entity_count: number
  relationship_count: number
  warnings: string[]
}

// ─────────────────────────────────────────────────────────────
// convertTriplesToSchema
// ─────────────────────────────────────────────────────────────
export async function convertTriplesToSchema(ai: AI, params: SchemaConversionParams): Promise<SchemaConversionResult> {
  const { triples, business_name, page_url, page_type, agencyId } = params

  if (!triples || triples.length === 0) {
    return {
      json_ld: { '@context': 'https://schema.org', '@graph': [] },
      schema_types_used: [],
      entity_count: 0,
      relationship_count: 0,
      warnings: ['No triples provided — returned empty @graph.'],
    }
  }

  // Group triples by subject so Claude can emit one entity per group.
  const bySubject: Record<string, Triple[]> = {}
  for (const t of triples) {
    if (!t.subject) continue
    const key = t.subject.trim()
    if (!bySubject[key]) bySubject[key] = []
    bySubject[key].push(t)
  }

  const grouped = Object.entries(bySubject).map(([subject, items]) => ({
    subject,
    relationships: items.map((i) => ({ predicate: i.predicate, object: i.object, confidence: i.confidence ?? 1 })),
  }))

  const systemPrompt = `You are a schema.org structured data expert. Convert subject-predicate-object knowledge graph triples into a valid JSON-LD @graph where each subject entity becomes its own node with proper @id, @type, and schema.org properties connecting entities by reference.

RULES:
1. Every node MUST have @type (one of schema.org's types) and @id (a URL or URN like "${page_url}#entity-slug").
2. Map triple predicates to the most appropriate schema.org property (e.g. "serves" → "areaServed", "located in" → "address", "has rating" → "aggregateRating").
3. When a triple's object matches another subject in the graph, reference it via { "@id": "..." } instead of inlining.
4. The top-level business entity's @id must be "${page_url}#business".
5. Prefer the page_type "${page_type}" as the @type of the primary business entity, unless triples strongly suggest a different type.
6. Deduplicate near-identical entities. Skip triples with confidence < 0.4.
7. Emit LocalBusiness properties (address, telephone, priceRange, openingHours) ONLY if a triple supplies them — never fabricate.

Return ONLY valid JSON:
{
  "json_ld": { "@context": "https://schema.org", "@graph": [ ... ] },
  "schema_types_used": ["LocalBusiness", "Service", ...],
  "warnings": ["any conversion issues"]
}`

  const userPrompt = `Business: ${business_name}
Page URL: ${page_url}
Target @type for primary entity: ${page_type}

Grouped triples (subject → relationships):
${JSON.stringify(grouped, null, 2)}`

  try {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_triple_to_schema',
      model: MODEL,
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId,
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = text.replace(/```json\s*|```\s*$/g, '').trim()
    const parsed = JSON.parse(cleaned)

    const graph: any[] = parsed.json_ld?.['@graph'] || []
    const entityCount = graph.length
    let relationshipCount = 0
    for (const node of graph) {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('@')) continue
        if (v && typeof v === 'object' && !Array.isArray(v) && ('@id' in (v as any))) relationshipCount += 1
        if (Array.isArray(v)) relationshipCount += (v as any[]).filter((x) => x && typeof x === 'object' && '@id' in x).length
      }
    }

    return {
      json_ld: parsed.json_ld || { '@context': 'https://schema.org', '@graph': [] },
      schema_types_used: parsed.schema_types_used || [],
      entity_count: entityCount,
      relationship_count: relationshipCount,
      warnings: parsed.warnings || [],
    }
  } catch (e: any) {
    return {
      json_ld: { '@context': 'https://schema.org', '@graph': [] },
      schema_types_used: [],
      entity_count: 0,
      relationship_count: 0,
      warnings: [`Conversion failed: ${e?.message || 'unknown error'}`],
    }
  }
}

// ─────────────────────────────────────────────────────────────
// autoInjectSchemaFromPage — action: auto_inject_schema_from_triples
// ─────────────────────────────────────────────────────────────
async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

export async function autoInjectSchemaFromPage(s: SB, ai: AI, body: {
  client_id: string
  agency_id?: string
  url?: string
  content?: string
  page_type?: string
  keyword?: string
}) {
  const { client_id, agency_id, url, content, page_type, keyword } = body
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!url && !content) return NextResponse.json({ error: 'Either url or content required' }, { status: 400 })

  const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  let pageContent = content || ''
  if (!pageContent && url) {
    pageContent = await fetchPageText(url)
  }
  if (!pageContent) return NextResponse.json({ error: 'Unable to retrieve page content' }, { status: 400 })

  const effectiveKeyword = keyword || client.primary_service || 'services'
  const effectiveUrl = url || client.website || 'https://example.com/'
  const effectivePageType = page_type || 'LocalBusiness'

  // Run the Triple Generator.
  let triplesResult: any = null
  try {
    triplesResult = await runTripleGenerator(ai, {
      content: pageContent,
      keyword: effectiveKeyword,
      business_name: client.name || '',
      agencyId: agency_id,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Triple extraction failed', detail: e?.message }, { status: 500 })
  }

  const triples: Triple[] = triplesResult?.triples || []

  const schemaResult = await convertTriplesToSchema(ai, {
    triples,
    business_name: client.name || '',
    page_url: effectiveUrl,
    page_type: effectivePageType,
    agencyId: agency_id,
  })

  // Persist into kotoiq_schema_audit for this URL if an entry exists.
  if (url) {
    try {
      const { data: existing } = await s
        .from('kotoiq_schema_audit')
        .select('id, generated_schemas')
        .eq('client_id', client_id)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        const arr: any[] = Array.isArray(existing.generated_schemas) ? existing.generated_schemas : []
        const filtered = arr.filter((g) => g?.url !== url)
        filtered.push({
          url,
          type: effectivePageType,
          json_ld: schemaResult.json_ld,
          source: 'triple_generator',
          generated_at: new Date().toISOString(),
        })
        await s.from('kotoiq_schema_audit').update({ generated_schemas: filtered }).eq('id', existing.id)
      }
    } catch {
      // Non-fatal — we still return the generated schema.
    }
  }

  return NextResponse.json({
    json_ld: schemaResult.json_ld,
    schema_types_used: schemaResult.schema_types_used,
    entity_count: schemaResult.entity_count,
    relationship_count: schemaResult.relationship_count,
    warnings: schemaResult.warnings,
    triples_used: triples.length,
  })
}

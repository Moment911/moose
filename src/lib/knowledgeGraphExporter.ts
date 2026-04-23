// ─────────────────────────────────────────────────────────────
// knowledgeGraphExporter.ts
//
// Generates a Wikidata-ready / JSON-LD / RDF-Turtle submission
// package for a business entity. Synthesizes facts from the
// clients row, extracted triples, review intelligence, GBP data,
// and existing schema audits — then calls Claude to emit the
// requested output format plus a plain-English submission guide.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

type SB = any
type AI = Anthropic

const MODEL = 'claude-sonnet-4-20250514'

export type ExportFormat = 'wikidata' | 'json_ld' | 'rdf_turtle'

export interface KnowledgeGraphExportBody {
  client_id: string
  agency_id?: string
  export_format?: ExportFormat
}

// ─────────────────────────────────────────────────────────────
// Gather everything we know about the entity
// ─────────────────────────────────────────────────────────────
async function gatherEntityFacts(s: SB, client_id: string) {
  const [
    { data: client },
    { data: reviewIntel },
    { data: schemaAudit },
    { data: backlinkProfile },
    { data: topicalMap },
    { data: brandSerp },
    { data: enrichmentLog },
  ] = await Promise.all([
    s.from('clients').select('*').eq('id', client_id).maybeSingle(),
    s.from('kotoiq_review_intelligence').select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle().then((r: any) => r).catch(() => ({ data: null })),
    s.from('kotoiq_schema_audit').select('generated_schemas, schema_types').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_backlink_profile').select('domain_authority, total_referring_domains, edu_gov_links, trust_rank_estimate').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_topical_maps').select('central_entity, source_context, central_search_intent, overall_authority_score').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_brand_serp').select('has_knowledge_panel, kp_description, kp_source, kp_attributes').eq('client_id', client_id).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('kotoiq_sync_log').select('metadata').eq('client_id', client_id).eq('source', 'deep_enrich').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return { client, reviewIntel, schemaAudit, backlinkProfile, topicalMap, brandSerp, enrichment: enrichmentLog?.metadata || null }
}

function safeString(v: any): string {
  if (v == null) return ''
  return String(v).trim()
}

// ─────────────────────────────────────────────────────────────
// Deterministic KP likelihood score — not a guess from the LLM.
// Rewards signals that historically correlate with Google
// surfacing a Knowledge Panel for the entity.
// ─────────────────────────────────────────────────────────────
function scoreKnowledgePanelLikelihood(facts: any): number {
  let score = 0
  const c = facts.client || {}
  // Basic entity facts
  if (safeString(c.name)) score += 8
  if (safeString(c.website)) score += 8
  if (safeString(c.phone)) score += 6
  const hasAddress = safeString(c.street) || safeString(c.address) || safeString(c.city)
  if (hasAddress) score += 8
  if (safeString(c.industry) || safeString(c.primary_service)) score += 6
  // Schema
  const schemaTypes = facts.schemaAudit?.schema_types || {}
  if (Object.keys(schemaTypes).length > 0) score += 10
  // Backlinks / authority
  const da = Number(facts.backlinkProfile?.domain_authority || 0)
  score += Math.min(15, da * 0.3)
  if (Number(facts.backlinkProfile?.edu_gov_links || 0) > 0) score += 5
  // Topical authority
  score += Math.min(10, Number(facts.topicalMap?.overall_authority_score || 0) * 0.1)
  // Reviews (Google reviews are a huge KP trigger)
  const reviewCount = Number(facts.reviewIntel?.total_reviews || 0)
  if (reviewCount >= 50) score += 10
  else if (reviewCount >= 10) score += 5
  // Already has a KP
  if (facts.brandSerp?.has_knowledge_panel) score += 15
  return Math.min(100, Math.round(score * 100) / 100)
}

// ─────────────────────────────────────────────────────────────
// Extract flat property list from whatever we have
// ─────────────────────────────────────────────────────────────
function buildEntityProperties(facts: any): { name: string; value: string; source: string }[] {
  const c = facts.client || {}
  const props: { name: string; value: string; source: string }[] = []
  const push = (name: string, value: any, source: string) => {
    const v = safeString(value)
    if (v) props.push({ name, value: v, source })
  }
  push('name', c.name, 'clients')
  push('website', c.website, 'clients')
  push('telephone', c.phone, 'clients')
  push('email', c.email, 'clients')
  push('industry', c.industry || c.primary_service, 'clients')
  push('description', c.welcome_statement || c.business_description, 'clients')
  push('address_street', c.street || c.address, 'clients')
  push('address_city', c.city || c.primary_city, 'clients')
  push('address_state', c.state, 'clients')
  push('address_postal_code', c.zip || c.postal_code, 'clients')
  push('address_country', c.country || 'United States', 'clients')
  push('coordinates_lat', c.latitude, 'clients')
  push('coordinates_lng', c.longitude, 'clients')
  if (facts.reviewIntel?.total_reviews) push('review_count', String(facts.reviewIntel.total_reviews), 'kotoiq_review_intelligence')
  if (facts.reviewIntel?.average_rating) push('aggregate_rating', String(facts.reviewIntel.average_rating), 'kotoiq_review_intelligence')
  if (facts.topicalMap?.central_entity) push('primary_topic', facts.topicalMap.central_entity, 'kotoiq_topical_maps')
  if (facts.brandSerp?.kp_description) push('kp_description', facts.brandSerp.kp_description, 'kotoiq_brand_serp')
  return props
}

// ─────────────────────────────────────────────────────────────
// exportKnowledgeGraph — action: export_knowledge_graph
// ─────────────────────────────────────────────────────────────
export async function exportKnowledgeGraph(s: SB, ai: AI, body: KnowledgeGraphExportBody) {
  const { client_id, agency_id } = body
  const export_format: ExportFormat = body.export_format || 'wikidata'
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const facts = await gatherEntityFacts(s, client_id)
  if (!facts.client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const props = buildEntityProperties(facts)
  const kpLikelihood = scoreKnowledgePanelLikelihood(facts)

  const industryLabel = safeString(facts.client.industry) || safeString(facts.client.primary_service) || 'business'

  const systemByFormat: Record<ExportFormat, string> = {
    wikidata: `You are a Wikidata curator. Generate a valid QuickStatements v1 submission for this business entity using P-codes. Only use properties where the data actually exists — never invent values.

Common P-codes:
- P31 (instance of) — e.g. Q4830453 (business), Q2385804 (educational institution), Q484170 (commune)
- P17 (country) — e.g. Q30 (United States)
- P131 (located in administrative territorial entity) — city/county QID
- P625 (coordinate location) — @LAT/LNG
- P856 (official website)
- P1329 (phone number)
- P968 (email)
- P112 (founded by)
- P571 (inception)
- P452 (industry)
- P1435 (heritage designation)
- P18 (image)

If you don't know the correct QID for a value, leave it as a LABEL-based entry prefixed with "Q?" so the submitter can look it up. Annotate every line with a source reference (URL from the data).

Return JSON: { "content": "QuickStatements block as plain text", "entity_properties": [{"p_code":"P31","value":"Q4830453","label":"business","source":"clients.industry"}], "related_entities": [{"qid_or_label":"Q30","relationship":"country"}], "submission_guide_markdown": "step-by-step markdown guide" }`,
    json_ld: `You are a schema.org structured data expert. Emit a comprehensive Organization (or LocalBusiness) JSON-LD record using every property where real data exists. Include sameAs links to Wikipedia/Wikidata if appropriate, aggregateRating if reviews present, address as a PostalAddress, and openingHoursSpecification only if data exists. Never fabricate.

Return JSON: { "content": "full JSON-LD as a pretty-printed string", "entity_properties": [{"property":"name","value":"..."}], "related_entities": [{"entity":"...","relationship":"..."}], "submission_guide_markdown": "markdown explaining where to publish this JSON-LD" }`,
    rdf_turtle: `You are an RDF specialist. Emit valid RDF/Turtle using schema.org and foaf vocabularies. Define a prefix block, then describe the business entity with every property that has real data. Never fabricate.

Return JSON: { "content": "valid Turtle as a string", "entity_properties": [{"predicate":"schema:name","value":"..."}], "related_entities": [{"entity":"...","relationship":"..."}], "submission_guide_markdown": "markdown guide" }`,
  }

  const prompt = `BUSINESS FACTS (only include what exists — never invent):
${JSON.stringify(props, null, 2)}

TOPICAL MAP SIGNAL: ${JSON.stringify(facts.topicalMap || {}, null, 2)}
REVIEW SIGNAL: ${JSON.stringify(facts.reviewIntel ? { total: facts.reviewIntel.total_reviews, rating: facts.reviewIntel.average_rating, sentiment: facts.reviewIntel.overall_sentiment } : {}, null, 2)}
BRAND SERP SIGNAL: ${JSON.stringify(facts.brandSerp ? { has_kp: facts.brandSerp.has_knowledge_panel, kp_desc: facts.brandSerp.kp_description } : {}, null, 2)}

Industry for typing: ${industryLabel}

Produce the ${export_format} output per the format rules above. Return ONLY valid JSON, no markdown fences.`

  let parsed: any = null
  try {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 5000,
      temperature: 0.2,
      system: systemByFormat[export_format],
      messages: [{ role: 'user', content: prompt }],
    })
    void logTokenUsage({
      feature: 'kotoiq_knowledge_graph_export',
      model: MODEL,
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id,
      metadata: { client_id, format: export_format },
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = text.replace(/```(?:json)?\s*|```\s*$/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate export', detail: e?.message }, { status: 500 })
  }

  const contentStr: string = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2)
  const entityProps: any[] = parsed.entity_properties || props
  const relatedEntities: any[] = parsed.related_entities || []
  const submissionGuide: string = parsed.submission_guide_markdown || buildFallbackSubmissionGuide(export_format, facts.client)

  const insertRow = {
    client_id,
    format: export_format,
    content: contentStr,
    entity_properties: entityProps,
    related_entities: relatedEntities,
    kp_likelihood: kpLikelihood,
    submitted_to_wikidata: false,
    wikidata_entry_id: null,
  }

  let export_id: string | null = null
  try {
    const { data: saved } = await s.from('kotoiq_knowledge_graph_exports').insert(insertRow).select().single()
    if (saved) export_id = saved.id
  } catch { /* table may not exist yet — non-fatal, still return results */ }

  return NextResponse.json({
    export_id,
    format: export_format,
    content: contentStr,
    entity_properties: entityProps,
    related_entities: relatedEntities,
    submission_guide_markdown: submissionGuide,
    estimated_knowledge_panel_trigger_likelihood: kpLikelihood,
  })
}

// ─────────────────────────────────────────────────────────────
// Fallback submission guide if Claude omits it
// ─────────────────────────────────────────────────────────────
function buildFallbackSubmissionGuide(format: ExportFormat, client: any): string {
  const name = safeString(client?.name) || 'Your business'
  if (format === 'wikidata') {
    return `## Submitting ${name} to Wikidata

1. Create an account at https://www.wikidata.org and verify email.
2. Confirm notability: the entity must be covered by multiple independent reliable sources (local news, industry publications). Wikidata follows the notability policy at https://www.wikidata.org/wiki/Wikidata:Notability.
3. Open the QuickStatements tool at https://quickstatements.toolforge.org — sign in with your Wikidata account.
4. Paste the QuickStatements block from the "content" field into the input box.
5. Replace any Q? placeholders with the correct QIDs. Use Wikidata's search to find them (e.g. your city's QID, industry QID).
6. Add at least one source reference on every statement (use P248 or P854 with a URL).
7. Submit the batch and wait for Wikidata's review.
8. Once approved, link the new Wikidata entry from your website via \`<link rel="sameAs" href="https://www.wikidata.org/wiki/Q_YOUR_ID">\` in the <head> of your homepage.
9. Add the Wikidata ID to your Organization JSON-LD \`sameAs\` array so Google can connect the entity to your site.`
  }
  if (format === 'json_ld') {
    return `## Publishing the Organization JSON-LD for ${name}

1. Copy the content field into a <script type="application/ld+json"></script> tag.
2. Place the script tag in the <head> of your homepage and any About / Contact pages.
3. Validate with Google's Rich Results Test at https://search.google.com/test/rich-results.
4. Validate with Schema.org's validator at https://validator.schema.org.
5. Monitor Search Console's Enhancements panel for structured data warnings.
6. Add sameAs links to any social profiles, Wikidata (if any), Wikipedia, official industry registries — these strengthen entity connections.`
  }
  return `## Publishing the RDF/Turtle export for ${name}

1. Save the content field to a .ttl file.
2. Upload to a public endpoint (e.g. your CDN or a SPARQL endpoint).
3. Link to the Turtle file from your homepage using \`<link rel="alternate" type="text/turtle" href="...">\`.
4. Validate at https://ttl.summerofcode.be or with the W3C RDF Validator.
5. Consider submitting to public knowledge bases like DBpedia or Wikidata for increased entity visibility.`
}

import 'server-only'
// ── Schema & Structured Data Intelligence Engine ────────────────────────────
// Audits JSON-LD structured data across a site, identifies gaps,
// generates missing schemas. Called from /api/kotoiq route.

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'
import { getSitemapUrls as getSitemapUrlsCached, getLatestCrawl } from '@/lib/sitemapCrawler'

// ── Types ───────────────────────────────────────────────────────────────────
interface SchemaInstance {
  url: string
  type: string
  valid: boolean
  errors: string[]
  raw: any
}

interface SchemaOpportunity {
  url: string
  recommended_type: string
  reason: string
  potential_ctr_lift: string
}

interface SemanticIssue {
  element: string
  issue: string
  suggestion: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractJsonLd(html: string): any[] {
  const schemas: any[] = []
  const matches = html.matchAll(/<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1])
      // Handle @graph arrays
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        schemas.push(...parsed['@graph'].map((item: any) => ({ ...item, '@context': parsed['@context'] || 'https://schema.org' })))
      } else {
        schemas.push(parsed)
      }
    } catch {
      // Invalid JSON-LD — record as error
      schemas.push({ _parseError: true, _raw: m[1].slice(0, 200) })
    }
  }
  return schemas
}

// Required fields per schema type (simplified schema.org spec)
const REQUIRED_FIELDS: Record<string, string[]> = {
  LocalBusiness: ['name', 'address', 'telephone'],
  Organization: ['name', 'url'],
  Article: ['headline', 'author', 'datePublished'],
  BlogPosting: ['headline', 'author', 'datePublished'],
  FAQPage: ['mainEntity'],
  Product: ['name', 'offers'],
  Service: ['name', 'provider'],
  BreadcrumbList: ['itemListElement'],
  HowTo: ['name', 'step'],
  Review: ['itemReviewed', 'author'],
  WebPage: ['name'],
  Person: ['name'],
  Event: ['name', 'startDate', 'location'],
}

function validateSchema(schema: any): string[] {
  if (schema._parseError) return ['Invalid JSON — could not parse']
  const type = schema['@type']
  if (!type) return ['Missing @type field']
  const required = REQUIRED_FIELDS[type] || []
  const missing = required.filter(f => !schema[f])
  const errors: string[] = []
  if (missing.length > 0) errors.push(`Missing required fields: ${missing.join(', ')}`)
  if (!schema['@context']) errors.push('Missing @context — should be "https://schema.org"')
  return errors
}

function detectPageType(html: string, url: string): string[] {
  const lc = html.toLowerCase()
  const types: string[] = []

  if (/faq|frequently.asked|common.questions/i.test(lc)) types.push('FAQPage')
  if (/blog|article|news|post/i.test(url) || /<article/i.test(html)) types.push('Article')
  if (/service|what.we.do|our.services/i.test(lc)) types.push('Service')
  if (/product|shop|store|price|add.to.cart/i.test(lc)) types.push('Product')
  if (/how.to|step.by.step|tutorial|guide/i.test(lc)) types.push('HowTo')
  if (/review|testimonial/i.test(lc) && /rating|star|\/5/i.test(lc)) types.push('Review')
  if (/about.us|about-us|team|our.story/i.test(lc)) types.push('Organization')
  if (/contact|location|address|phone/i.test(lc)) types.push('LocalBusiness')

  return types
}

function checkSemanticHtml(html: string): { score: number; issues: SemanticIssue[] } {
  const issues: SemanticIssue[] = []
  let score = 100

  const hasMain = /<main[\s>]/i.test(html)
  if (!hasMain) { issues.push({ element: '<main>', issue: 'Missing <main> landmark', suggestion: 'Wrap primary content in <main> for accessibility and SEO' }); score -= 15 }

  const hasNav = /<nav[\s>]/i.test(html)
  if (!hasNav) { issues.push({ element: '<nav>', issue: 'Missing <nav> element', suggestion: 'Use <nav> for navigation menus' }); score -= 10 }

  const hasHeader = /<header[\s>]/i.test(html)
  if (!hasHeader) { issues.push({ element: '<header>', issue: 'Missing <header> element', suggestion: 'Use <header> for page/section headers' }); score -= 10 }

  const hasFooter = /<footer[\s>]/i.test(html)
  if (!hasFooter) { issues.push({ element: '<footer>', issue: 'Missing <footer> element', suggestion: 'Use <footer> for page footer content' }); score -= 10 }

  const hasArticle = /<article[\s>]/i.test(html)
  const hasBlogContent = /blog|post|article|news/i.test(html)
  if (hasBlogContent && !hasArticle) { issues.push({ element: '<article>', issue: 'Blog-like content without <article> element', suggestion: 'Wrap blog posts in <article> for semantic clarity' }); score -= 10 }

  const hasSection = /<section[\s>]/i.test(html)
  if (!hasSection) { issues.push({ element: '<section>', issue: 'No <section> elements used', suggestion: 'Use <section> to group thematically related content' }); score -= 5 }

  // Check for div-soup
  const divCount = (html.match(/<div/gi) || []).length
  const semanticCount = (html.match(/<(?:main|nav|header|footer|article|section|aside)[\s>]/gi) || []).length
  if (divCount > 50 && semanticCount < 5) {
    issues.push({ element: 'div', issue: 'Excessive <div> usage with minimal semantic elements', suggestion: 'Replace generic <div> wrappers with semantic HTML5 elements' })
    score -= 15
  }

  // H1 check
  const h1Count = (html.match(/<h1/gi) || []).length
  if (h1Count === 0) { issues.push({ element: '<h1>', issue: 'Missing H1 heading', suggestion: 'Add exactly one H1 element per page' }); score -= 15 }
  if (h1Count > 1) { issues.push({ element: '<h1>', issue: `Multiple H1 headings (${h1Count})`, suggestion: 'Use only one H1 per page — use H2-H6 for subsections' }); score -= 10 }

  return { score: Math.max(0, score), issues }
}

// ── Fetch sitemap URLs ──────────────────────────────────────────────────────
async function getSitemapUrls(website: string, maxUrls: number = 100): Promise<string[]> {
  const base = website.replace(/\/$/, '')
  const sitemapUrls = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`]
  const urls: Set<string> = new Set()

  for (const sitemapUrl of sitemapUrls) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const xml = await res.text()

      // Extract URLs from <loc> tags
      const locMatches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)
      for (const m of locMatches) {
        const u = m[1].trim()
        // Skip sub-sitemaps for now — just get direct page URLs
        if (u.endsWith('.xml')) {
          // Try fetching sub-sitemap
          try {
            const subRes = await fetch(u, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' },
              signal: AbortSignal.timeout(8000),
            })
            if (subRes.ok) {
              const subXml = await subRes.text()
              const subLocs = subXml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)
              for (const sm of subLocs) {
                if (!sm[1].endsWith('.xml')) urls.add(sm[1].trim())
                if (urls.size >= maxUrls) break
              }
            }
          } catch { /* skip failed sub-sitemaps */ }
        } else {
          urls.add(u)
        }
        if (urls.size >= maxUrls) break
      }
      if (urls.size > 0) break // got URLs from first sitemap
    } catch { /* try next sitemap URL */ }
  }

  // Fallback: if no sitemap, just use homepage
  if (urls.size === 0) {
    urls.add(base)
    urls.add(`${base}/about`)
    urls.add(`${base}/services`)
    urls.add(`${base}/contact`)
    urls.add(`${base}/blog`)
  }

  return Array.from(urls).slice(0, maxUrls)
}

// ── Process a batch of URLs in parallel ──────────────────────────────────────
async function processBatch(urls: string[]): Promise<{
  schemas: SchemaInstance[]
  pagesWithSchema: number
  pagesWithout: number
  pageTypes: Map<string, string[]> // url -> eligible types
  semanticScores: number[]
  semanticIssues: SemanticIssue[]
}> {
  const schemas: SchemaInstance[] = []
  let pagesWithSchema = 0
  let pagesWithout = 0
  const pageTypes = new Map<string, string[]>()
  const semanticScores: number[] = []
  const allSemanticIssues: SemanticIssue[] = []

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const html = await fetchPage(url)
      if (!html) return { url, html: null }
      return { url, html }
    })
  )

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value.html) continue
    const { url, html } = result.value

    const jsonLd = extractJsonLd(html)
    if (jsonLd.length > 0) {
      pagesWithSchema++
      for (const schema of jsonLd) {
        const type = schema['@type'] || (schema._parseError ? 'PARSE_ERROR' : 'Unknown')
        const errors = validateSchema(schema)
        schemas.push({ url, type, valid: errors.length === 0, errors, raw: schema })
      }
    } else {
      pagesWithout++
    }

    // Detect eligible schema types not yet implemented
    const existingTypes = jsonLd.map(s => s['@type']).filter(Boolean)
    const eligible = detectPageType(html, url).filter(t => !existingTypes.includes(t))
    if (eligible.length > 0) pageTypes.set(url, eligible)

    // Semantic HTML check (sample first 20 pages)
    if (semanticScores.length < 20) {
      const sem = checkSemanticHtml(html)
      semanticScores.push(sem.score)
      if (sem.issues.length > 0 && allSemanticIssues.length < 15) {
        allSemanticIssues.push(...sem.issues.slice(0, 3))
      }
    }
  }

  return { schemas, pagesWithSchema, pagesWithout, pageTypes, semanticScores, semanticIssues: allSemanticIssues }
}

// ── Main audit function ─────────────────────────────────────────────────────
export async function auditSchema(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; agency_id?: string; url_limit?: number }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  // url_limit body param — default 1000, max 10,000 (schema audit expanded from 100)
  const urlLimit = Math.min(Math.max(parseInt(String(body.url_limit)) || 1000, 1), 10000)

  const { data: client } = await s.from('clients').select('name, website, primary_service').eq('id', client_id).single()
  if (!client?.website) throw new Error('No website found for client — set it on the client record first')

  const website = client.website.replace(/\/$/, '')

  // 1. Get URLs — prefer cached sitemap crawl; fall back to live fetch
  let urls: string[] = []
  try {
    const latestCrawl = await getLatestCrawl(s as any, client_id).catch(() => null)
    if (latestCrawl?.status === 'complete' && (latestCrawl.urls_saved || 0) > 0) {
      const result = await getSitemapUrlsCached(s as any, { client_id, limit: urlLimit, orderBy: 'priority' })
      urls = (result.urls || []).map((u: any) => u.url).filter(Boolean)
    }
  } catch { /* fall through */ }
  if (urls.length === 0) {
    urls = await getSitemapUrls(website, urlLimit)
  }

  // Create processing job for progress tracking
  let jobId: string | null = null
  try {
    const { data: job } = await s.from('kotoiq_processing_jobs').insert({
      client_id,
      engine: 'schema',
      status: 'running',
      total_urls: urls.length,
      processed_urls: 0,
      started_at: new Date().toISOString(),
    }).select().single()
    jobId = job?.id || null
  } catch { /* non-critical */ }

  // 2. Process in concurrent chunks of 10 with job progress
  const allSchemas: SchemaInstance[] = []
  let totalWith = 0
  let totalWithout = 0
  const allPageTypes = new Map<string, string[]>()
  const allSemanticScores: number[] = []
  let allSemanticIssues: SemanticIssue[] = []

  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10)
    const result = await processBatch(batch)
    allSchemas.push(...result.schemas)
    totalWith += result.pagesWithSchema
    totalWithout += result.pagesWithout
    for (const [url, types] of result.pageTypes) allPageTypes.set(url, types)
    allSemanticScores.push(...result.semanticScores)
    if (allSemanticIssues.length < 15) allSemanticIssues.push(...result.semanticIssues)
    if (jobId) {
      try {
        await s.from('kotoiq_processing_jobs').update({
          processed_urls: Math.min(i + 10, urls.length),
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
      } catch { /* non-critical */ }
    }
  }

  // 3. Aggregate schema types
  const typeCount: Record<string, number> = {}
  for (const schema of allSchemas) {
    typeCount[schema.type] = (typeCount[schema.type] || 0) + 1
  }

  // 4. Collect errors
  const schemaErrors = allSchemas
    .filter(s => s.errors.length > 0)
    .map(s => ({ url: s.url, type: s.type, errors: s.errors }))
    .slice(0, 20)

  // 5. Build eligible-not-implemented list
  const eligible: SchemaOpportunity[] = []
  const ctrLifts: Record<string, string> = {
    FAQPage: '15-25%', Article: '5-15%', Service: '10-20%', Product: '15-30%',
    HowTo: '20-35%', Review: '10-20%', LocalBusiness: '15-25%', Organization: '5-10%',
  }
  for (const [url, types] of allPageTypes) {
    for (const type of types) {
      eligible.push({
        url,
        recommended_type: type,
        reason: `Page content matches ${type} schema pattern`,
        potential_ctr_lift: ctrLifts[type] || '5-15%',
      })
    }
    if (eligible.length >= 30) break
  }

  // 6. Generate schemas for top opportunities using Claude (up to 10)
  const toGenerate = eligible.slice(0, 10)
  const generatedSchemas: { url: string; type: string; json_ld: any }[] = []

  if (toGenerate.length > 0) {
    const genPrompt = `Generate JSON-LD structured data for these pages.

BUSINESS: ${client.name || 'Unknown'}
WEBSITE: ${website}
SERVICE: ${client.primary_service || 'General business'}

PAGES NEEDING SCHEMA:
${toGenerate.map((t, i) => `${i + 1}. URL: ${t.url} — Type: ${t.recommended_type}`).join('\n')}

For each page, generate a valid, production-ready JSON-LD schema object.

Return ONLY a valid JSON array:
[
  {"url": "...", "type": "...", "schema": {"@context": "https://schema.org", "@type": "...", ...}},
  ...
]`

    try {
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'Generate production-ready JSON-LD schema markup. Return ONLY valid JSON array.',
        messages: [{ role: 'user', content: genPrompt }],
      })

      void logTokenUsage({
        feature: 'kotoiq_schema',
        model: 'claude-sonnet-4-20250514',
        inputTokens: msg.usage?.input_tokens || 0,
        outputTokens: msg.usage?.output_tokens || 0,
        agencyId: body.agency_id || null,
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          generatedSchemas.push({ url: item.url, type: item.type, json_ld: item.schema })
        }
      }
    } catch {
      // Schema generation failed — non-critical, continue without generated schemas
    }
  }

  // 7. Calculate overall score
  const totalPages = totalWith + totalWithout
  const coveragePct = totalPages > 0 ? Math.round((totalWith / totalPages) * 100) : 0
  const errorRate = allSchemas.length > 0 ? schemaErrors.length / allSchemas.length : 0
  const semanticHtmlScore = allSemanticScores.length > 0
    ? Math.round(allSemanticScores.reduce((a, b) => a + b, 0) / allSemanticScores.length)
    : 50

  const overallScore = Math.round(
    coveragePct * 0.35 +
    (1 - errorRate) * 100 * 0.25 +
    semanticHtmlScore * 0.20 +
    Math.min(Object.keys(typeCount).length * 10, 100) * 0.20
  )

  // 8. Save to database
  const record = {
    client_id,
    total_pages_with_schema: totalWith,
    total_pages_without: totalWithout,
    coverage_pct: coveragePct,
    schema_types: typeCount,
    schema_errors: schemaErrors,
    eligible_not_implemented: eligible,
    competitor_schemas: {}, // placeholder for future competitor analysis
    missing_vs_competitors: {},
    semantic_html_score: semanticHtmlScore,
    semantic_issues: allSemanticIssues.slice(0, 15),
    generated_schemas: generatedSchemas,
    overall_score: overallScore,
  }

  // Delete old audit for this client, then insert fresh
  await s.from('kotoiq_schema_audit').delete().eq('client_id', client_id)
  await s.from('kotoiq_schema_audit').insert(record)

  // Mark processing job complete
  if (jobId) {
    try {
      await s.from('kotoiq_processing_jobs').update({
        status: 'complete',
        processed_urls: urls.length,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    } catch { /* non-critical */ }
  }

  return { ...record, job_id: jobId, urls_processed: urls.length }
}

// ── Get existing audit ──────────────────────────────────────────────────────
export async function getSchemaAudit(
  s: SupabaseClient,
  body: { client_id: string }
) {
  const { client_id } = body
  if (!client_id) throw new Error('client_id required')

  const { data, error } = await s.from('kotoiq_schema_audit')
    .select('*')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

// ── Generate schema for a specific URL ──────────────────────────────────────
export async function generateSchemaForUrl(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id: string; url: string; schema_type: string; agency_id?: string }
) {
  const { client_id, url, schema_type } = body
  if (!client_id || !url || !schema_type) throw new Error('client_id, url, and schema_type required')

  const { data: client } = await s.from('clients').select('name, website, primary_service, target_customer').eq('id', client_id).single()

  const html = await fetchPage(url)
  if (!html) throw new Error(`Could not fetch ${url}`)

  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)

  const prompt = `Generate a production-ready JSON-LD ${schema_type} schema for this page.

URL: ${url}
BUSINESS: ${client?.name || 'Unknown'}
WEBSITE: ${client?.website || ''}
SERVICE: ${client?.primary_service || ''}

PAGE CONTENT (first 6000 chars):
${textContent}

Generate a complete, valid ${schema_type} JSON-LD schema with all available data from the page.
Include @context, @type, and ALL relevant properties.
If the business has multiple services, include them as offers or hasOfferCatalog.

Return ONLY the JSON-LD object (not wrapped in array):
{"@context": "https://schema.org", "@type": "${schema_type}", ...}`

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: 'Generate production-ready JSON-LD schema. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  })

  void logTokenUsage({
    feature: 'kotoiq_schema',
    model: 'claude-sonnet-4-20250514',
    inputTokens: msg.usage?.input_tokens || 0,
    outputTokens: msg.usage?.output_tokens || 0,
    agencyId: body.agency_id || null,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  const schema = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

  const htmlBlock = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`

  return { schema, html: htmlBlock, type: schema_type, url }
}

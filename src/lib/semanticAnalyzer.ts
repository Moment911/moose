// ─────────────────────────────────────────────────────────────
// Semantic Content Network Analyzer — KotoIQ Feature #7
// Analyzes site-wide semantic structure: N-grams, heading patterns,
// contextual flow, orphan contexts, thin content detection.
// ─────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { blendThreeAIs } from '@/lib/multiAiBlender'
import { getSitemapUrls, getLatestCrawl } from '@/lib/sitemapCrawler'

// ── Types ──────────────────────────────────────────────────────
interface PageAnalysis {
  url: string
  title: string
  word_count: number
  macro_context: string
  micro_contexts: string[]
  main_vs_supplementary: number
  contextual_flow: number
  contextual_consistency: number
  headings: { level: number; text: string }[]
  topics: string[]
}

// ── Helpers ────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (compatible; KotoBot/1.0)'

async function fetchPage(url: string, timeoutMs = 10000): Promise<{ html: string; ok: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { html: '', ok: false }
    return { html: await res.text(), ok: true }
  } catch {
    return { html: '', ok: false }
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
}

function extractHeadings(html: string): { level: number; text: string }[] {
  const matches = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
  return matches.map(m => ({
    level: parseInt(m[1]),
    text: m[2].replace(/<[^>]+>/g, '').trim(),
  })).filter(h => h.text.length > 0)
}

function extractParagraphs(html: string): string[] {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  return matches
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(p => p.length > 20)
}

function extractInternalAnchors(html: string, domain: string): string[] {
  const matches = [...html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  return matches
    .filter(m => m[1].startsWith('/') || m[1].includes(domain))
    .map(m => m[2].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 0)
}

// ── N-gram extraction ──────────────────────────────────────────
function extractNgrams(texts: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>()
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'your', 'our', 'my', 'his', 'her', 'its', 'their', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why'])

  for (const text of texts) {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(' ')
      ngrams.set(gram, (ngrams.get(gram) || 0) + 1)
    }
  }

  return ngrams
}

function topEntries(map: Map<string, number>, limit: number): { text: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, count]) => ({ text, count }))
}

// ── Paragraph opener analysis ──────────────────────────────────
function analyzeParagraphOpeners(paragraphs: string[]): { opener: string; count: number }[] {
  const openers = new Map<string, number>()
  for (const p of paragraphs) {
    const words = p.split(/\s+/).slice(0, 3).join(' ').toLowerCase()
    if (words.length > 3) {
      openers.set(words, (openers.get(words) || 0) + 1)
    }
  }
  return [...openers.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([opener, count]) => ({ opener, count }))
}

// ── Heading pattern analysis ───────────────────────────────────
function analyzeHeadingPatterns(headings: { level: number; text: string }[]): { pattern: string; count: number; examples: string[] }[] {
  const patterns = new Map<string, { count: number; examples: string[] }>()

  for (const h of headings) {
    const text = h.text
    let pattern = ''
    if (/^\d+/.test(text)) pattern = 'Number-led'
    else if (/^(how|what|why|when|where|who|which|can|does|is|are)\b/i.test(text)) pattern = 'Question'
    else if (/^(top|best|ultimate|complete|essential)\b/i.test(text)) pattern = 'Superlative'
    else if (/^(get|discover|learn|find|explore|start|try|use)\b/i.test(text)) pattern = 'Action/CTA'
    else if (/\||-|:/i.test(text)) pattern = 'Brand-separated'
    else if (text.split(/\s+/).length <= 3) pattern = 'Short/Noun phrase'
    else pattern = 'Descriptive'

    const entry = patterns.get(pattern) || { count: 0, examples: [] }
    entry.count++
    if (entry.examples.length < 3) entry.examples.push(text)
    patterns.set(pattern, entry)
  }

  return [...patterns.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([pattern, data]) => ({ pattern, count: data.count, examples: data.examples }))
}

// ── Sitemap fetch (shared logic) ───────────────────────────────
async function fetchSitemapUrls(website: string, limit = 50): Promise<string[]> {
  const base = website.startsWith('http') ? website : `https://${website}`
  const domain = new URL(base).origin
  const urls: string[] = []
  const sitemapUrls = [
    `${domain}/sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/wp-sitemap.xml`,
    `${domain}/page-sitemap.xml`,
    `${domain}/post-sitemap.xml`,
  ]
  for (const smUrl of sitemapUrls) {
    if (urls.length >= limit) break
    try {
      const res = await fetch(smUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const xml = await res.text()
      const locs = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)]
      for (const m of locs) {
        const loc = m[1].trim()
        if (loc.endsWith('.xml')) {
          try {
            const subRes = await fetch(loc, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
            if (subRes.ok) {
              const subXml = await subRes.text()
              for (const sl of [...subXml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)]) {
                if (!sl[1].endsWith('.xml') && urls.length < limit) urls.push(sl[1].trim())
              }
            }
          } catch { /* skip */ }
        } else {
          if (urls.length < limit) urls.push(loc)
        }
      }
    } catch { /* skip */ }
  }
  return [...new Set(urls)].slice(0, limit)
}

// ── Batch helper ───────────────────────────────────────────────
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ═══════════════════════════════════════════════════════════════
// analyzeSemanticNetwork — action: analyze_semantic_network
// ═══════════════════════════════════════════════════════════════
export async function analyzeSemanticNetwork(s: SupabaseClient, ai: Anthropic, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  // url_limit body param — default 500, max 10,000 (was fixed at 50)
  const urlLimit = Math.min(Math.max(parseInt(String(body.url_limit)) || 500, 1), 10000)

  const { data: client } = await s.from('clients').select('website, name').eq('id', client_id).single()
  if (!client?.website) return { error: 'Client has no website configured' }

  const website = client.website.trim()
  const domain = (() => {
    try { return new URL(website.startsWith('http') ? website : `https://${website}`).hostname } catch { return website }
  })()

  // Prefer cached sitemap URLs (semantic analysis benefits from priority-sorted coverage)
  let sitemapUrls: string[] = []
  try {
    const latestCrawl = await getLatestCrawl(s as any, client_id).catch(() => null)
    if (latestCrawl?.status === 'complete' && (latestCrawl.urls_saved || 0) > 0) {
      const result = await getSitemapUrls(s as any, { client_id, limit: urlLimit, orderBy: 'priority' })
      sitemapUrls = (result.urls || []).map((u: any) => u.url).filter(Boolean)
    }
  } catch { /* fall through */ }

  // Fallback: live sitemap fetch
  if (sitemapUrls.length === 0) {
    sitemapUrls = await fetchSitemapUrls(website, urlLimit)
  }

  if (!sitemapUrls.length) return { error: 'No URLs found in sitemap' }

  // Processing job for observability
  let jobId: string | null = null
  try {
    const { data: job } = await s.from('kotoiq_processing_jobs').insert({
      client_id,
      engine: 'semantic',
      status: 'running',
      total_urls: sitemapUrls.length,
      processed_urls: 0,
      started_at: new Date().toISOString(),
    }).select().single()
    jobId = job?.id || null
  } catch { /* non-critical */ }

  // Fetch and extract content from all pages (concurrent chunks of 10 with progress)
  interface PageData {
    url: string
    title: string
    text: string
    headings: { level: number; text: string }[]
    paragraphs: string[]
    anchors: string[]
    wordCount: number
  }

  const pageDataArr: (PageData | null)[] = []
  const CHUNK = 10
  for (let i = 0; i < sitemapUrls.length; i += CHUNK) {
    const batch = sitemapUrls.slice(i, i + CHUNK)
    const batchResults = await Promise.all(batch.map(async (url): Promise<PageData | null> => {
      const { html, ok } = await fetchPage(url)
      if (!ok) return null
      return {
        url,
        title: extractTitle(html),
        text: stripTags(html),
        headings: extractHeadings(html),
        paragraphs: extractParagraphs(html),
        anchors: extractInternalAnchors(html, domain),
        wordCount: stripTags(html).split(/\s+/).filter(Boolean).length,
      }
    }))
    pageDataArr.push(...batchResults)
    if (jobId) {
      try {
        await s.from('kotoiq_processing_jobs').update({
          processed_urls: pageDataArr.length,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
      } catch { /* non-critical */ }
    }
  }

  const pages = pageDataArr.filter((p): p is PageData => p !== null)
  if (!pages.length) {
    if (jobId) {
      try {
        await s.from('kotoiq_processing_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        }).eq('id', jobId)
      } catch { /* non-critical */ }
    }
    return { error: 'Could not fetch any pages' }
  }

  // ── Site-wide aggregations ─────────────────────────────────
  const allTitlesAndH1s = pages.flatMap(p => [p.title, ...p.headings.filter(h => h.level === 1).map(h => h.text)])
  const allH1H2 = pages.flatMap(p => p.headings.filter(h => h.level <= 2).map(h => h.text))
  const allHeadings = pages.flatMap(p => p.headings)
  const allParagraphs = pages.flatMap(p => p.paragraphs)

  // N-grams from titles + H1 + H2
  const bigrams = extractNgrams(allH1H2, 2)
  const trigrams = extractNgrams(allH1H2, 3)
  const siteNgrams = {
    bigrams: topEntries(bigrams, 30),
    trigrams: topEntries(trigrams, 20),
  }

  // Heading patterns
  const headingPatterns = analyzeHeadingPatterns(allHeadings)

  // Paragraph openers
  const paragraphOpeners = analyzeParagraphOpeners(allParagraphs)

  // Thin content pages
  const thinPages = pages.filter(p => p.wordCount < 300).map(p => ({
    url: p.url,
    title: p.title,
    word_count: p.wordCount,
  }))

  // ── Claude analysis for semantic depth ─────────────────────
  // Prepare compact page summaries for Claude
  const pageSummaries = pages.slice(0, 30).map(p => ({
    url: p.url,
    title: p.title,
    words: p.wordCount,
    h1: p.headings.filter(h => h.level === 1).map(h => h.text),
    h2: p.headings.filter(h => h.level === 2).map(h => h.text).slice(0, 8),
    h3: p.headings.filter(h => h.level === 3).map(h => h.text).slice(0, 5),
    first_para: p.paragraphs[0]?.substring(0, 200) || '',
    anchors: p.anchors.slice(0, 10),
  }))

  let aiAnalysis: any = {}
  try {
    const blend = await blendThreeAIs({
      systemPrompt: `You are a semantic SEO analyst. Analyze the content network of a website.
Return ONLY valid JSON with this structure:
{
  "page_analyses": [{"url": "", "macro_context": "", "micro_contexts": [""], "main_vs_supplementary": 0.7, "contextual_flow": 85, "contextual_consistency": 80, "topics": [""]}],
  "top_nouns": [""],
  "top_predicates": [""],
  "top_adjectives": [""],
  "context_dilution_pages": [{"url": "", "title": "", "topic_count": 0, "topics": [""]}],
  "orphan_contexts": [{"topic": "", "mentioned_on": "", "linked_pages": 0}],
  "main_vs_supplementary_ratio": 0.7,
  "contextual_flow_score": 80,
  "contextual_consistency_score": 75,
  "overall_score": 70
}

Scoring:
- contextual_flow: 0-100, how logical is the heading hierarchy?
- contextual_consistency: 0-100, do headings match content?
- main_vs_supplementary: ratio (0-1), ideal is ~0.7
- context_dilution: pages covering 4+ unrelated topics
- orphan_contexts: topics mentioned but not linked to any other page
- overall_score: 0-100 composite`,
      userPrompt: `Analyze the semantic network for ${client.name || domain}:\n${JSON.stringify(pageSummaries, null, 2)}`,
      synthesisInstruction: 'Merge these semantic network analyses — take the sharpest page_analyses entries, the most defensible context_dilution and orphan_contexts findings, and average the numeric scores with a bias toward the most evidence-grounded analyst. Preserve the exact JSON schema.',
      feature: 'kotoiq_semantic_blended',
      maxTokens: 5000,
    })

    void ai // signature parity — blender handles provider fan-out
    const raw = blend.synthesized || '{}'
    aiAnalysis = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch { /* AI analysis is supplementary */ }

  // ── Build final result ─────────────────────────────────────
  const result = {
    client_id,
    site_ngrams: siteNgrams,
    top_nouns: aiAnalysis.top_nouns || [],
    top_predicates: aiAnalysis.top_predicates || [],
    top_adjectives: aiAnalysis.top_adjectives || [],
    heading_patterns: headingPatterns,
    paragraph_openers: paragraphOpeners,
    main_vs_supplementary_ratio: aiAnalysis.main_vs_supplementary_ratio ?? 0.5,
    contextual_flow_score: aiAnalysis.contextual_flow_score ?? 0,
    contextual_consistency_score: aiAnalysis.contextual_consistency_score ?? 0,
    page_analyses: aiAnalysis.page_analyses || [],
    thin_content_pages: thinPages,
    context_dilution_pages: aiAnalysis.context_dilution_pages || [],
    orphan_contexts: aiAnalysis.orphan_contexts || [],
    overall_score: aiAnalysis.overall_score ?? 0,
  }

  // Save to DB
  await s.from('kotoiq_semantic_analysis').delete().eq('client_id', client_id)
  await s.from('kotoiq_semantic_analysis').insert(result)

  // Mark processing job complete
  if (jobId) {
    try {
      await s.from('kotoiq_processing_jobs').update({
        status: 'complete',
        processed_urls: sitemapUrls.length,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    } catch { /* non-critical */ }
  }

  return { success: true, analysis: result, job_id: jobId, urls_processed: sitemapUrls.length }
}

// ═══════════════════════════════════════════════════════════════
// getSemanticAnalysis — action: get_semantic_analysis
// ═══════════════════════════════════════════════════════════════
export async function getSemanticAnalysis(s: SupabaseClient, body: any) {
  const { client_id } = body
  if (!client_id) return { error: 'client_id required' }

  const { data, error } = await s.from('kotoiq_semantic_analysis')
    .select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).single()

  if (error || !data) return { analysis: null }
  return { analysis: data }
}

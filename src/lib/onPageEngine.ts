import 'server-only'
// ─────────────────────────────────────────────────────────────
// KotoIQ — On-Page SEO Analyzer
// Fetches a page and scores it across ~20 on-page SEO checks,
// then asks Claude to prioritize fixes. Called via POST
// /api/kotoiq action: analyze_on_page
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { logTokenUsage } from '@/lib/tokenTracker'

// ── Types ───────────────────────────────────────────────────────────────────
type CheckStatus = 'pass' | 'warning' | 'fail'

export interface OnPageCheck {
  category: string
  check: string
  status: CheckStatus
  score: number // 0-100
  recommendation: string
  detail?: string
}

export interface KeywordPlacement {
  title: boolean
  h1: boolean
  first_100_words: boolean
  meta_description: boolean
  url: boolean
  image_alt: boolean
  score: number
}

export interface OnPageResult {
  url: string
  target_keyword: string
  overall_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  checks: OnPageCheck[]
  keyword_placement_map: KeywordPlacement
  critical_fixes: string[]
  quick_wins: string[]
  load_time_ms: number | null
  word_count: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return 0
  if (word.length <= 3) return 1
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  const m = word.match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

function fleschScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length || 1
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0) || 1
  return Math.round((206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount)) * 10) / 10
}

// ── Fetch + timing ──────────────────────────────────────────────────────────
async function fetchWithTiming(url: string): Promise<{ html: string | null; ms: number | null; status: number }> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0; +https://hellokoto.com)' },
      signal: AbortSignal.timeout(15000),
    })
    const ms = Date.now() - start
    if (!res.ok) return { html: null, ms, status: res.status }
    const html = await res.text()
    return { html, ms: Date.now() - start, status: res.status }
  } catch {
    return { html: null, ms: null, status: 0 }
  }
}

// ── Check builders ──────────────────────────────────────────────────────────
function titleCheck(title: string, kw: string): OnPageCheck {
  const len = title.length
  const kwLc = kw.toLowerCase()
  const titleLc = title.toLowerCase()
  const hasKw = titleLc.includes(kwLc)
  const kwAtStart = titleLc.indexOf(kwLc) >= 0 && titleLc.indexOf(kwLc) < 15

  if (!title) {
    return { category: 'Meta', check: 'Title tag', status: 'fail', score: 0, recommendation: `Add a title tag 50-60 chars including "${kw}".` }
  }
  if (len < 30) {
    return { category: 'Meta', check: 'Title tag', status: 'warning', score: 40, recommendation: `Title is ${len} chars — extend toward 50-60 and include "${kw}" near the start.`, detail: title }
  }
  if (len > 60) {
    return { category: 'Meta', check: 'Title tag', status: 'warning', score: 55, recommendation: `Title is ${len} chars — trim to 50-60 so it doesn't truncate in SERPs.`, detail: title }
  }
  if (!hasKw) {
    return { category: 'Meta', check: 'Title tag', status: 'fail', score: 25, recommendation: `Title missing keyword "${kw}". Add it near the beginning.`, detail: title }
  }
  return { category: 'Meta', check: 'Title tag', status: 'pass', score: kwAtStart ? 100 : 85, recommendation: kwAtStart ? 'Title is well-optimized.' : `Move "${kw}" closer to the start of the title.`, detail: title }
}

function metaDescCheck(desc: string, kw: string): OnPageCheck {
  const len = desc.length
  const hasKw = desc.toLowerCase().includes(kw.toLowerCase())
  if (!desc) return { category: 'Meta', check: 'Meta description', status: 'fail', score: 0, recommendation: `Add a 150-160 char meta description including "${kw}" and a CTR trigger.` }
  if (len < 120) return { category: 'Meta', check: 'Meta description', status: 'warning', score: 45, recommendation: `Meta description is ${len} chars — extend to 150-160.`, detail: desc }
  if (len > 160) return { category: 'Meta', check: 'Meta description', status: 'warning', score: 60, recommendation: `Meta description is ${len} chars — trim to 150-160 to avoid truncation.`, detail: desc }
  if (!hasKw) return { category: 'Meta', check: 'Meta description', status: 'warning', score: 55, recommendation: `Add "${kw}" to the meta description.`, detail: desc }
  return { category: 'Meta', check: 'Meta description', status: 'pass', score: 95, recommendation: 'Meta description is well-sized and keyword-aligned.', detail: desc }
}

function h1Check(h1s: string[], kw: string): OnPageCheck {
  if (h1s.length === 0) return { category: 'Headings', check: 'H1', status: 'fail', score: 0, recommendation: `Add a single H1 that includes "${kw}".` }
  if (h1s.length > 1) return { category: 'Headings', check: 'H1', status: 'fail', score: 30, recommendation: `Page has ${h1s.length} H1 tags — consolidate to one.`, detail: h1s.slice(0, 3).join(' | ') }
  const hasKw = h1s[0].toLowerCase().includes(kw.toLowerCase())
  if (!hasKw) return { category: 'Headings', check: 'H1', status: 'warning', score: 50, recommendation: `H1 missing "${kw}". Rewrite the H1 to include the target keyword.`, detail: h1s[0] }
  return { category: 'Headings', check: 'H1', status: 'pass', score: 100, recommendation: 'Single keyword-bearing H1 — good.', detail: h1s[0] }
}

function headingHierarchyCheck(h1s: string[], h2s: string[], h3s: string[]): OnPageCheck {
  if (h1s.length === 0) return { category: 'Headings', check: 'Heading hierarchy', status: 'fail', score: 0, recommendation: 'No H1 found — the hierarchy is broken.' }
  if (h3s.length > 0 && h2s.length === 0) return { category: 'Headings', check: 'Heading hierarchy', status: 'fail', score: 30, recommendation: 'H3s present without any H2 — introduce H2 sections above the H3s.' }
  if (h2s.length < 2 && (h3s.length > 0 || h2s.length > 0)) return { category: 'Headings', check: 'Heading hierarchy', status: 'warning', score: 60, recommendation: 'Consider adding more H2 sections for better scannability.' }
  return { category: 'Headings', check: 'Heading hierarchy', status: 'pass', score: 90, recommendation: 'Heading hierarchy is logical.' }
}

function wordCountCheck(wc: number): OnPageCheck {
  if (wc < 300) return { category: 'Content', check: 'Word count', status: 'fail', score: 20, recommendation: `Only ${wc} words — expand to at least 800 for ranking competitiveness.` }
  if (wc < 600) return { category: 'Content', check: 'Word count', status: 'warning', score: 55, recommendation: `${wc} words — consider expanding toward 1000-1500 for topical authority.` }
  if (wc > 3500) return { category: 'Content', check: 'Word count', status: 'pass', score: 85, recommendation: `${wc} words — comprehensive. Watch that it stays scannable.` }
  return { category: 'Content', check: 'Word count', status: 'pass', score: 95, recommendation: `${wc} words — a solid depth range.` }
}

function keywordDensityCheck(text: string, kw: string): OnPageCheck {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const total = words.length
  const kwLc = kw.toLowerCase()
  const kwLen = kwLc.split(/\s+/).length
  let count = 0
  for (let i = 0; i <= words.length - kwLen; i++) {
    if (words.slice(i, i + kwLen).join(' ') === kwLc) count++
  }
  const density = total > 0 ? (count * kwLen / total) * 100 : 0
  const rounded = Math.round(density * 100) / 100
  if (count === 0) return { category: 'Content', check: 'Keyword density', status: 'fail', score: 10, recommendation: `"${kw}" does not appear in the body. Use it naturally 3-8 times.`, detail: `0%` }
  if (density < 0.4) return { category: 'Content', check: 'Keyword density', status: 'warning', score: 55, recommendation: `Keyword density ${rounded}% — slightly low. Aim for 0.5-2.5%.`, detail: `${rounded}% (${count} occurrences)` }
  if (density > 3) return { category: 'Content', check: 'Keyword density', status: 'warning', score: 45, recommendation: `Keyword density ${rounded}% — over-optimized, trust the LSI variations instead.`, detail: `${rounded}% (${count} occurrences)` }
  return { category: 'Content', check: 'Keyword density', status: 'pass', score: 95, recommendation: `Keyword density ${rounded}% is in the healthy 0.5-2.5% range.`, detail: `${rounded}% (${count} occurrences)` }
}

function readabilityCheck(text: string): OnPageCheck {
  const flesch = fleschScore(text)
  if (flesch < 30) return { category: 'Content', check: 'Readability', status: 'fail', score: 25, recommendation: `Flesch score ${flesch} — very hard to read. Shorten sentences, swap jargon for plain words.` }
  if (flesch < 50) return { category: 'Content', check: 'Readability', status: 'warning', score: 55, recommendation: `Flesch score ${flesch} — college-level. Consider simplifying for a wider audience.` }
  if (flesch > 90) return { category: 'Content', check: 'Readability', status: 'pass', score: 85, recommendation: `Flesch score ${flesch} — very easy (5th grade). Make sure you aren't under-serving expert intent.` }
  return { category: 'Content', check: 'Readability', status: 'pass', score: 95, recommendation: `Flesch score ${flesch} — comfortable reading level.` }
}

function imagesCheck(imgs: Array<{ alt: string; src: string }>): OnPageCheck {
  if (imgs.length === 0) return { category: 'Media', check: 'Images', status: 'warning', score: 60, recommendation: 'No images found. Add at least one relevant image with descriptive alt text.' }
  const withAlt = imgs.filter(i => i.alt && i.alt.trim().length > 0)
  const coverage = Math.round((withAlt.length / imgs.length) * 100)
  const descriptiveFilenames = imgs.filter(i => /[a-z]{3,}/i.test((i.src.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' '))).length
  if (coverage < 50) return { category: 'Media', check: 'Images', status: 'fail', score: 35, recommendation: `Only ${coverage}% of ${imgs.length} images have alt text. Add descriptive alts for accessibility and SEO.` }
  if (coverage < 100) return { category: 'Media', check: 'Images', status: 'warning', score: 70, recommendation: `${withAlt.length}/${imgs.length} images have alt text. Fill in the missing alts.`, detail: `${descriptiveFilenames}/${imgs.length} use descriptive filenames.` }
  return { category: 'Media', check: 'Images', status: 'pass', score: 95, recommendation: `All ${imgs.length} images have alt text.`, detail: `${descriptiveFilenames}/${imgs.length} use descriptive filenames.` }
}

function internalLinksCheck(count: number): OnPageCheck {
  if (count === 0) return { category: 'Links', check: 'Internal links', status: 'fail', score: 15, recommendation: 'No internal links. Add 3-10 contextual links to related pages.' }
  if (count < 3) return { category: 'Links', check: 'Internal links', status: 'warning', score: 55, recommendation: `Only ${count} internal links. Add more contextual links to related pages.` }
  if (count > 100) return { category: 'Links', check: 'Internal links', status: 'warning', score: 60, recommendation: `${count} internal links — likely sitewide nav. Focus contextual body links instead.` }
  return { category: 'Links', check: 'Internal links', status: 'pass', score: 90, recommendation: `${count} internal links — healthy.` }
}

function externalLinksCheck(count: number, newTabCount: number): OnPageCheck {
  if (count === 0) return { category: 'Links', check: 'External links', status: 'warning', score: 65, recommendation: 'No outbound links. Cite 1-3 authoritative sources to build trust.' }
  const newTabPct = count > 0 ? Math.round((newTabCount / count) * 100) : 0
  if (newTabPct < 50) return { category: 'Links', check: 'External links', status: 'warning', score: 70, recommendation: `${count} external links but only ${newTabPct}% open in a new tab. Add target="_blank" to keep users on-site.` }
  return { category: 'Links', check: 'External links', status: 'pass', score: 90, recommendation: `${count} external links, ${newTabPct}% open in new tabs.` }
}

function urlCheck(url: string, kw: string): OnPageCheck {
  try {
    const u = new URL(url)
    const path = u.pathname
    const slug = path.split('/').filter(Boolean).pop() || ''
    const kwSlug = kw.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')
    const hasKw = slug.includes(kwSlug) || slug.split('-').every(w => kw.toLowerCase().includes(w))
    if (path.length > 90) return { category: 'URL', check: 'URL structure', status: 'warning', score: 55, recommendation: 'URL is very long — shorten to 3-5 descriptive words.', detail: path }
    if (!hasKw) return { category: 'URL', check: 'URL structure', status: 'warning', score: 60, recommendation: `URL slug missing "${kw}". Consider redirecting to a keyword-rich slug.`, detail: path }
    return { category: 'URL', check: 'URL structure', status: 'pass', score: 95, recommendation: 'URL is clean and keyword-aligned.', detail: path }
  } catch {
    return { category: 'URL', check: 'URL structure', status: 'warning', score: 50, recommendation: 'Could not parse URL.' }
  }
}

function schemaCheck(schemas: string[]): OnPageCheck {
  if (schemas.length === 0) return { category: 'Structured Data', check: 'Schema markup', status: 'fail', score: 20, recommendation: 'No JSON-LD schema detected. Add Article, LocalBusiness, FAQPage, or Product as appropriate.' }
  return { category: 'Structured Data', check: 'Schema markup', status: 'pass', score: 90, recommendation: `Schema detected: ${schemas.join(', ')}.` }
}

function loadTimeCheck(ms: number | null): OnPageCheck {
  if (ms === null) return { category: 'Performance', check: 'Load time', status: 'warning', score: 50, recommendation: 'Unable to measure load time.' }
  if (ms > 6000) return { category: 'Performance', check: 'Load time', status: 'fail', score: 25, recommendation: `TTFB+HTML ~${ms}ms — very slow. Audit hosting, caching, and server response.` }
  if (ms > 3000) return { category: 'Performance', check: 'Load time', status: 'warning', score: 55, recommendation: `TTFB+HTML ~${ms}ms — aim for under 2s.` }
  return { category: 'Performance', check: 'Load time', status: 'pass', score: 90, recommendation: `TTFB+HTML ~${ms}ms — responsive.` }
}

function viewportCheck(hasViewport: boolean): OnPageCheck {
  if (!hasViewport) return { category: 'Mobile', check: 'Viewport meta tag', status: 'fail', score: 0, recommendation: 'Missing <meta name="viewport"> — mobile rendering will break.' }
  return { category: 'Mobile', check: 'Viewport meta tag', status: 'pass', score: 100, recommendation: 'Viewport meta tag present.' }
}

function socialTagsCheck(hasOG: boolean, hasTwitter: boolean): OnPageCheck {
  if (!hasOG && !hasTwitter) return { category: 'Social', check: 'Open Graph / Twitter cards', status: 'fail', score: 20, recommendation: 'No Open Graph or Twitter card tags. Add at minimum og:title, og:description, og:image.' }
  if (!hasOG) return { category: 'Social', check: 'Open Graph / Twitter cards', status: 'warning', score: 55, recommendation: 'Add Open Graph tags (og:title, og:description, og:image) for richer previews.' }
  if (!hasTwitter) return { category: 'Social', check: 'Open Graph / Twitter cards', status: 'warning', score: 75, recommendation: 'Add Twitter card tags for richer previews on X/Twitter.' }
  return { category: 'Social', check: 'Open Graph / Twitter cards', status: 'pass', score: 95, recommendation: 'Both Open Graph and Twitter card tags are present.' }
}

function canonicalCheck(canonical: string | null, url: string): OnPageCheck {
  if (!canonical) return { category: 'Meta', check: 'Canonical tag', status: 'warning', score: 55, recommendation: 'No canonical tag — add a self-referencing canonical to prevent duplicate-content issues.' }
  try {
    const canonNorm = new URL(canonical).href.replace(/\/$/, '')
    const urlNorm = new URL(url).href.replace(/\/$/, '')
    if (canonNorm === urlNorm) return { category: 'Meta', check: 'Canonical tag', status: 'pass', score: 95, recommendation: 'Self-referencing canonical is set.' }
    return { category: 'Meta', check: 'Canonical tag', status: 'warning', score: 70, recommendation: `Canonical points to a different URL: ${canonical}. Verify this is intentional.` }
  } catch {
    return { category: 'Meta', check: 'Canonical tag', status: 'warning', score: 60, recommendation: `Canonical value could not be parsed: ${canonical}.` }
  }
}

// ── Main entry ──────────────────────────────────────────────────────────────
export async function analyzeOnPage(
  s: SupabaseClient,
  ai: Anthropic,
  body: { client_id?: string | null; agency_id?: string | null; url: string; target_keyword: string }
): Promise<OnPageResult & { record_id?: string }> {
  const { client_id, agency_id, url, target_keyword: kw } = body
  if (!url || !kw) throw new Error('url and target_keyword are required')

  const { html, ms } = await fetchWithTiming(url)
  if (!html) throw new Error(`Unable to fetch ${url}`)

  const lc = html.toLowerCase()

  // ── Parse pieces ──
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || ''

  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)
  const metaDesc = metaDescMatch?.[1] || ''

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)

  const bodyText = stripTags(html)
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length

  // Images with alt/src
  const imgs: Array<{ alt: string; src: string }> = []
  for (const m of html.matchAll(/<img\b([^>]+)>/gi)) {
    const tag = m[1]
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i)
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i)
    imgs.push({ alt: altMatch?.[1] || '', src: srcMatch?.[1] || '' })
  }

  // Links
  let internal = 0
  let external = 0
  let externalNewTab = 0
  try {
    const origin = new URL(url).hostname
    for (const m of html.matchAll(/<a\b([^>]+)>/gi)) {
      const tag = m[1]
      const hrefM = tag.match(/\bhref=["']([^"']+)["']/i)
      const href = hrefM?.[1]
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
      let hostname = ''
      try { hostname = new URL(href, url).hostname } catch { hostname = '' }
      if (!hostname || hostname === origin) {
        internal++
      } else {
        external++
        if (/\btarget=["']_blank["']/i.test(tag)) externalNewTab++
      }
    }
  } catch { /* ignore URL parse failure */ }

  // Schema
  const schemas: string[] = []
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = JSON.parse(m[1])
      const type = Array.isArray(p) ? p.map((x: any) => x['@type']).filter(Boolean) : [p['@type']]
      for (const t of type) if (t) schemas.push(String(t))
    } catch { /* skip invalid JSON-LD */ }
  }

  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html)
  const hasOG = /<meta[^>]*property=["']og:/i.test(html)
  const hasTwitter = /<meta[^>]*name=["']twitter:/i.test(html)

  const canonMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)
  const canonical = canonMatch?.[1] || null

  // ── Keyword placement map ──
  const kwLc = kw.toLowerCase()
  const kwInTitle = title.toLowerCase().includes(kwLc)
  const kwInH1 = h1s.some(h => h.toLowerCase().includes(kwLc))
  const kwInFirst100 = bodyText.split(/\s+/).slice(0, 100).join(' ').toLowerCase().includes(kwLc)
  const kwInMeta = metaDesc.toLowerCase().includes(kwLc)
  let kwInUrl = false
  try { kwInUrl = new URL(url).pathname.toLowerCase().includes(kw.toLowerCase().replace(/\s+/g, '-')) } catch {}
  const kwInAlt = imgs.some(i => i.alt.toLowerCase().includes(kwLc))

  const placementCount = [kwInTitle, kwInH1, kwInFirst100, kwInMeta, kwInUrl, kwInAlt].filter(Boolean).length
  const keyword_placement_map: KeywordPlacement = {
    title: kwInTitle,
    h1: kwInH1,
    first_100_words: kwInFirst100,
    meta_description: kwInMeta,
    url: kwInUrl,
    image_alt: kwInAlt,
    score: Math.round((placementCount / 6) * 100),
  }

  // ── Run all checks ──
  const checks: OnPageCheck[] = [
    titleCheck(title, kw),
    metaDescCheck(metaDesc, kw),
    h1Check(h1s, kw),
    headingHierarchyCheck(h1s, h2s, h3s),
    wordCountCheck(wordCount),
    keywordDensityCheck(bodyText, kw),
    readabilityCheck(bodyText),
    imagesCheck(imgs),
    internalLinksCheck(internal),
    externalLinksCheck(external, externalNewTab),
    urlCheck(url, kw),
    schemaCheck(schemas),
    loadTimeCheck(ms),
    viewportCheck(hasViewport),
    socialTagsCheck(hasOG, hasTwitter),
    canonicalCheck(canonical, url),
    {
      category: 'On-Page',
      check: 'Keyword placement map',
      status: keyword_placement_map.score >= 80 ? 'pass' : keyword_placement_map.score >= 50 ? 'warning' : 'fail',
      score: keyword_placement_map.score,
      recommendation: keyword_placement_map.score >= 80
        ? 'Keyword is distributed across the key on-page positions.'
        : `Keyword hits ${placementCount}/6 key positions. Missing: ${[
            !kwInTitle && 'title',
            !kwInH1 && 'h1',
            !kwInFirst100 && 'first 100 words',
            !kwInMeta && 'meta description',
            !kwInUrl && 'url slug',
            !kwInAlt && 'image alt',
          ].filter(Boolean).join(', ')}.`,
    },
  ]

  // ── Overall score (mean of check scores) ──
  const overall_score = Math.round(checks.reduce((acc, c) => acc + c.score, 0) / checks.length)
  const grade = gradeFromScore(overall_score)

  // ── Prioritized fixes via Claude ──
  let critical_fixes: string[] = []
  let quick_wins: string[] = []
  try {
    const summary = checks.map(c => `- [${c.status}] ${c.category} / ${c.check} — ${c.recommendation}`).join('\n')
    const prompt = `You are an on-page SEO editor. Given the check results below for URL ${url} targeting "${kw}", return a prioritized action plan.

Return ONLY valid JSON:
{
  "critical_fixes": ["action with biggest ranking impact", ...],
  "quick_wins": ["low-effort action with fast payoff", ...]
}

Rules:
- critical_fixes: 3-6 items, ordered by expected ranking lift
- quick_wins: 3-6 items, anything a marketer can fix in under 10 minutes
- Each item must be concrete and directly actionable
- No generic advice like "improve SEO"

CHECKS:
${summary}`
    const msg = await ai.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      system: 'You are an on-page SEO editor. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    void logTokenUsage({
      feature: 'kotoiq_on_page',
      model: 'claude-sonnet-4-20250514',
      inputTokens: msg.usage?.input_tokens || 0,
      outputTokens: msg.usage?.output_tokens || 0,
      agencyId: agency_id || null,
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    critical_fixes = Array.isArray(parsed.critical_fixes) ? parsed.critical_fixes.slice(0, 8) : []
    quick_wins = Array.isArray(parsed.quick_wins) ? parsed.quick_wins.slice(0, 8) : []
  } catch {
    // Fallback: derive from fails / warnings
    critical_fixes = checks.filter(c => c.status === 'fail').slice(0, 5).map(c => c.recommendation)
    quick_wins = checks.filter(c => c.status === 'warning').slice(0, 5).map(c => c.recommendation)
  }

  const result: OnPageResult = {
    url,
    target_keyword: kw,
    overall_score,
    grade,
    checks,
    keyword_placement_map,
    critical_fixes,
    quick_wins,
    load_time_ms: ms,
    word_count: wordCount,
  }

  // ── Persist ──
  let record_id: string | undefined
  if (client_id) {
    try {
      const { data } = await s.from('kotoiq_on_page_audits').insert({
        client_id,
        url,
        target_keyword: kw,
        overall_score,
        grade,
        checks,
        keyword_placement: keyword_placement_map,
        critical_fixes,
        quick_wins,
      }).select('id').single()
      record_id = data?.id
    } catch {
      // Persistence failure shouldn't block the response
    }
  }

  return { ...result, record_id }
}

export async function getOnPageHistory(
  s: SupabaseClient,
  body: { client_id: string; url?: string; limit?: number }
) {
  const { client_id, url } = body
  if (!client_id) throw new Error('client_id required')

  let q = s.from('kotoiq_on_page_audits').select('*').eq('client_id', client_id)
  if (url) q = q.eq('url', url)

  const { data, error } = await q
    .order('scanned_at', { ascending: false })
    .limit(Math.min(body.limit || 25, 100))

  if (error && error.code !== 'PGRST116') throw error
  return data || []
}

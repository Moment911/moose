import 'server-only'

/**
 * Competitor Page Fingerprinting
 *
 * For a given page URL, extracts the surface signals a Page Factory page
 * needs to beat: word count, heading structure, schema presence, FAQ
 * presence, image counts, internal-link density, keyword positioning.
 *
 * Used by the gap engine to attach a "what competitors look like for
 * this gap" snapshot to each top-priority suggestion, so Page Factory's
 * generation prompt can target real numbers ("competitor avg 1800 words,
 * has FAQ, has LocalBusiness schema — produce a page that exceeds this").
 *
 * Mirrors the analyzePageForKeyword helper inside api/kotoiq/route.ts
 * but lives in @/lib/builder so the gap engine can import it cleanly.
 */

export interface PageFingerprint {
  url: string
  word_count: number
  title: string
  title_length: number
  meta_description: string
  meta_desc_length: number
  h1: string | null
  h1_count: number
  h2_count: number
  h2s: string[]
  h3_count: number
  schemas: string[]
  has_faq: boolean
  faq_count: number
  image_count: number
  images_with_alt: number
  internal_links: number
  keyword_in_title: boolean
  keyword_in_h1: boolean
  keyword_in_first_100: boolean
  keyword_in_meta: boolean
  first_para_words: number
  fetched_at: string
}

export interface AggregatedFingerprint {
  avg_word_count: number
  max_word_count: number
  avg_h2_count: number
  any_has_faq: boolean
  any_has_localbusiness_schema: boolean
  schemas_seen: string[]
  avg_images: number
  avg_internal_links: number
  top_h2_themes: string[]
  sample_count: number
  fetched_at: string
}

export async function fingerprintPage(
  url: string,
  keyword: string,
): Promise<PageFingerprint | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0; +https://hellokoto.com/bot)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseHtmlToFingerprint(html, url, keyword)
  } catch {
    return null
  }
}

function parseHtmlToFingerprint(
  html: string,
  url: string,
  keyword: string,
): PageFingerprint {
  const lc = html.toLowerCase()
  const kwLc = keyword.toLowerCase()

  const textOnly = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = textOnly.split(/\s+/).filter(Boolean).length

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  )
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  )
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  )

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || ''
  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const metaDesc = metaDescMatch?.[1] || ''

  const schemas: string[] = []
  const ldMatches = html.matchAll(
    /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const m of ldMatches) {
    try {
      const p = JSON.parse(m[1])
      if (Array.isArray(p)) {
        for (const item of p) {
          if (item?.['@type']) schemas.push(String(item['@type']))
        }
      } else if (p['@type']) {
        schemas.push(String(p['@type']))
      }
    } catch {
      /* malformed JSON-LD — skip */
    }
  }

  const hasFAQ =
    lc.includes('frequently asked') || schemas.includes('FAQPage') || schemas.some(s => /faq/i.test(s))
  const faqCount =
    [...html.matchAll(/<(dt|summary)[^>]*>/gi)].length ||
    (hasFAQ ? h3s.filter(h => h.includes('?')).length : 0)

  const images = [...html.matchAll(/<img[^>]+>/gi)]
  const imagesWithAlt = images.filter(m => /alt=["'][^"']+["']/i.test(m[0]))

  let internalLinks = 0
  try {
    const domain = new URL(url).hostname
    internalLinks = [...html.matchAll(/href=["']([^"']+)["']/gi)].filter(m => {
      try {
        return new URL(m[1], url).hostname === domain
      } catch {
        return m[1].startsWith('/')
      }
    }).length
  } catch {
    /* malformed URL — leave internalLinks at 0 */
  }

  const firstParaSnip = textOnly.slice(0, 300).split(/[.!?]/).slice(0, 2).join('. ').trim()

  return {
    url,
    word_count: wordCount,
    title: title.slice(0, 200),
    title_length: title.length,
    meta_description: metaDesc.slice(0, 300),
    meta_desc_length: metaDesc.length,
    h1: h1s[0] || null,
    h1_count: h1s.length,
    h2_count: h2s.length,
    h2s: h2s.slice(0, 15),
    h3_count: h3s.length,
    schemas: Array.from(new Set(schemas)),
    has_faq: hasFAQ,
    faq_count: faqCount,
    image_count: images.length,
    images_with_alt: imagesWithAlt.length,
    internal_links: internalLinks,
    keyword_in_title: title.toLowerCase().includes(kwLc),
    keyword_in_h1: h1s.some(h => h.toLowerCase().includes(kwLc)),
    keyword_in_first_100: textOnly.slice(0, 500).toLowerCase().includes(kwLc),
    keyword_in_meta: metaDesc.toLowerCase().includes(kwLc),
    first_para_words: firstParaSnip.split(/\s+/).filter(Boolean).length,
    fetched_at: new Date().toISOString(),
  }
}

/**
 * Aggregate N competitor fingerprints into a single benchmark Page
 * Factory can write against. Returns null when no fingerprints succeed.
 */
export function aggregateFingerprints(
  fingerprints: PageFingerprint[],
): AggregatedFingerprint | null {
  const valid = fingerprints.filter(Boolean)
  if (valid.length === 0) return null

  const wordCounts = valid.map(f => f.word_count).filter(n => n > 0)
  const h2Counts = valid.map(f => f.h2_count)
  const imageCounts = valid.map(f => f.image_count)
  const linkCounts = valid.map(f => f.internal_links)

  // Top H2 themes — count word frequency across all H2s, return top 8
  const wordFreq: Record<string, number> = {}
  const STOP = new Set([
    'the','a','an','and','or','but','is','are','for','to','of','in','on','with','at','by','from','as',
    'your','our','my','what','how','why','when','where','who','this','that','these','those',
  ])
  for (const f of valid) {
    for (const h2 of f.h2s) {
      const words = h2.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
      for (const w of words) {
        if (w.length < 4 || STOP.has(w)) continue
        wordFreq[w] = (wordFreq[w] || 0) + 1
      }
    }
  }
  const top_h2_themes = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w]) => w)

  return {
    avg_word_count: wordCounts.length ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) : 0,
    max_word_count: wordCounts.length ? Math.max(...wordCounts) : 0,
    avg_h2_count: h2Counts.length ? Math.round((h2Counts.reduce((a, b) => a + b, 0) / h2Counts.length) * 10) / 10 : 0,
    any_has_faq: valid.some(f => f.has_faq),
    any_has_localbusiness_schema: valid.some(f =>
      f.schemas.some(s => /LocalBusiness|Service|Organization/i.test(s)),
    ),
    schemas_seen: Array.from(new Set(valid.flatMap(f => f.schemas))),
    avg_images: imageCounts.length ? Math.round(imageCounts.reduce((a, b) => a + b, 0) / imageCounts.length) : 0,
    avg_internal_links: linkCounts.length ? Math.round(linkCounts.reduce((a, b) => a + b, 0) / linkCounts.length) : 0,
    top_h2_themes,
    sample_count: valid.length,
    fetched_at: new Date().toISOString(),
  }
}

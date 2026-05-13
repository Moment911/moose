/**
 * Internal Link Weaver — auto-injects internal links into generated content
 *
 * Reads the client's sitemap URLs and finds pages relevant to the
 * generated content. Replaces [INTERNAL_LINK:anchor text] placeholders
 * with actual <a> tags pointing to existing pages.
 */

import 'server-only'

// ── Types ──────────────────────────────────────────────────────────────────

interface SitemapPage {
  url: string
  title?: string
  slug: string
}

interface LinkMatch {
  anchor: string
  url: string
  relevance: number
}

// ── Core Weaver ────────────────────────────────────────────────────────────

/**
 * Replace [INTERNAL_LINK:anchor text] placeholders in HTML with real links.
 * Also injects 2-3 contextual internal links into paragraph text.
 */
export function weaveInternalLinks(
  html: string,
  sitemapPages: SitemapPage[],
  opts: {
    maxLinks?: number
    service?: string
    city?: string
  } = {},
): string {
  const maxLinks = opts.maxLinks ?? 5
  let linksInserted = 0
  let result = html

  // 1. Replace explicit [INTERNAL_LINK:anchor] placeholders
  result = result.replace(
    /\[INTERNAL_LINK:([^\]]+)\]/g,
    (_match, anchor: string) => {
      if (linksInserted >= maxLinks) return anchor

      const bestMatch = findBestMatch(anchor.trim(), sitemapPages, opts)
      if (bestMatch) {
        linksInserted++
        return `<a href="${escapeHtml(bestMatch.url)}">${escapeHtml(anchor.trim())}</a>`
      }
      return anchor.trim() // No match: just output the text without brackets
    },
  )

  // 2. If we haven't hit maxLinks, inject contextual links into paragraphs
  if (linksInserted < maxLinks && sitemapPages.length > 0) {
    const serviceTerm = opts.service?.toLowerCase()
    const relevantPages = sitemapPages.filter(p => {
      const slug = p.slug.toLowerCase()
      return serviceTerm && slug.includes(serviceTerm.toLowerCase().replace(/\s+/g, '-'))
    }).slice(0, 3)

    for (const page of relevantPages) {
      if (linksInserted >= maxLinks) break

      // Find a paragraph that mentions something related to this page's slug
      const slugWords = page.slug.replace(/-/g, ' ')
      const pattern = new RegExp(
        `(<p[^>]*>(?:(?!</p>).)*?)(${escapeRegex(slugWords)})`,
        'i',
      )

      if (pattern.test(result) && !result.includes(`href="${page.url}"`)) {
        result = result.replace(pattern, (_, before, term) => {
          linksInserted++
          return `${before}<a href="${escapeHtml(page.url)}">${term}</a>`
        })
      }
    }
  }

  return result
}

/**
 * Parse sitemap URLs into a searchable format.
 */
export function parseSitemapPages(urls: Array<{ url: string }>): SitemapPage[] {
  return urls
    .map(u => {
      try {
        const parsed = new URL(u.url)
        const slug = parsed.pathname.replace(/^\/|\/$/g, '')
        return { url: u.url, slug }
      } catch {
        return null
      }
    })
    .filter((p): p is SitemapPage => p !== null && p.slug.length > 0)
}

// ── Matching ───────────────────────────────────────────────────────────────

function findBestMatch(
  anchor: string,
  pages: SitemapPage[],
  opts: { service?: string; city?: string } = {},
): LinkMatch | null {
  const anchorLower = anchor.toLowerCase()
  const words = anchorLower.split(/\s+/)

  let bestMatch: LinkMatch | null = null
  let bestScore = 0

  for (const page of pages) {
    const slug = page.slug.toLowerCase()
    let score = 0

    // Exact slug match
    if (slug === anchorLower.replace(/\s+/g, '-')) {
      score = 100
    } else {
      // Word overlap scoring
      for (const word of words) {
        if (word.length < 3) continue
        if (slug.includes(word)) score += 10
      }

      // Boost if service keyword in slug
      if (opts.service && slug.includes(opts.service.toLowerCase().replace(/\s+/g, '-'))) {
        score += 15
      }
    }

    if (score > bestScore && score >= 10) {
      bestScore = score
      bestMatch = { anchor, url: page.url, relevance: score }
    }
  }

  return bestMatch
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

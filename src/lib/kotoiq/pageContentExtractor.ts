// ─────────────────────────────────────────────────────────────
// Page Content Extractor — Phase B
//
// Takes raw HTML, returns structured content suitable for
// diffing + change classification.
//
// Strips: nav, footer, script, style, noscript, iframe, ads
// Extracts: title, meta, H1, H2 list, CTA list, hero copy,
//           body text, schema.org JSON-LD blocks, word count.
//
// Uses cheerio (already in package.json). No JS execution.
// ─────────────────────────────────────────────────────────────

import 'server-only'
import * as cheerio from 'cheerio'
import { createHash } from 'crypto'

export interface ExtractedPage {
  url: string
  http_status: number
  fetch_ms: number
  content_hash: string
  h1: string
  h2_list: string[]
  cta_list: ExtractedCTA[]
  hero_copy: string
  body_text: string
  meta_title: string
  meta_description: string
  schema_orgs: any[]
  word_count: number
  raw_html_length: number
  error?: string
}

export interface ExtractedCTA {
  text: string
  href: string
  position: number              // 1-based order on page
}

const FETCH_TIMEOUT_MS = 10_000
const MAX_BODY_LEN = 50_000     // truncate body for storage sanity
const HERO_LEN = 500

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
]

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Fetch a URL and extract structured content. Handles common
 * marketing-page HTML; not JS-rendered SPAs (those should be
 * handled in a v2 Playwright fallback).
 */
export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  const start = Date.now()
  const empty: ExtractedPage = {
    url, http_status: 0, fetch_ms: 0, content_hash: '',
    h1: '', h2_list: [], cta_list: [], hero_copy: '', body_text: '',
    meta_title: '', meta_description: '', schema_orgs: [],
    word_count: 0, raw_html_length: 0,
  }

  let html = ''
  let status = 0
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': pickUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: ctl.signal,
      })
      status = resp.status
      if (!resp.ok) {
        return { ...empty, http_status: status, fetch_ms: Date.now() - start, error: `HTTP ${status}` }
      }
      html = await resp.text()
    } finally {
      clearTimeout(t)
    }
  } catch (e: any) {
    return { ...empty, http_status: status, fetch_ms: Date.now() - start, error: e?.message || String(e) }
  }

  return extractFromHtml(url, html, status, Date.now() - start)
}

/**
 * Extract structure from HTML. Exposed separately so we can
 * test it against fixture HTML without network.
 */
export function extractFromHtml(
  url: string,
  html: string,
  httpStatus: number,
  fetchMs: number,
): ExtractedPage {
  const $ = cheerio.load(html)

  // Remove non-content elements before extracting text
  $('script, style, noscript, iframe, svg, [aria-hidden="true"]').remove()
  $('nav, header[role="banner"], footer, [role="navigation"], [role="contentinfo"]').remove()
  // Common ad/widget patterns
  $('[class*="cookie"], [class*="banner"], [id*="cookie"], [class*="newsletter-popup"]').remove()

  // ── Meta
  const meta_title = ($('title').first().text() || '').trim().slice(0, 300)
  const meta_description = ($('meta[name="description"]').attr('content') || '').trim().slice(0, 600)

  // ── H1 (first one wins)
  const h1 = ($('h1').first().text() || '').replace(/\s+/g, ' ').trim().slice(0, 300)

  // ── H2 list (up to 20)
  const h2_list: string[] = []
  $('h2').each((_, el) => {
    if (h2_list.length >= 20) return
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (t) h2_list.push(t.slice(0, 200))
  })

  // ── CTA list — buttons + prominent links
  const cta_list: ExtractedCTA[] = []
  const ctaSel = 'a.button, a.btn, button, a[class*="cta"], a[class*="Cta"], a[role="button"]'
  $(ctaSel).each((i, el) => {
    if (cta_list.length >= 30) return
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    const href = $(el).attr('href') || ''
    if (!text || text.length > 80) return
    if (text.length < 2) return
    cta_list.push({ text: text.slice(0, 80), href: href.slice(0, 400), position: i + 1 })
  })

  // ── Hero copy — first paragraph or first 500 chars of <main>/<article>
  let heroSource = $('main p, article p').first().text() || $('p').first().text() || ''
  if (!heroSource) heroSource = $('body').text().slice(0, HERO_LEN * 2)
  const hero_copy = heroSource.replace(/\s+/g, ' ').trim().slice(0, HERO_LEN)

  // ── Body text — main content stripped + collapsed
  const bodyEl = $('main').first().length ? $('main').first() : $('body')
  const body_text_raw = bodyEl.text().replace(/\s+/g, ' ').trim()
  const body_text = body_text_raw.slice(0, MAX_BODY_LEN)
  const word_count = body_text_raw.split(/\s+/).filter(Boolean).length

  // ── Schema.org JSON-LD blocks
  const schema_orgs: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    if (schema_orgs.length >= 20) return
    const raw = $(el).contents().text()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      // schemas can be objects or arrays; flatten arrays
      if (Array.isArray(parsed)) parsed.forEach(p => schema_orgs.push(p))
      else schema_orgs.push(parsed)
    } catch {
      // ignore malformed JSON-LD
    }
  })

  // ── Content hash — derived from the fields we actually care about for diffing
  const hashable = JSON.stringify({
    h1, h2_list, cta_list: cta_list.map(c => c.text + c.href),
    hero: hero_copy, body: body_text, meta_title, meta_description,
  })
  const content_hash = createHash('sha256').update(hashable).digest('hex')

  return {
    url,
    http_status: httpStatus,
    fetch_ms: fetchMs,
    content_hash,
    h1,
    h2_list,
    cta_list,
    hero_copy,
    body_text,
    meta_title,
    meta_description,
    schema_orgs,
    word_count,
    raw_html_length: html.length,
  }
}

/**
 * Lightweight helper: extract the apex domain from a URL for
 * grouping pages by competitor.
 */
export function urlDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return '' }
}

/**
 * Classify a URL into a coarse page_type based on the path.
 * Used when a user adds a page without specifying type.
 */
export function inferPageType(url: string): string {
  try {
    const u = new URL(url)
    const p = u.pathname.toLowerCase()
    if (p === '/' || p === '') return 'home'
    if (/pricing|plans/.test(p)) return 'pricing'
    if (/features|product|capabilities/.test(p)) return 'features'
    if (/blog|post|article|news|insights/.test(p)) return 'blog_post'
    if (/about|company|team/.test(p)) return 'about'
    if (/lp\/|landing|campaign/.test(p)) return 'landing'
    return 'other'
  } catch { return 'other' }
}

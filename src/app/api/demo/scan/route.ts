import { NextRequest, NextResponse } from 'next/server'

/**
 * Live business-scan demo. Accepts a domain, fetches the homepage,
 * extracts real observable SEO + conversion signals, then asks Claude
 * to write a concise audit + top 3 conversion fixes.
 *
 * Every signal returned is *actually measured* from the live page —
 * no fabricated numbers. The Claude summary is clearly labeled as AI.
 */

export const runtime = 'nodejs'
export const maxDuration = 30

const ANTHROPIC_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

const UA =
  'Mozilla/5.0 (compatible; KotoScanBot/1.0; +https://hellokoto.com/demos/scan)'

type ScanResult = {
  url: string
  finalUrl: string | null
  httpStatus: number | null
  ttfbMs: number | null
  signals: {
    title: string | null
    titleLength: number
    description: string | null
    descriptionLength: number
    h1Count: number
    h1First: string | null
    canonical: string | null
    viewport: string | null
    hasFavicon: boolean
    hasOgTitle: boolean
    hasOgDescription: boolean
    hasOgImage: boolean
    hasTwitterCard: boolean
    schemaTypes: string[]
    hasJsonLd: boolean
    ssl: boolean
    htmlBytes: number
    imageCount: number
    imagesWithoutAlt: number
    linkCount: number
    scriptCount: number
    externalScriptCount: number
  }
  scores: {
    seo: number          // /100
    social: number       // /100
    technical: number    // /100
    conversion: number   // /100
    overall: number      // /100
  }
  aiSummary: string | null
  topFixes: string[]
  error?: string
}

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawUrl = (body.url || '').trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }

  // Normalize: accept "example.com" or "https://example.com"
  let url: URL
  try {
    const candidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    url = new URL(candidate)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Basic SSRF guards — don't fetch localhost / private ranges
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.startsWith('10.') || host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host.startsWith('169.254.')
  ) {
    return NextResponse.json({ error: 'Private / local addresses are not scannable' }, { status: 400 })
  }

  // Fetch with timeout
  const fetchStart = Date.now()
  let res: Response
  let html = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    })
    clearTimeout(timeout)
    html = await res.text()
  } catch (e: any) {
    return NextResponse.json({ error: `Fetch failed: ${e?.message || 'unknown'}` }, { status: 502 })
  }
  const ttfbMs = Date.now() - fetchStart

  const signals = extractSignals(html)
  const scores = scoreSignals(signals, { ssl: url.protocol === 'https:', ttfbMs, httpStatus: res.status })

  const result: ScanResult = {
    url: rawUrl,
    finalUrl: res.url || null,
    httpStatus: res.status,
    ttfbMs,
    signals: {
      ...signals,
      ssl: url.protocol === 'https:',
      htmlBytes: html.length,
    },
    scores,
    aiSummary: null,
    topFixes: [],
  }

  // Claude summary (if key available) — non-fatal if missing
  if (ANTHROPIC_KEY) {
    try {
      const { summary, fixes } = await claudeAudit(result)
      result.aiSummary = summary
      result.topFixes = fixes
    } catch (e: any) {
      console.warn('[demo/scan] Claude summary failed:', e?.message)
      result.aiSummary = null
    }
  }

  return NextResponse.json(result)
}

// ── Signal extraction ──────────────────────────────────────────────────────
function extractSignals(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re)
    return m ? m[1].trim() : null
  }

  const title = pick(/<title[^>]*>([^<]*)<\/title>/i)
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
  const viewport = pick(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i)

  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html)
  const ogDescription = /<meta[^>]+property=["']og:description["']/i.test(html)
  const ogImage = /<meta[^>]+property=["']og:image["']/i.test(html)
  const twitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(html)

  const hasFavicon =
    /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html) ||
    /<link[^>]+rel=["']apple-touch-icon["']/i.test(html)

  // H1 detection
  const h1Matches = Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi))
  const h1Count = h1Matches.length
  const h1First = h1Count > 0
    ? h1Matches[0][1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    : null

  // JSON-LD / schema
  const jsonLdMatches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
  const schemaTypes = new Set<string>()
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const n of nodes) {
        if (n && typeof n === 'object') {
          const t = (n as any)['@type']
          if (typeof t === 'string') schemaTypes.add(t)
          if (Array.isArray(t)) t.forEach((x) => schemaTypes.add(String(x)))
          // @graph pattern
          const g = (n as any)['@graph']
          if (Array.isArray(g)) {
            for (const item of g) {
              const gt = item?.['@type']
              if (typeof gt === 'string') schemaTypes.add(gt)
              if (Array.isArray(gt)) gt.forEach((x) => schemaTypes.add(String(x)))
            }
          }
        }
      }
    } catch {
      // Not fatal — just means the JSON-LD block is malformed or contains JS
    }
  }

  // Image + link + script counts (light-touch — just tag counts)
  const imgTags = html.match(/<img\b[^>]*>/gi) || []
  const imagesWithoutAlt = imgTags.filter((t) => !/\balt\s*=/.test(t)).length
  const linkCount = (html.match(/<a\b[^>]+href=/gi) || []).length
  const scriptTags = html.match(/<script\b[^>]*>/gi) || []
  const externalScriptCount = scriptTags.filter((t) => /\bsrc\s*=/.test(t)).length

  return {
    title,
    titleLength: title?.length ?? 0,
    description,
    descriptionLength: description?.length ?? 0,
    h1Count,
    h1First,
    canonical,
    viewport,
    hasFavicon,
    hasOgTitle: ogTitle,
    hasOgDescription: ogDescription,
    hasOgImage: ogImage,
    hasTwitterCard: twitterCard,
    schemaTypes: Array.from(schemaTypes),
    hasJsonLd: jsonLdMatches.length > 0,
    imageCount: imgTags.length,
    imagesWithoutAlt,
    linkCount,
    scriptCount: scriptTags.length,
    externalScriptCount,
  }
}

// ── Scoring — deterministic, defensible rubrics ────────────────────────────
function scoreSignals(
  s: ReturnType<typeof extractSignals>,
  ctx: { ssl: boolean; ttfbMs: number; httpStatus: number }
) {
  // SEO: title + description + h1 + canonical + schema
  let seo = 0
  if (s.title) seo += 15
  if (s.titleLength >= 30 && s.titleLength <= 70) seo += 10
  if (s.description) seo += 15
  if (s.descriptionLength >= 90 && s.descriptionLength <= 170) seo += 10
  if (s.h1Count === 1) seo += 15
  else if (s.h1Count > 1) seo += 5  // multiple H1s = partial credit
  if (s.canonical) seo += 10
  if (s.hasJsonLd) seo += 15
  if (s.schemaTypes.length >= 2) seo += 10

  // Social: OG + Twitter
  let social = 0
  if (s.hasOgTitle) social += 25
  if (s.hasOgDescription) social += 25
  if (s.hasOgImage) social += 30
  if (s.hasTwitterCard) social += 20

  // Technical: SSL + viewport + favicon + response + 200 OK
  let technical = 0
  if (ctx.ssl) technical += 25
  if (s.viewport) technical += 20
  if (s.hasFavicon) technical += 15
  if (ctx.httpStatus === 200) technical += 15
  if (ctx.ttfbMs < 800) technical += 25
  else if (ctx.ttfbMs < 1500) technical += 15
  else if (ctx.ttfbMs < 3000) technical += 8

  // Conversion: H1 clarity + alt text + script bloat
  let conversion = 0
  if (s.h1Count === 1 && s.h1First && s.h1First.length >= 10) conversion += 30
  const altRatio = s.imageCount > 0 ? 1 - s.imagesWithoutAlt / s.imageCount : 1
  conversion += Math.round(altRatio * 25)
  if (s.externalScriptCount < 15) conversion += 20
  else if (s.externalScriptCount < 30) conversion += 10
  if (s.linkCount >= 10 && s.linkCount <= 200) conversion += 25

  // Clamp
  seo = Math.max(0, Math.min(100, seo))
  social = Math.max(0, Math.min(100, social))
  technical = Math.max(0, Math.min(100, technical))
  conversion = Math.max(0, Math.min(100, conversion))

  const overall = Math.round((seo + social + technical + conversion) / 4)
  return { seo, social, technical, conversion, overall }
}

// ── Claude written audit ───────────────────────────────────────────────────
async function claudeAudit(result: ScanResult): Promise<{ summary: string; fixes: string[] }> {
  const prompt = `You are an expert conversion + SEO auditor. I'm giving you a structured scan of a live website.

Return a strict JSON object with two keys:
- "summary": 2–3 sentences plainly describing what the site is about, what it's doing well, and where the biggest gap is. No fluff, no flattery. Plain English.
- "fixes": a JSON array of exactly 3 strings, each a concrete action the site owner should take, ranked by conversion impact. Each fix is one sentence, specific (naming the element or section), and actionable.

Scan data:
${JSON.stringify({
    url: result.finalUrl || result.url,
    scores: result.scores,
    signals: result.signals,
    httpStatus: result.httpStatus,
    ttfbMs: result.ttfbMs,
  }, null, 2)}

Respond with JSON only. No prose before or after.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error?.message || `Claude error ${res.status}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text || ''

  // Extract JSON — Claude sometimes wraps in ```json
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  const summary = String(parsed.summary || '').trim()
  const fixes = Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 3).map(String) : []
  return { summary, fixes }
}

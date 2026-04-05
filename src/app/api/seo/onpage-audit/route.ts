import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
const PSI_KEY       = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || '' // reuse same key
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// ── Fetch & parse HTML server-side ──────────────────────────────────────────
async function fetchPage(url: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0; SEO Audit)' }
    })
    clearTimeout(timeout)
    const html = await res.text()
    const finalUrl = res.url
    const statusCode = res.status

    // Extract key on-page elements
    const title       = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || ''
    const metaDesc    = html.match(/name=["']description["'][^>]*content=["']([^"']{1,500})/i)?.[1]?.trim()
                     || html.match(/content=["']([^"']{1,500})["'][^>]*name=["']description["']/i)?.[1]?.trim() || ''
    const canonical   = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] || ''
    const h1s         = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map((m: RegExpMatchArray) => m[1].trim())
    const h2s         = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map((m: RegExpMatchArray) => m[1].trim()).slice(0, 10)
    const imgs        = [...html.matchAll(/<img[^>]*>/gi)].map((m: RegExpMatchArray) => m[0])
    const imgsNoAlt   = imgs.filter((img: string) => !img.match(/alt=["'][^"']/i))
    const links       = [...html.matchAll(/href=["']([^"'#?]+)/gi)].map((m: RegExpMatchArray) => m[1])
    const internalLinks = links.filter((l: string) => l.startsWith('/') || l.includes(new URL(url).hostname))
    const externalLinks = links.filter((l: string) => l.startsWith('http') && !l.includes(new URL(url).hostname))
    const hasSchema   = html.includes('application/ld+json')
    const hasOGTitle  = html.includes('og:title')
    const hasViewport = html.includes('name="viewport"')
    const wordCount   = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((w: string) => w.length > 2).length
    const robotsMeta  = html.match(/name=["']robots["'][^>]*content=["']([^"']+)/i)?.[1] || ''
    const hasCanonical = !!canonical
    const hasGTag     = html.includes('gtag') || html.includes('googletagmanager')
    const hasSSL      = url.startsWith('https')
    const bodyText    = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)

    return {
      url, finalUrl, statusCode, html: html.slice(0, 50000),
      title, titleLen: title.length,
      metaDesc, metaDescLen: metaDesc.length,
      canonical, hasCanonical,
      h1s, h1Count: h1s.length,
      h2s, h2Count: h2s.length,
      imgCount: imgs.length, imgsNoAltCount: imgsNoAlt.length,
      internalLinkCount: internalLinks.length,
      externalLinkCount: externalLinks.length,
      hasSchema, hasOGTitle, hasViewport, hasGTag,
      hasSSL, wordCount, robotsMeta, bodyText,
    }
  } catch (e: any) {
    return { error: e.message, url }
  }
}

// ── PageSpeed Insights (free, no key needed for basic) ──────────────────────
async function fetchPageSpeed(url: string) {
  try {
    const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    const params = `?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`
    const keyParam = PSI_KEY ? `&key=${PSI_KEY}` : ''
    const res = await fetch(base + params + keyParam)
    if (!res.ok) return null
    const d = await res.json()
    const cats = d.lighthouseResult?.categories || {}
    const audits = d.lighthouseResult?.audits || {}
    return {
      performance:    Math.round((cats.performance?.score || 0) * 100),
      accessibility:  Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices:  Math.round((cats['best-practices']?.score || 0) * 100),
      seo:            Math.round((cats.seo?.score || 0) * 100),
      lcp:  audits['largest-contentful-paint']?.displayValue || '',
      fid:  audits['total-blocking-time']?.displayValue || '',
      cls:  audits['cumulative-layout-shift']?.displayValue || '',
      fcp:  audits['first-contentful-paint']?.displayValue || '',
      ttfb: audits['server-response-time']?.displayValue || '',
      mobileScore: Math.round((cats.performance?.score || 0) * 100),
      opportunities: Object.values(audits)
        .filter((a: any) => a.score !== null && a.score < 0.9 && a.details?.type === 'opportunity')
        .slice(0, 5)
        .map((a: any) => ({ title: a.title, description: a.description, savings: a.details?.overallSavingsMs })),
    }
  } catch { return null }
}

// ── Score the page with specific checks ─────────────────────────────────────
function scorePage(page: any, speed: any) {
  type Check = { pass: boolean; weight: number; label: string; detail: string; fix: string; category: string; severity: 'critical'|'warning'|'info' }
  const checks: Check[] = [
    // Title tag
    { category:'on-page',   severity:'critical', weight:10, label:'Title tag present',
      pass: page.titleLen > 0,
      detail: page.titleLen > 0 ? `"${page.title.slice(0,60)}" (${page.titleLen} chars)` : 'No title tag found',
      fix: 'Add a unique, descriptive title tag with primary keyword near the front' },
    { category:'on-page',   severity:'warning',  weight:6,  label:'Title length optimal (30-60 chars)',
      pass: page.titleLen >= 30 && page.titleLen <= 60,
      detail: page.titleLen > 60 ? `Too long (${page.titleLen} chars — will truncate in SERPs)` : page.titleLen < 30 ? `Too short (${page.titleLen} chars)` : `Good length (${page.titleLen} chars)`,
      fix: 'Keep title between 30-60 characters to display fully in search results' },
    // Meta description
    { category:'on-page',   severity:'critical', weight:8,  label:'Meta description present',
      pass: page.metaDescLen > 0,
      detail: page.metaDescLen > 0 ? `"${page.metaDesc.slice(0,80)}…" (${page.metaDescLen} chars)` : 'No meta description found',
      fix: 'Add a compelling 120-158 character meta description with a call to action' },
    { category:'on-page',   severity:'warning',  weight:5,  label:'Meta description length (120-158 chars)',
      pass: page.metaDescLen >= 120 && page.metaDescLen <= 158,
      detail: page.metaDescLen > 158 ? `Too long (${page.metaDescLen} chars)` : page.metaDescLen > 0 ? `Too short (${page.metaDescLen} chars)` : 'Missing',
      fix: 'Write meta descriptions between 120-158 characters for full SERP display' },
    // H1
    { category:'on-page',   severity:'critical', weight:9,  label:'H1 tag present',
      pass: page.h1Count >= 1,
      detail: page.h1Count > 0 ? `"${page.h1s[0]?.slice(0,60)}"` : 'No H1 tag found on page',
      fix: 'Add exactly one H1 tag containing your primary keyword' },
    { category:'on-page',   severity:'warning',  weight:5,  label:'Only one H1 tag',
      pass: page.h1Count === 1,
      detail: page.h1Count > 1 ? `${page.h1Count} H1 tags found (should be exactly 1)` : page.h1Count === 0 ? 'Missing H1' : '1 H1 found ✓',
      fix: 'Use exactly one H1 per page — it tells Google what the page is about' },
    // H2s
    { category:'on-page',   severity:'info',     weight:4,  label:'H2 subheadings used',
      pass: page.h2Count >= 2,
      detail: `${page.h2Count} H2 tags found${(page.h2s as string[]).length > 0 ? ': ' + (page.h2s as string[]).slice(0,3).map((h: string)=>`"${h.slice(0,30)}"`).join(', ') : ''}`,
      fix: 'Add H2 subheadings to structure content and target secondary keywords' },
    // Content
    { category:'content',   severity:'warning',  weight:7,  label:'Sufficient content (300+ words)',
      pass: page.wordCount >= 300,
      detail: `${page.wordCount} words on page`,
      fix: 'Add more content — pages with 500+ words tend to rank better for local keywords' },
    // Images
    { category:'technical', severity:'warning',  weight:6,  label:'All images have alt text',
      pass: page.imgsNoAltCount === 0,
      detail: page.imgsNoAltCount > 0 ? `${page.imgsNoAltCount} of ${page.imgCount} images missing alt text` : `${page.imgCount} images, all have alt text ✓`,
      fix: 'Add descriptive alt text to every image — helps SEO and accessibility' },
    // SSL
    { category:'technical', severity:'critical', weight:10, label:'HTTPS / SSL enabled',
      pass: page.hasSSL,
      detail: page.hasSSL ? 'Site is served over HTTPS ✓' : 'Site is HTTP — Google penalizes non-HTTPS sites',
      fix: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS' },
    // Schema
    { category:'technical', severity:'warning',  weight:7,  label:'Schema markup present',
      pass: page.hasSchema,
      detail: page.hasSchema ? 'JSON-LD schema markup detected ✓' : 'No schema markup found',
      fix: 'Add LocalBusiness schema with name, address, phone, hours, and geo coordinates' },
    // Open Graph
    { category:'technical', severity:'info',     weight:4,  label:'Open Graph tags present',
      pass: page.hasOGTitle,
      detail: page.hasOGTitle ? 'OG tags found ✓' : 'No Open Graph meta tags found',
      fix: 'Add og:title, og:description, og:image for better social sharing previews' },
    // Viewport
    { category:'technical', severity:'critical', weight:9,  label:'Mobile viewport configured',
      pass: page.hasViewport,
      detail: page.hasViewport ? 'Viewport meta tag present ✓' : 'No viewport meta tag — site may not be mobile-friendly',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>' },
    // Canonical
    { category:'technical', severity:'info',     weight:3,  label:'Canonical URL set',
      pass: page.hasCanonical,
      detail: page.hasCanonical ? `Canonical: ${page.canonical.slice(0,60)}` : 'No canonical tag found',
      fix: 'Add a canonical link tag to prevent duplicate content issues' },
    // Analytics
    { category:'technical', severity:'info',     weight:3,  label:'Analytics tracking installed',
      pass: page.hasGTag,
      detail: page.hasGTag ? 'Google Analytics / Tag Manager detected ✓' : 'No analytics tracking detected',
      fix: 'Install Google Analytics 4 or Google Tag Manager to track visitor behavior' },
    // Status code
    { category:'technical', severity:'critical', weight:10, label:'Page returns 200 status',
      pass: page.statusCode === 200,
      detail: `HTTP status: ${page.statusCode}`,
      fix: page.statusCode >= 300 ? 'Fix redirect chain' : page.statusCode >= 400 ? 'Page not found — fix URL or create 301 redirect' : 'Check server configuration' },
    // Internal links
    { category:'links',     severity:'info',     weight:4,  label:'Internal links present',
      pass: page.internalLinkCount >= 3,
      detail: `${page.internalLinkCount} internal links, ${page.externalLinkCount} external links`,
      fix: 'Add internal links to other relevant pages to improve crawlability and authority flow' },
    // PageSpeed scores
    ...(speed ? [
      { category:'performance', severity:'critical' as const, weight:10, label:'Mobile performance score 50+',
        pass: (speed.performance || 0) >= 50,
        detail: `Mobile performance: ${speed.performance}/100${speed.lcp ? ` · LCP: ${speed.lcp}` : ''}`,
        fix: 'Compress images, remove unused JavaScript, enable caching to improve page speed' },
      { category:'performance', severity:'warning' as const, weight:7, label:'Mobile performance score 80+',
        pass: (speed.performance || 0) >= 80,
        detail: `Performance: ${speed.performance}/100 — ${speed.performance >= 80 ? 'Good' : speed.performance >= 50 ? 'Needs improvement' : 'Poor'}`,
        fix: 'Target 80+ performance score. Use Google PageSpeed Insights for specific fixes' },
      { category:'performance', severity:'info' as const, weight:4, label:'PageSpeed SEO score 90+',
        pass: (speed.seo || 0) >= 90,
        detail: `PageSpeed SEO score: ${speed.seo}/100`,
        fix: 'Fix any SEO issues flagged by Google PageSpeed Insights' },
    ] : []),
  ]

  let earned = 0, total = 0
  const passes: Check[] = [], fails: Check[] = []
  for (const ch of checks) {
    total += ch.weight
    if (ch.pass) { earned += ch.weight; passes.push(ch) }
    else fails.push(ch)
  }
  fails.sort((a, b) => {
    const sev = { critical: 3, warning: 2, info: 1 }
    return sev[b.severity] - sev[a.severity] || b.weight - a.weight
  })
  return { score: Math.round((earned / total) * 100), passes, fails, total: checks.length }
}

// ── Claude AI analysis ───────────────────────────────────────────────────────
async function claudeAnalysis(page: any, speed: any, scoreData: any, businessName: string, location: string, sicCode?: string) {
  if (!ANTHROPIC_KEY || page.error) return null
  const prompt = `You are a senior SEO specialist auditing a local business website.

Business: ${businessName || page.url}
Location: ${location || 'Unknown'}${sicCode ? `\nIndustry SIC: ${sicCode}` : ''}
URL: ${page.url}
On-Page Score: ${scoreData.score}/100
Title: "${page.title}"
Meta Description: "${page.metaDesc}"
H1: "${page.h1s[0] || 'Missing'}"
Word count: ${page.wordCount}
Mobile Performance: ${speed?.performance || 'N/A'}/100
LCP: ${speed?.lcp || 'N/A'} | CLS: ${speed?.cls || 'N/A'}
Schema markup: ${page.hasSchema ? 'Yes' : 'No'}
Failing checks: ${scoreData.fails.map((f: any) => f.label).join(', ')}

Page content sample: "${page.bodyText?.slice(0, 500)}"

Return ONLY valid JSON:
{
  "executive_summary": "2-3 sentence honest assessment of this page's SEO health",
  "biggest_issue": "The single most important thing to fix right now",
  "keyword_gaps": ["keyword opportunity 1", "keyword opportunity 2", "keyword opportunity 3"],
  "content_suggestions": "Specific advice on content improvements for local SEO",
  "local_seo_tips": ["local tip 1", "local tip 2", "local tip 3"],
  "schema_recommendation": "Exactly what schema type to add and key fields",
  "title_suggestion": "A better title tag if the current one is weak",
  "meta_suggestion": "A better meta description if the current one is weak",
  "estimated_traffic_impact": "What fixing these issues could do for organic traffic"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }] })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim() || '{}'
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e+1)
    return JSON.parse(text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { url, client_id, agency_id, business_name, location, sic_code } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const cleanUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

    // Run all checks in parallel
    const [page, speed] = await Promise.all([
      fetchPage(cleanUrl),
      fetchPageSpeed(cleanUrl),
    ])

    if (page.error) {
      return NextResponse.json({ error: `Could not fetch page: ${page.error}` }, { status: 400 })
    }

    const scoreData = scorePage(page, speed)
    const ai = await claudeAnalysis(page, speed, scoreData, business_name || '', location || '', sic_code || '')

    const result = {
      url: cleanUrl,
      business_name: business_name || '',
      score: scoreData.score,
      total_checks: scoreData.total,
      passes: scoreData.passes,
      fails: scoreData.fails,
      page_data: {
        title: page.title, title_len: page.titleLen,
        meta_desc: page.metaDesc, meta_desc_len: page.metaDescLen,
        h1s: page.h1s, h2s: page.h2s,
        word_count: page.wordCount, img_count: page.imgCount,
        imgs_no_alt: page.imgsNoAltCount,
        has_schema: page.hasSchema, has_ssl: page.hasSSL,
        status_code: page.statusCode, canonical: page.canonical,
        internal_links: page.internalLinkCount, external_links: page.externalLinkCount,
      },
      speed,
      ai,
      audited_at: new Date().toISOString(),
    }

    // Save to DB
    if (client_id && SUPABASE_URL) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/seo_page_audits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ client_id, agency_id, url: cleanUrl, score: scoreData.score, audit_data: result }),
        })
      } catch (_) {} // table may not exist yet, non-fatal
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

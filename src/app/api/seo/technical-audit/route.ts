import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''

async function crawlPage(url: string) {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 12000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KotoBot/1.0)' } })
    const html = await res.text()
    const status = res.status
    const finalUrl = res.url

    // Extract links for crawling
    const linkMatches = [...html.matchAll(/href=["']([^"'#?]+)['"]/gi)]
    const links = linkMatches.map((m: RegExpMatchArray) => m[1])
    const base = new URL(url)
    const internal = links.filter((l: string) => {
      try { const u = new URL(l, url); return u.hostname === base.hostname } catch { return l.startsWith('/') }
    }).map((l: string) => { try { return new URL(l, url).href } catch { return url + l } })

    // Technical checks
    const hasSSL           = url.startsWith('https')
    const title            = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || ''
    const metaDesc         = html.match(/name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || ''
    const hasViewport      = html.includes('name="viewport"') || html.includes("name='viewport'")
    const hasCanonical     = /<link[^>]*rel=["']canonical["']/i.test(html)
    const hasSchema        = html.includes('application/ld+json')
    const hasRobotsMeta    = /name=["']robots["']/i.test(html)
    const imgs             = [...html.matchAll(/<img[^>]*>/gi)].map((m: RegExpMatchArray) => m[0])
    const imgsMissingAlt   = imgs.filter((img: string) => !img.match(/alt=["'][^"']/i)).length
    const h1s              = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map((m: RegExpMatchArray) => m[1])
    const wordCount        = html.replace(/<[^>]+>/g,' ').split(/\s+/).filter((w: string)=>w.length>2).length
    const hasGA            = html.includes('gtag') || html.includes('googletagmanager')
    const isRedirect       = status >= 300 && status < 400
    const isBroken         = status >= 400

    return { url, finalUrl, status, isRedirect, isBroken, hasSSL, title, titleLen: title.length, metaDesc, metaDescLen: metaDesc.length, hasViewport, hasCanonical, hasSchema, hasRobotsMeta, imgCount: imgs.length, imgsMissingAlt, h1Count: h1s.length, h1: h1s[0] || '', wordCount, hasGA, internalLinks: [...new Set(internal)].slice(0, 20) }
  } catch (e: any) {
    return { url, status: 0, isBroken: true, error: e.message }
  }
}

async function runPageSpeed(url: string) {
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo`)
    if (!res.ok) return null
    const d = await res.json()
    const cats = d.lighthouseResult?.categories || {}
    return {
      performance:   Math.round((cats.performance?.score||0)*100),
      seo:           Math.round((cats.seo?.score||0)*100),
      accessibility: Math.round((cats.accessibility?.score||0)*100),
      bestPractices: Math.round((cats['best-practices']?.score||0)*100),
    }
  } catch { return null }
}

async function generateAuditReport(pages: any[], speed: any, domain: string) {
  if (!ANTHROPIC_KEY || !pages.length) return null
  const broken = pages.filter((p: any) => p.isBroken)
  const redirects = pages.filter((p: any) => p.isRedirect)
  const noTitle = pages.filter((p: any) => !p.title || p.titleLen < 10)
  const noMeta = pages.filter((p: any) => !p.metaDesc || p.metaDescLen < 50)
  const noH1 = pages.filter((p: any) => p.h1Count === 0)
  const missingAlt = pages.filter((p: any) => p.imgsMissingAlt > 0)

  const prompt = `You are a technical SEO expert. Audit results for ${domain}:

Pages crawled: ${pages.length}
Broken pages (4xx/5xx): ${broken.length}
Redirects: ${redirects.length}
Pages missing title: ${noTitle.length}
Pages missing meta desc: ${noMeta.length}
Pages missing H1: ${noH1.length}
Pages with missing image alt: ${missingAlt.length}
Has SSL: ${pages[0]?.hasSSL}
Has viewport meta: ${pages[0]?.hasViewport}
Has Schema markup: ${pages.some((p:any)=>p.hasSchema)}
Has analytics: ${pages.some((p:any)=>p.hasGA)}
Mobile PageSpeed score: ${speed?.performance||'N/A'}/100
SEO score: ${speed?.seo||'N/A'}/100

Return ONLY valid JSON:
{
  "overall_score": 0-100,
  "grade": "A|B|C|D|F",
  "summary": "2-3 sentence executive summary",
  "critical_issues": [{"issue":"issue name","count":0,"impact":"impact description","fix":"exact fix"}],
  "warnings": [{"issue":"issue","fix":"fix"}],
  "passed": ["what's working well"],
  "priority_fixes": ["fix 1 to do first","fix 2","fix 3"],
  "estimated_impact": "what fixing these issues could do for rankings"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{role:'user',content:prompt}] })
  })
  if (!res.ok) return null
  const d = await res.json()
  try {
    let text = d.content?.[0]?.text?.trim()||'{}'
    text = text.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim()
    const s=text.indexOf('{'),e=text.lastIndexOf('}')
    return JSON.parse(s>=0&&e>s?text.slice(s,e+1):text)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { url, max_pages = 10 } = await req.json()
    if (!url) return NextResponse.json({error:'url required'},{status:400})

    const startUrl = url.startsWith('http') ? url : 'https://' + url
    const domain   = new URL(startUrl).hostname

    // Crawl starting page + discover internal links
    const visited = new Set<string>()
    const queue   = [startUrl]
    const pages: any[] = []

    while (queue.length && pages.length < max_pages) {
      const pageUrl = queue.shift()!
      if (visited.has(pageUrl)) continue
      visited.add(pageUrl)

      const pageData = await crawlPage(pageUrl)
      pages.push(pageData)

      // Add discovered internal links to queue
      if (pageData.internalLinks && pages.length < max_pages) {
        for (const link of pageData.internalLinks) {
          if (!visited.has(link) && !queue.includes(link)) queue.push(link)
        }
      }
    }

    // Run PageSpeed on the main URL
    const speed = await runPageSpeed(startUrl)

    // AI analysis
    const aiReport = await generateAuditReport(pages, speed, domain)

    return NextResponse.json({
      domain, url: startUrl, pages_crawled: pages.length,
      pages, speed, ai_report: aiReport,
      summary: {
        broken:       pages.filter(p=>p.isBroken).length,
        redirects:    pages.filter(p=>p.isRedirect).length,
        no_title:     pages.filter(p=>!p.title||p.titleLen<10).length,
        no_meta:      pages.filter(p=>!p.metaDesc||p.metaDescLen<50).length,
        no_h1:        pages.filter(p=>p.h1Count===0).length,
        missing_alt:  pages.filter(p=>p.imgsMissingAlt>0).length,
        no_schema:    pages.filter(p=>!p.hasSchema).length,
        has_ssl:      pages[0]?.hasSSL || false,
      },
      audited_at: new Date().toISOString(),
    })
  } catch(e:any) { return NextResponse.json({error:e.message},{status:500}) }
}

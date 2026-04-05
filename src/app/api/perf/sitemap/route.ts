import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Koto/1.0 (+https://hellokoto.com)' } })
    clearTimeout(timer)
    return r
  } catch(e) { clearTimeout(timer); throw e }
}

function extractUrls(xml: string): string[] {
  const urls: string[] = []
  const locMatches = xml.matchAll(/<loc[^>]*>(.*?)<\/loc>/gis)
  for (const m of locMatches) {
    const url = m[1].trim().replace(/&amp;/g,'&')
    if (url.startsWith('http')) urls.push(url)
  }
  return [...new Set(urls)]
}

async function analyzePage(url: string) {
  try {
    const res = await fetchWithTimeout(url, 6000)
    if (!res.ok) return { url, httpStatus: res.status, loadOk: false }
    const html = await res.text()

    const title     = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/<[^>]+>/g,'').trim().slice(0,200) || ''
    const metaDesc  = html.match(/name=["']description["'][^>]*content=["']([^"']{10,})/i)?.[1]?.trim().slice(0,300) ||
                      html.match(/content=["']([^"']{10,})["'][^>]*name=["']description["']/i)?.[1]?.trim().slice(0,300) || ''
    const h1        = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean)[0] || ''
    const hasCTA    = /<button|<a[^>]+(cta|btn|call|contact|get|book|schedule|quote|free|start)/i.test(html)
    const hasForm   = /<form/i.test(html)
    const hasPhone  = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(html)

    // Word count from text content
    const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
                           .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
                           .replace(/<[^>]+>/g,' ')
                           .replace(/\s+/g,' ').trim()
    const wordCount = textContent.split(/\s+/).filter(w=>w.length>2).length

    // Content preview (first 400 chars of text)
    const contentPreview = textContent.slice(0,400)

    return {
      url, title, metaDesc, h1, hasCTA, hasForm, hasPhone,
      wordCount, contentPreview, httpStatus: res.status, loadOk: true,
      htmlSize: html.length,
    }
  } catch(e: any) {
    return { url, loadOk: false, error: e.message?.slice(0,100) }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided', pages: [] })

    // Fetch sitemap
    const sitemapRes = await fetchWithTimeout(url, 10000)
    if (!sitemapRes.ok) {
      // Try /sitemap.xml as fallback
      const base = new URL(url).origin
      const fallback = await fetchWithTimeout(base + '/sitemap.xml', 8000).catch(()=>null)
      if (!fallback?.ok) return NextResponse.json({ error: 'Sitemap not found', pages: [] })
      const xml = await fallback.text()
      const urls = extractUrls(xml).slice(0, 100)
      const pages = await Promise.all(urls.map(u => analyzePage(u)))
      return NextResponse.json({ pages, total: urls.length, source: base + '/sitemap.xml' })
    }

    const xml = await sitemapRes.text()

    // Handle sitemap index (nested sitemaps)
    let allUrls: string[] = []
    if (xml.includes('<sitemapindex')) {
      const sitemapUrls = extractUrls(xml).slice(0, 5) // max 5 sub-sitemaps
      for (const sUrl of sitemapUrls) {
        try {
          const sub = await fetchWithTimeout(sUrl, 8000)
          if (sub.ok) {
            const subXml = await sub.text()
            allUrls.push(...extractUrls(subXml))
          }
        } catch {}
      }
    } else {
      allUrls = extractUrls(xml)
    }

    // Cap at 100 pages for now, prioritize non-asset pages
    const pageUrls = allUrls
      .filter(u => !u.match(/\.(xml|jpg|jpeg|png|gif|pdf|zip|css|js)$/i))
      .slice(0, 100)

    // Analyze pages in parallel batches of 10
    const pages = []
    for (let i = 0; i < pageUrls.length; i += 10) {
      const batch = await Promise.all(pageUrls.slice(i, i+10).map(analyzePage))
      pages.push(...batch)
    }

    return NextResponse.json({ pages, total: allUrls.length, source: url })

  } catch(e: any) {
    return NextResponse.json({ error: e.message, pages: [] }, { status: 500 })
  }
}
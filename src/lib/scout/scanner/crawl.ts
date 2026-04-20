// Minimal HTML crawler for the Scout seller-profile scanner.
//
// Fetches the homepage, extracts same-host links, and crawls up to 8
// prioritized internal pages. Strips scripts/styles and hard-caps each
// page at 40KB of text. Total timeout 120s.

const PRIORITY_PATHS = [
  '/services', '/about', '/case-studies', '/results',
  '/process', '/how-we-work', '/industries', '/pricing',
  '/approach', '/why-us', '/what-we-do', '/clients',
]

const MAX_PAGES = 8
const PER_PAGE_CHAR_CAP = 40_000
const TOTAL_TIMEOUT_MS = 120_000
const PER_FETCH_TIMEOUT_MS = 15_000

export interface CrawledPage {
  url: string
  title: string | null
  text: string
  chars: number
  status: number
}

export interface CrawlResult {
  host: string
  pages: CrawledPage[]
  total_chars: number
  duration_ms: number
}

function stripHtml(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : null
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return { title, text: cleaned.slice(0, PER_PAGE_CHAR_CAP) }
}

function extractLinks(html: string, baseUrl: string, host: string): string[] {
  const out: string[] = []
  const re = /href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
    try {
      const u = new URL(raw, baseUrl)
      if (u.host === host && !out.includes(u.href)) {
        // Skip media / docs
        if (/\.(png|jpg|jpeg|gif|webp|pdf|mp4|mp3|zip|svg|ico|css|js)(\?.*)?$/i.test(u.pathname)) continue
        if (u.pathname === '/' && out.includes(baseUrl)) continue
        out.push(u.href)
      }
    } catch { /* skip invalid */ }
  }
  return out
}

function prioritizeLinks(links: string[], homeHref: string): string[] {
  const home = new URL(homeHref)
  const score = (href: string): number => {
    try {
      const u = new URL(href)
      const path = u.pathname.toLowerCase()
      let s = 100
      for (let i = 0; i < PRIORITY_PATHS.length; i++) {
        if (path === PRIORITY_PATHS[i] || path.startsWith(PRIORITY_PATHS[i] + '/')) {
          s = i // lower index = higher priority
          break
        }
      }
      // Slight penalty for very deep paths
      s += (path.split('/').filter(Boolean).length - 1) * 2
      return s
    } catch { return 999 }
  }
  return [...new Set(links)]
    .filter(l => l !== home.href)
    .sort((a, b) => score(a) - score(b))
}

async function fetchPage(url: string, deadline: number): Promise<CrawledPage | null> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) return null
  const timeout = Math.min(PER_FETCH_TIMEOUT_MS, remaining)
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), timeout)
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KotoScoutBot/1.0; +https://hellokoto.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(to)
    if (!res.ok) return { url, title: null, text: '', chars: 0, status: res.status }
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return null
    const html = await res.text()
    const { title, text } = stripHtml(html)
    return { url, title, text, chars: text.length, status: res.status }
  } catch {
    return null
  }
}

export async function crawlSellerSite(startUrl: string): Promise<CrawlResult> {
  const start = Date.now()
  const deadline = start + TOTAL_TIMEOUT_MS
  const normalized = startUrl.match(/^https?:\/\//) ? startUrl : `https://${startUrl}`
  const homeUrl = new URL(normalized)
  const host = homeUrl.host

  const pages: CrawledPage[] = []
  const homeRes = await fetch(homeUrl.href, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KotoScoutBot/1.0; +https://hellokoto.com)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(PER_FETCH_TIMEOUT_MS),
  })
  if (!homeRes.ok) {
    return { host, pages: [], total_chars: 0, duration_ms: Date.now() - start }
  }
  const homeHtml = await homeRes.text()
  const { title: homeTitle, text: homeText } = stripHtml(homeHtml)
  pages.push({ url: homeUrl.href, title: homeTitle, text: homeText, chars: homeText.length, status: homeRes.status })

  // Extract + prioritize internal links
  const links = extractLinks(homeHtml, homeUrl.href, host)
  const prioritized = prioritizeLinks(links, homeUrl.href).slice(0, MAX_PAGES * 2) // overfetch candidates

  // Fetch prioritized pages in parallel with a small concurrency window
  const toFetch = prioritized.slice(0, MAX_PAGES - 1)
  const results = await Promise.all(
    toFetch.map(async (u) => fetchPage(u, deadline))
  )
  for (const r of results) {
    if (r && r.chars > 200) pages.push(r)
  }

  const total_chars = pages.reduce((acc, p) => acc + p.chars, 0)
  return { host, pages, total_chars, duration_ms: Date.now() - start }
}

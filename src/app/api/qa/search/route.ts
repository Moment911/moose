import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query) return NextResponse.json({ results: [] })

    // Try Brave Search (best for this use case)
    const braveKey = process.env.BRAVE_SEARCH_KEY || ''
    if (braveKey) {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
        { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey } }
      )
      if (res.ok) {
        const data = await res.json()
        const results = (data.web?.results || []).map((r: any) => ({
          url: r.url, title: r.title, snippet: r.description
        }))
        return NextResponse.json({ results, source: 'brave' })
      }
    }

    // Fallback: Google Custom Search
    const gKey = process.env.GOOGLE_SEARCH_KEY || ''
    const cx   = process.env.GOOGLE_SEARCH_CX  || ''
    if (gKey && cx) {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${gKey}&cx=${cx}&num=8`
      )
      if (res.ok) {
        const data = await res.json()
        const results = (data.items || []).map((r: any) => ({
          url: r.link, title: r.title, snippet: r.snippet
        }))
        return NextResponse.json({ results, source: 'google' })
      }
    }

    // Final fallback: DuckDuckGo
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
    )
    if (res.ok) {
      const data = await res.json()
      const results = [
        ...(data.RelatedTopics||[]).slice(0,6).map((t: any) => ({
          url: t.FirstURL||'', title: t.Text?.slice(0,80)||'', snippet: t.Text||''
        })),
        data.AbstractURL ? { url: data.AbstractURL, title: data.Heading||query, snippet: data.AbstractText||'' } : null,
      ].filter(Boolean).filter((r: any) => r.url && r.snippet)
      return NextResponse.json({ results, source: 'duckduckgo' })
    }

    return NextResponse.json({ results: [], source: 'none' })
  } catch(e: any) {
    return NextResponse.json({ results: [], error: e.message })
  }
}
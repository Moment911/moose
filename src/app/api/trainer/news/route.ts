import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
// Cache for 15 minutes
export const revalidate = 900

export async function GET(req: NextRequest) {
  const division = req.nextUrl.searchParams.get('division') || 'all'

  const feeds = {
    all: 'https://news.google.com/rss/search?q=college+baseball+recruiting&hl=en-US&gl=US&ceid=US:en',
    d1: 'https://news.google.com/rss/search?q=NCAA+division+1+baseball+recruiting&hl=en-US&gl=US&ceid=US:en',
    d2: 'https://news.google.com/rss/search?q=NCAA+division+2+baseball+recruiting&hl=en-US&gl=US&ceid=US:en',
    d3: 'https://news.google.com/rss/search?q=NCAA+division+3+baseball+recruiting&hl=en-US&gl=US&ceid=US:en',
    juco: 'https://news.google.com/rss/search?q=JUCO+baseball+recruiting&hl=en-US&gl=US&ceid=US:en',
    transfer: 'https://news.google.com/rss/search?q=college+baseball+transfer+portal&hl=en-US&gl=US&ceid=US:en',
    draft: 'https://news.google.com/rss/search?q=MLB+draft+college+baseball&hl=en-US&gl=US&ceid=US:en',
    cws: 'https://news.google.com/rss/search?q=college+world+series+baseball&hl=en-US&gl=US&ceid=US:en',
  }

  const feedUrl = feeds[division as keyof typeof feeds] || feeds.all

  try {
    const res = await fetch(feedUrl, { next: { revalidate: 900 } })
    const xml = await res.text()

    // Parse RSS XML — extract <item> elements
    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const itemXml = match[1]
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ''
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || ''
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || ''
      const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || ''

      if (title) {
        items.push({
          title,
          link,
          pubDate,
          source,
          date: pubDate ? new Date(pubDate).toISOString() : null,
        })
      }
    }

    return NextResponse.json({ articles: items, division, fetched_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ articles: [], error: (e as Error).message }, { status: 500 })
  }
}

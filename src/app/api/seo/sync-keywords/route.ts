import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getValidToken(conn: any) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) {
    return conn.access_token
  }
  if (!conn.refresh_token) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)?.trim() || '',
      client_secret: (process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET)?.trim() || '', // env-leak-check: legacy-fallback
      refresh_token: conn.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null
  await supabase.from('seo_connections').update({
    access_token:     data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', conn.id)
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const { client_id } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: conn } = await supabase
      .from('seo_connections').select('*')
      .eq('client_id', client_id).eq('provider', 'search_console').eq('connected', true)
      .single()

    if (!conn?.site_url) return NextResponse.json({ error: 'Search Console not connected or no site URL' }, { status: 404 })

    const token = await getValidToken(conn)
    if (!token) return NextResponse.json({ error: 'Could not get valid access token' }, { status: 401 })

    const { data: keywords } = await supabase
      .from('seo_keyword_tracking').select('*').eq('client_id', client_id)

    if (!keywords?.length) return NextResponse.json({ synced: 0, message: 'No keywords to sync' })

    const endDate   = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]

    const gscRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(conn.site_url)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 1000, aggregationType: 'auto' }),
      }
    )

    if (!gscRes.ok) {
      const err = await gscRes.text()
      return NextResponse.json({ error: 'GSC request failed', details: err }, { status: 400 })
    }

    const rows: any[] = (await gscRes.json()).rows || []
    const gscMap: Record<string, any> = {}
    for (const row of rows) {
      const kw = row.keys?.[0]?.toLowerCase()
      if (kw) gscMap[kw] = row
    }

    let synced = 0, notFound = 0
    for (const kw of keywords) {
      const row = gscMap[kw.keyword?.toLowerCase()]
      await supabase.from('seo_keyword_tracking').update({
        previous_position: kw.position,
        position:    row ? Math.round(row.position * 10) / 10 : null,
        clicks:      row?.clicks || 0,
        impressions: row?.impressions || 0,
        ctr:         row?.ctr || 0,
        tracked_at:  new Date().toISOString(),
      }).eq('id', kw.id)
      row ? synced++ : notFound++
    }

    return NextResponse.json({ synced, notFound, total: keywords.length, period: { startDate, endDate } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

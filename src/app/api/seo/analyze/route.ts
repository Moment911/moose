import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

const DAYS = 90  // pull last 90 days

function dateStr(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

async function getToken(conn: any) {
  // Return existing token if still valid (> 5 min left)
  if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() - Date.now() > 300_000) {
    return conn.access_token
  }
  // Refresh
  if (!conn.refresh_token) return conn.access_token
  try {
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
    if (data.access_token) {
      await getSupabase().from('seo_connections').update({
        access_token:     data.access_token,
        token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      }).eq('id', conn.id)
      return data.access_token
    }
  } catch {}
  return conn.access_token
}

async function fetchGSC(token: string, siteUrl: string) {
  if (!siteUrl) return null
  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateStr(DAYS), endDate: dateStr(0),
          dimensions: ['query', 'page'],
          rowLimit: 1000, aggregationType: 'auto',
        }),
      }
    )
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchGSCSites(token: string) {
  try {
    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.siteEntry || []).map((s: any) => s.siteUrl)
  } catch { return [] }
}

async function fetchGA4(token: string, propertyId: string) {
  if (!propertyId) return null
  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [
            { startDate: dateStr(DAYS), endDate: dateStr(0) },
            { startDate: dateStr(DAYS * 2), endDate: dateStr(DAYS + 1) },  // prev period
          ],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'pagePath' }],
          metrics: [
            { name: 'sessions' }, { name: 'activeUsers' },
            { name: 'bounceRate' }, { name: 'avgSessionDuration' },
            { name: 'screenPageViews' },
          ],
          limit: 500,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),
      }
    )
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchGA4Properties(token: string) {
  try {
    const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/-', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.properties || []).map((p: any) => ({
      id: p.name.replace('properties/', ''),
      displayName: p.displayName,
      websiteUrl: p.websiteUri || '',
    }))
  } catch { return [] }
}

function processGSC(raw: any) {
  if (!raw?.rows?.length) return null
  const rows = raw.rows
  const totals = rows.reduce((acc: any, r: any) => ({
    clicks: acc.clicks + (r.clicks || 0),
    impressions: acc.impressions + (r.impressions || 0),
  }), { clicks: 0, impressions: 0 })

  const avgCTR = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0'
  const avgPos = (rows.reduce((s: number, r: any) => s + (r.position || 0), 0) / rows.length).toFixed(1)

  // Quick wins: pos 4-20, high impressions
  const quickWins = rows
    .filter((r: any) => r.position >= 4 && r.position <= 20 && r.impressions > 100)
    .sort((a: any, b: any) => {
      const aScore = (21 - a.position) * a.impressions / 100
      const bScore = (21 - b.position) * b.impressions / 100
      return bScore - aScore
    })
    .slice(0, 10)
    .map((r: any) => ({
      keyword: r.keys?.[0],
      page: r.keys?.[1],
      position: Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: (r.ctr * 100).toFixed(1) + '%',
      potential: Math.round(r.impressions * 0.15),  // est clicks at pos 1-3
    }))

  // Low CTR: high impressions, very low CTR (title/meta problem)
  const lowCTR = rows
    .filter((r: any) => r.impressions > 200 && r.ctr < 0.02 && r.position < 15)
    .sort((a: any, b: any) => b.impressions - a.impressions)
    .slice(0, 8)
    .map((r: any) => ({
      keyword: r.keys?.[0],
      impressions: r.impressions,
      currentCTR: (r.ctr * 100).toFixed(2) + '%',
      position: Math.round(r.position * 10) / 10,
      potentialClicks: Math.round(r.impressions * 0.05),
    }))

  // Top performing
  const topPages = rows
    .sort((a: any, b: any) => b.clicks - a.clicks)
    .slice(0, 5)
    .map((r: any) => ({ page: r.keys?.[1], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }))

  // Brand vs non-brand (rough: branded terms usually have very high CTR)
  const branded = rows.filter((r: any) => r.ctr > 0.3)
  const nonBranded = rows.filter((r: any) => r.ctr <= 0.3)

  return {
    totals: { ...totals, avgCTR, avgPos },
    quickWins,
    lowCTR,
    topPages,
    branded: { count: branded.length, clicks: branded.reduce((s: number, r: any) => s + r.clicks, 0) },
    nonBranded: { count: nonBranded.length, clicks: nonBranded.reduce((s: number, r: any) => s + r.clicks, 0) },
    totalKeywords: rows.length,
  }
}

function processGA4(raw: any) {
  if (!raw?.rows?.length) return null

  const currentRows = raw.rows.filter((r: any) => r.dimensionValues?.[0]?.value !== 'date_range_1')
  const prevRows = raw.rows.filter((r: any) => r.dimensionValues?.[0]?.value === 'date_range_1')

  const channels: Record<string, any> = {}
  currentRows.forEach((r: any) => {
    const ch = r.dimensionValues?.[0]?.value || 'Unknown'
    if (!channels[ch]) channels[ch] = { sessions: 0, users: 0, bounceRate: 0, count: 0 }
    channels[ch].sessions += parseInt(r.metricValues?.[0]?.value || '0')
    channels[ch].users    += parseInt(r.metricValues?.[1]?.value || '0')
    channels[ch].bounceRate += parseFloat(r.metricValues?.[2]?.value || '0')
    channels[ch].count++
  })

  const totalSessions = Object.values(channels).reduce((s: number, c: any) => s + c.sessions, 0)
  const organic = channels['Organic Search'] || { sessions: 0, users: 0 }
  const organicPct = totalSessions ? Math.round(organic.sessions / totalSessions * 100) : 0

  // Top pages by sessions
  const pageMap: Record<string, number> = {}
  currentRows.forEach((r: any) => {
    const page = r.dimensionValues?.[1]?.value || '/'
    pageMap[page] = (pageMap[page] || 0) + parseInt(r.metricValues?.[0]?.value || '0')
  })
  const topPages = Object.entries(pageMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([page, sessions]) => ({ page, sessions }))

  return {
    totalSessions,
    organicSessions: organic.sessions,
    organicPct,
    channels: Object.entries(channels)
      .map(([name, d]: [string, any]) => ({
        name, sessions: d.sessions, users: d.users,
        avgBounceRate: d.count ? (d.bounceRate / d.count * 100).toFixed(1) + '%' : '—',
        pct: totalSessions ? Math.round(d.sessions / totalSessions * 100) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 6),
    topPages,
  }
}

function crossReference(gsc: any, ga4: any) {
  if (!gsc || !ga4) return null
  const issues = []
  const wins = []

  // Organic sessions vs GSC clicks — big gap = tracking issue or branded traffic not in GSC
  const clickGap = gsc.totals.clicks - ga4.organicSessions
  if (Math.abs(clickGap) > gsc.totals.clicks * 0.3) {
    issues.push(clickGap > 0
      ? `Search Console shows ${gsc.totals.clicks.toLocaleString()} clicks but GA4 records ${ga4.organicSessions.toLocaleString()} organic sessions — ${Math.round(Math.abs(clickGap/gsc.totals.clicks)*100)}% gap suggests tracking issues or bot traffic`
      : `GA4 organic sessions (${ga4.organicSessions.toLocaleString()}) exceed GSC clicks — possible direct/dark traffic miscategorized as organic`
    )
  }

  // Low CTR with high impressions = meta title/desc opportunity
  if (gsc.lowCTR.length >= 3) {
    issues.push(`${gsc.lowCTR.length} keywords with 200+ impressions but under 2% CTR — fixing meta titles/descriptions could unlock ${gsc.lowCTR.reduce((s: number, k: any) => s + k.potentialClicks, 0).toLocaleString()} additional monthly clicks`)
  }

  // Quick wins
  if (gsc.quickWins.length > 0) {
    wins.push(`${gsc.quickWins.length} keywords ranking positions 4–20 with strong impression volume — targeted content updates could move these to page 1`)
  }

  // High bounce on organic
  const organicChannel = ga4.channels.find((c: any) => c.name === 'Organic Search')
  if (organicChannel) {
    const bounce = parseFloat(organicChannel.avgBounceRate)
    if (bounce > 70) {
      issues.push(`Organic search bounce rate is ${organicChannel.avgBounceRate} — users arriving from Google are leaving quickly, suggesting content-intent mismatch`)
    } else if (bounce < 40) {
      wins.push(`Strong organic engagement — ${organicChannel.avgBounceRate} bounce rate indicates good content-to-intent match`)
    }
  }

  // Organic share of traffic
  if (ga4.organicPct < 20) {
    issues.push(`Organic search drives only ${ga4.organicPct}% of total traffic — heavy paid or direct dependency creates long-term risk`)
  } else if (ga4.organicPct > 50) {
    wins.push(`Organic search drives ${ga4.organicPct}% of all traffic — strong SEO foundation`)
  }

  return { issues, wins }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, agencyId } = await req.json()
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

    // Load connections
    const { data: conns } = await getSupabase()
      .from('seo_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('connected', true)

    if (!conns?.length) {
      return NextResponse.json({ error: 'No connected accounts. Connect Google Search Console and Analytics first.' }, { status: 400 })
    }

    const gscConn  = conns.find(c => c.provider === 'search_console')
    const ga4Conn  = conns.find(c => c.provider === 'analytics')

    // Get fresh tokens
    const gscToken = gscConn  ? await getToken(gscConn)  : null
    const ga4Token = ga4Conn  ? await getToken(ga4Conn)  : null

    // Discover site URL if not stored
    let siteUrl = gscConn?.site_url
    if (!siteUrl && gscToken) {
      const sites = await fetchGSCSites(gscToken)
      siteUrl = sites[0] || null
      if (siteUrl && gscConn) {
        await getSupabase().from('seo_connections').update({ site_url: siteUrl }).eq('id', gscConn.id)
      }
    }

    // Discover GA4 property if not stored
    let propertyId = ga4Conn?.property_id
    if (!propertyId && ga4Token) {
      const props = await fetchGA4Properties(ga4Token)
      propertyId = props[0]?.id || null
      if (propertyId && ga4Conn) {
        await getSupabase().from('seo_connections').update({ property_id: propertyId }).eq('id', ga4Conn.id)
      }
    }

    // Fetch data in parallel
    const [gscRaw, ga4Raw] = await Promise.all([
      gscToken && siteUrl   ? fetchGSC(gscToken, siteUrl)         : Promise.resolve(null),
      ga4Token && propertyId ? fetchGA4(ga4Token, propertyId)     : Promise.resolve(null),
    ])

    const gscData = processGSC(gscRaw)
    const ga4Data = processGA4(ga4Raw)
    const crossRef = crossReference(gscData, ga4Data)

    return NextResponse.json({
      period: { start: dateStr(DAYS), end: dateStr(0), days: DAYS },
      gsc:    gscData,
      ga4:    ga4Data,
      crossRef,
      siteUrl,
      propertyId,
      connected: { gsc: !!gscData, ga4: !!ga4Data },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

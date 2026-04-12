import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function refreshToken(conn: any) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000))
    return conn.access_token
  if (!conn.refresh_token) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)!.trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET)!.trim(), // env-leak-check: legacy-fallback
      refresh_token: conn.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const d = await res.json()
  if (!d.access_token) return null
  await sb().from('seo_connections').update({
    access_token: d.access_token,
    token_expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
  }).eq('id', conn.id)
  return d.access_token
}

async function gscQuery(token: string, siteUrl: string, start: string, end: string, dims: string[], rowLimit = 500) {
  const r = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: dims, rowLimit, aggregationType: 'auto' }) }
  )
  if (!r.ok) return null
  return r.json()
}

async function ga4Query(token: string, propertyId: string, start: string, end: string, dims: string[], metrics: string[], rowLimit = 500) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: dims.map(n => ({ name: n })),
        metrics:    metrics.map(n => ({ name: n })),
        limit: rowLimit,
        orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
      }) }
  )
  if (!r.ok) return null
  return r.json()
}

function parseDates(range: string, cs?: string, ce?: string) {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (range === 'custom' && cs && ce) return { start: cs, end: ce }
  const map: Record<string, () => { start: string; end: string }> = {
    '7d':         () => ({ start: fmt(new Date(Date.now()-7*86400000)), end: fmt(now) }),
    '28d':        () => ({ start: fmt(new Date(Date.now()-28*86400000)), end: fmt(now) }),
    '30d':        () => ({ start: fmt(new Date(Date.now()-30*86400000)), end: fmt(now) }),
    '90d':        () => ({ start: fmt(new Date(Date.now()-90*86400000)), end: fmt(now) }),
    '6m':         () => ({ start: fmt(new Date(Date.now()-180*86400000)), end: fmt(now) }),
    '12m':        () => ({ start: fmt(new Date(Date.now()-365*86400000)), end: fmt(now) }),
    'this_month': () => ({ start: fmt(new Date(now.getFullYear(),now.getMonth(),1)), end: fmt(now) }),
    'last_month': () => ({ start: fmt(new Date(now.getFullYear(),now.getMonth()-1,1)), end: fmt(new Date(now.getFullYear(),now.getMonth(),0)) }),
    'this_year':  () => ({ start: fmt(new Date(now.getFullYear(),0,1)), end: fmt(now) }),
    'last_year':  () => ({ start: fmt(new Date(now.getFullYear()-1,0,1)), end: fmt(new Date(now.getFullYear()-1,11,31)) }),
  }
  return (map[range] || map['30d'])()
}

function compareRange(start: string, end: string, mode: string) {
  if (mode === 'none') return null
  const s = new Date(start), e = new Date(end)
  const days = Math.round((e.getTime()-s.getTime())/86400000)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (mode === 'previous_period') {
    return { start: fmt(new Date(s.getTime()-(days+1)*86400000)), end: fmt(new Date(s.getTime()-86400000)) }
  }
  if (mode === 'same_period_last_year') {
    return { start: fmt(new Date(s.getFullYear()-1,s.getMonth(),s.getDate())), end: fmt(new Date(e.getFullYear()-1,e.getMonth(),e.getDate())) }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, report_type='overview', date_range='30d', custom_start, custom_end, compare='previous_period' } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    const { data: conns } = await sb().from('seo_connections').select('*').eq('client_id',client_id).eq('connected',true)
    const gscConn = conns?.find((c:any) => c.provider==='search_console')
    const ga4Conn = conns?.find((c:any) => c.provider==='analytics')

    const { start, end } = parseDates(date_range, custom_start, custom_end)
    const comp = compareRange(start, end, compare)
    const days = Math.round((new Date(end).getTime()-new Date(start).getTime())/86400000)

    const result: any = { period:{start,end,days}, compare_period:comp, report_type, gsc_site:gscConn?.site_url, ga4_property:ga4Conn?.property_id }

    const gscTok = gscConn ? await refreshToken(gscConn) : null
    const ga4Tok = ga4Conn ? await refreshToken(ga4Conn) : null

    const G = (dims:string[],limit=500) => gscTok&&gscConn?.site_url ? gscQuery(gscTok,gscConn.site_url,start,end,dims,limit) : Promise.resolve(null)
    const Gp= (dims:string[],limit=500) => gscTok&&gscConn?.site_url&&comp ? gscQuery(gscTok,gscConn.site_url,comp.start,comp.end,dims,limit) : Promise.resolve(null)
    const A = (dims:string[],mets:string[],limit=500) => ga4Tok&&ga4Conn?.property_id ? ga4Query(ga4Tok,ga4Conn.property_id,start,end,dims,mets,limit) : Promise.resolve(null)
    const Ap= (dims:string[],mets:string[],limit=500) => ga4Tok&&ga4Conn?.property_id&&comp ? ga4Query(ga4Tok,ga4Conn.property_id,comp.start,comp.end,dims,mets,limit) : Promise.resolve(null)

    const TRAFFIC_METS = ['sessions','activeUsers','bounceRate','newUsers','screenPageViews']

    if (report_type==='overview') {
      const [gc,gp,ac,ap] = await Promise.all([G(['query'],200),Gp(['query'],200),A(['sessionDefaultChannelGroup'],TRAFFIC_METS,20),Ap(['sessionDefaultChannelGroup'],TRAFFIC_METS,20)])
      result.gsc=gc; result.gsc_prev=gp; result.ga4=ac; result.ga4_prev=ap
    } else if (report_type==='keywords') {
      const [gc,gp] = await Promise.all([G(['query'],500),Gp(['query'],500)])
      result.gsc=gc; result.gsc_prev=gp
    } else if (report_type==='pages') {
      const [gc,gp,ac,ap] = await Promise.all([G(['page'],200),Gp(['page'],200),A(['pagePath'],['screenPageViews','sessions','bounceRate','averageSessionDuration'],100),Ap(['pagePath'],['screenPageViews','sessions','bounceRate','averageSessionDuration'],100)])
      result.gsc=gc; result.gsc_prev=gp; result.ga4=ac; result.ga4_prev=ap
    } else if (report_type==='channels') {
      const [ac,ap] = await Promise.all([A(['sessionDefaultChannelGroup'],['sessions','activeUsers','bounceRate','newUsers','conversions'],20),Ap(['sessionDefaultChannelGroup'],['sessions','activeUsers','bounceRate','newUsers','conversions'],20)])
      result.ga4=ac; result.ga4_prev=ap
    } else if (report_type==='devices') {
      const [gc,gp,ac,ap] = await Promise.all([G(['device'],10),Gp(['device'],10),A(['deviceCategory'],['sessions','activeUsers','bounceRate'],10),Ap(['deviceCategory'],['sessions','activeUsers','bounceRate'],10)])
      result.gsc=gc; result.gsc_prev=gp; result.ga4=ac; result.ga4_prev=ap
    } else if (report_type==='countries') {
      const [gc,gp,ac,ap] = await Promise.all([G(['country'],50),Gp(['country'],50),A(['country'],['sessions','activeUsers'],50),Ap(['country'],['sessions','activeUsers'],50)])
      result.gsc=gc; result.gsc_prev=gp; result.ga4=ac; result.ga4_prev=ap
    } else if (report_type==='daily_trend') {
      const [gc,gp,ac,ap] = await Promise.all([G(['date'],500),Gp(['date'],500),A(['date'],['sessions','activeUsers','newUsers'],500),Ap(['date'],['sessions','activeUsers','newUsers'],500)])
      result.gsc=gc; result.gsc_prev=gp; result.ga4=ac; result.ga4_prev=ap
    }

    return NextResponse.json(result)
  } catch(e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

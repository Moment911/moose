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
  // Refresh
  if (!conn.refresh_token) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '',
      client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET?.trim() || '',
      refresh_token: conn.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null
  // Save refreshed token
  await supabase.from('seo_connections').update({
    access_token:     data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', conn.id)
  return data.access_token
}

async function fetchGSC(token: string, siteUrl: string, startDate: string, endDate: string) {
  if (!siteUrl) return null
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate, endDate,
      dimensions: ['query'],
      rowLimit: 100,
      aggregationType: 'auto',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('GSC error:', err)
    return null
  }
  return res.json()
}

async function fetchGA4(token: string, propertyId: string, startDate: string, endDate: string) {
  if (!propertyId) return null
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions:  [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'bounceRate' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
      ],
      limit: 20,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('GA4 error:', err)
    return null
  }
  return res.json()
}

async function listGSCSites(token: string) {
  const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, days = 30 } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

    // Load connections
    const { data: connections } = await supabase
      .from('seo_connections')
      .select('*')
      .eq('client_id', client_id)
      .eq('connected', true)

    if (!connections?.length) {
      return NextResponse.json({ error: 'No connections found' }, { status: 404 })
    }

    const gscConn  = connections.find(c => c.provider === 'search_console')
    const ga4Conn  = connections.find(c => c.provider === 'analytics')

    const endDate   = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

    // Also get previous period for comparison
    const prevEnd   = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(Date.now() - days * 2 * 86400000).toISOString().split('T')[0]

    const result: any = { gsc: null, ga4: null, gsc_prev: null, ga4_prev: null, sites: null }

    // Fetch GSC data
    if (gscConn) {
      const token = await getValidToken(gscConn)
      if (token) {
        // List sites if no site_url saved
        if (!gscConn.site_url) {
          const sitesData = await listGSCSites(token)
          result.sites = sitesData?.siteEntry || []
          // Auto-use first verified site
          const firstSite = result.sites.find((s:any) => s.permissionLevel !== 'siteUnverifiedUser')
          if (firstSite) {
            await supabase.from('seo_connections').update({ site_url: firstSite.siteUrl }).eq('id', gscConn.id)
            gscConn.site_url = firstSite.siteUrl
          }
        }
        if (gscConn.site_url) {
          const [curr, prev] = await Promise.all([
            fetchGSC(token, gscConn.site_url, startDate, endDate),
            fetchGSC(token, gscConn.site_url, prevStart, prevEnd),
          ])
          result.gsc      = curr
          result.gsc_prev = prev
          result.gsc_site = gscConn.site_url
        }
      }
    }

    // Fetch GA4 data
    if (ga4Conn) {
      const token = await getValidToken(ga4Conn)
      if (token) {
        // List properties if no property_id saved
        let propertyId = ga4Conn.property_id
        if (!propertyId) {
          const accRes = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (accRes.ok) {
            const accounts = await accRes.json()
            const firstAccount = accounts.accounts?.[0]
            if (firstAccount) {
              const propRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${firstAccount.name}/properties`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (propRes.ok) {
                const props = await propRes.json()
                const firstProp = props.properties?.[0]
                if (firstProp) {
                  propertyId = firstProp.name.replace('properties/', '')
                  await supabase.from('seo_connections').update({ property_id: propertyId }).eq('id', ga4Conn.id)
                }
              }
            }
          }
        }
        if (propertyId) {
          const [curr, prev] = await Promise.all([
            fetchGA4(token, propertyId, startDate, endDate),
            fetchGA4(token, propertyId, prevStart, prevEnd),
          ])
          result.ga4      = curr
          result.ga4_prev = prev
          result.ga4_property = propertyId
        }
      }
    }

    return NextResponse.json({ success: true, period: { startDate, endDate, days }, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { supabase } from './supabase'

// Refresh Google OAuth token
export async function refreshGoogleToken(connection) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || '',
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (data.access_token) {
      await supabase.from('seo_connections').update({
        access_token: data.access_token,
        token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id)
    }
    return data.access_token
  } catch (e) { console.error('Token refresh failed:', e); return null }
}

// Get valid access token for a connection
export async function getAccessToken(connection) {
  if (connection.token_expires_at && new Date(connection.token_expires_at) > new Date()) {
    return connection.access_token
  }
  return refreshGoogleToken(connection)
}

// Fetch Search Console data
export async function fetchSearchConsoleData(accessToken, siteUrl, startDate, endDate) {
  try {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions: ['query', 'page'], rowLimit: 500, aggregationType: 'auto' }),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// Fetch GA4 data
export async function fetchGA4Data(accessToken, propertyId, startDate, endDate) {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }, { name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'bounceRate' }, { name: 'conversions' }],
        limit: 500,
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// Load connections for a client
export async function loadClientConnections(clientId) {
  try {
    const { data } = await supabase.from('seo_connections').select('*').eq('client_id', clientId)
    return data || []
  } catch { return [] }
}

// Load all clients with SEO connection status
export async function loadSEOClients() {
  try {
    const { data: clients } = await supabase.from('clients').select('*').order('name')
    const { data: connections } = await supabase.from('seo_connections').select('client_id, provider, connected')
    const connMap = {}
    ;(connections || []).forEach(c => {
      if (!connMap[c.client_id]) connMap[c.client_id] = {}
      connMap[c.client_id][c.provider] = c.connected
    })
    return (clients || []).map(c => ({ ...c, connections: connMap[c.id] || {} }))
  } catch { return [] }
}

// Analyze keyword opportunities from search console data
export function analyzeKeywords(rows) {
  const opportunities = { quickWins: [], lowCTR: [], questions: [], local: [] }
  ;(rows || []).forEach(row => {
    const q = row.keys?.[0] || ''
    const pos = row.position || 0
    const imp = row.impressions || 0
    const clk = row.clicks || 0
    const ctr = row.ctr || 0

    if (pos >= 4 && pos <= 20 && imp > 50) {
      opportunities.quickWins.push({ keyword: q, position: Math.round(pos * 10) / 10, impressions: imp, clicks: clk, ctr: Math.round(ctr * 1000) / 10, potential: Math.round(imp * 0.3), priority: Math.round((21 - pos) * imp / 100) })
    }
    if (imp > 200 && ctr < 0.02) {
      opportunities.lowCTR.push({ keyword: q, impressions: imp, clicks: clk, currentCTR: Math.round(ctr * 1000) / 10, potentialClicks: Math.round(imp * 0.05) })
    }
    if (/^(what|how|why|when|where|who|which|can|does|is|are|will|should)/i.test(q)) {
      opportunities.questions.push({ keyword: q, position: pos, impressions: imp, aeoOpp: pos > 5 ? 'high' : 'medium' })
    }
    if (/near me|in \w+/i.test(q)) {
      opportunities.local.push({ keyword: q, position: pos, impressions: imp, clicks: clk })
    }
  })
  opportunities.quickWins.sort((a, b) => b.priority - a.priority)
  opportunities.lowCTR.sort((a, b) => b.potentialClicks - a.potentialClicks)
  return opportunities
}

// Score GMB health (from cached data)
export function scoreGMBHealth(gmbData) {
  if (!gmbData) return { score: 0, grade: 'F', issues: ['No GMB data connected'] }
  let score = 50 // base
  const issues = []
  if (gmbData.rating >= 4.5) score += 15
  else if (gmbData.rating < 4.0) issues.push('Rating below 4.0 stars')
  if (gmbData.responseRate >= 80) score += 10
  else issues.push(`Review response rate: ${gmbData.responseRate || 0}%`)
  if (gmbData.photoCount >= 20) score += 10
  else issues.push(`Only ${gmbData.photoCount || 0} photos`)
  if (gmbData.description) score += 5
  else issues.push('Missing business description')
  return { score: Math.min(100, score), grade: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D', issues }
}

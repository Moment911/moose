// ─────────────────────────────────────────────────────────────
// Google Business Profile API Client
// Uses OAuth tokens from seo_connections (provider: 'gmb')
//
// APIs used:
// - Business Profile Performance API (impressions, calls, searches)
// - My Business Business Information API (listing details)
// - My Business Q&A API (questions + answers)
// - My Business Account Management API (list accounts/locations)
// ─────────────────────────────────────────────────────────────

const MYBIZ_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const PERF_BASE = 'https://businessprofileperformance.googleapis.com/v1'
const QA_BASE = 'https://mybusinessqanda.googleapis.com/v1'
const ACCT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1'

async function gbpFetch(url: string, token: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GBP API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// ── List all accounts the user has access to ──
export async function listAccounts(token: string): Promise<any[]> {
  const data = await gbpFetch(`${ACCT_BASE}/accounts`, token)
  return data.accounts || []
}

// ── List all locations for an account ──
export async function listLocations(token: string, accountName: string): Promise<any[]> {
  const data = await gbpFetch(`${MYBIZ_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata,profile,serviceArea,labels`, token)
  return data.locations || []
}

// ── Get location details ──
export async function getLocation(token: string, locationName: string): Promise<any> {
  return gbpFetch(`${MYBIZ_BASE}/${locationName}?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata,profile,serviceArea,labels,openInfo,moreHours`, token)
}

// ── Performance metrics (impressions, searches, calls, directions) ──
export async function getPerformanceMetrics(token: string, locationName: string, days: number = 30): Promise<any> {
  const endDate = new Date()
  const startDate = new Date(Date.now() - days * 86400000)

  // Daily metrics
  const dailyRes = await gbpFetch(
    `${PERF_BASE}/${locationName}:getDailyMetricsTimeSeries`, token, 'GET'
  ).catch(() => null)

  // Search keywords
  const searchRes = await gbpFetch(
    `${PERF_BASE}/${locationName}/searchkeywords/impressions/monthly`, token
  ).catch(() => null)

  return {
    daily_metrics: dailyRes,
    search_keywords: searchRes?.searchKeywordsCounts || [],
  }
}

// ── Get reviews ──
export async function getReviews(token: string, accountName: string, locationName: string): Promise<any[]> {
  try {
    // Reviews API uses the older mybusiness.googleapis.com endpoint
    const data = await gbpFetch(
      `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews?pageSize=50`, token
    )
    return data.reviews || []
  } catch {
    return []
  }
}

// ── Q&A — list questions ──
export async function listQuestions(token: string, locationName: string): Promise<any[]> {
  try {
    const data = await gbpFetch(`${QA_BASE}/${locationName}/questions`, token)
    return data.questions || []
  } catch {
    return []
  }
}

// ── Q&A — answer a question ──
export async function answerQuestion(token: string, questionName: string, answerText: string): Promise<any> {
  return gbpFetch(`${QA_BASE}/${questionName}/answers`, token, 'POST', {
    text: answerText,
  })
}

// ── Update location info (hours, description, etc.) ──
export async function updateLocation(token: string, locationName: string, updates: any, updateMask: string): Promise<any> {
  return gbpFetch(`${MYBIZ_BASE}/${locationName}?updateMask=${updateMask}`, token, 'PATCH', updates)
}

// ── Full GBP data pull — combines all APIs ──
export async function pullFullGBPData(token: string): Promise<{
  accounts: any[]
  locations: any[]
  performance: any
  reviews: any[]
  questions: any[]
}> {
  // Step 1: List accounts
  const accounts = await listAccounts(token)
  if (!accounts.length) return { accounts: [], locations: [], performance: null, reviews: [], questions: [] }

  // Step 2: List locations for first account
  const firstAccount = accounts[0]
  const locations = await listLocations(token, firstAccount.name)
  if (!locations.length) return { accounts, locations: [], performance: null, reviews: [], questions: [] }

  // Step 3: Get performance + reviews + Q&A for first location
  const firstLocation = locations[0]
  const [performance, reviews, questions] = await Promise.all([
    getPerformanceMetrics(token, firstLocation.name).catch(() => null),
    getReviews(token, firstAccount.name, firstLocation.name),
    listQuestions(token, firstLocation.name),
  ])

  return { accounts, locations, performance, reviews, questions }
}

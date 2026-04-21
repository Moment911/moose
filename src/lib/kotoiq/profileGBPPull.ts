import 'server-only'
import { MODELS, FEATURE_TAGS, SOURCE_CONFIG } from './profileConfig'
import type { ProvenanceRecord } from './profileTypes'
import type { ExtractedFieldRecord } from './profileExtractClaude'
import { logTokenUsage } from '../tokenTracker'
import { refreshAccessToken, type TokenResponse } from './profileGBPOAuth'
import { getKotoIQDb } from '../kotoiqDb'
import { encryptSecret } from './profileIntegrationsVault'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 / Plan 06 — GBP Authenticated Pull (Mode 1/2 — PROF-09)
//
// Fetches from the Business Information API using the agency/client OAuth token.
// Maps GBP Location fields to ProvenanceRecord[] with source_type='gbp_authenticated'.
// On 401: refresh token, persist new access_token, retry once.
//
// Endpoints used:
//   Business Info: https://mybusinessbusinessinformation.googleapis.com/v1/{location}?readMask=...
//   Reviews (legacy): https://mybusiness.googleapis.com/v4/{location}/reviews
// ─────────────────────────────────────────────────────────────────────────────

export type GBPAuthPullArgs = {
  agencyId: string
  clientId: string
  accessToken: string
  refreshToken: string
  integrationRowId: string
  /** Full resource name like 'accounts/123/locations/456' */
  locationName: string
}

const BUSINESS_INFO_READ_MASK = [
  'title', 'categories', 'phoneNumbers', 'websiteUri',
  'regularHours', 'serviceArea', 'profile', 'storefrontAddress', 'labels',
].join(',')

export async function pullFromGBPAuth(args: GBPAuthPullArgs): Promise<ExtractedFieldRecord[]> {
  let token = args.accessToken

  async function get<T>(path: string): Promise<{ status: number; body: T | null }> {
    const r = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${path}?readMask=${encodeURIComponent(BUSINESS_INFO_READ_MASK)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return { status: r.status, body: r.ok ? await r.json() as T : null }
  }

  let res = await get<any>(args.locationName)
  if (res.status === 401) {
    // Refresh token and retry once
    const refreshed = await refreshAccessToken(args.refreshToken)
    token = refreshed.access_token
    // Persist new token encrypted
    const db = getKotoIQDb(args.agencyId)
    const { data: row } = await db.agencyIntegrations.get(args.integrationRowId)
    if (row) {
      const payload = encryptSecret(JSON.stringify({
        access_token: token,
        refresh_token: args.refreshToken,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      }), args.agencyId)
      await db.agencyIntegrations.upsert({
        ...row,
        encrypted_payload: payload,
      })
    }
    res = await get<any>(args.locationName)
  }
  if (!res.body) throw new Error(`GBP_AUTH_HTTP_${res.status}`)
  const loc = res.body

  const now = new Date().toISOString()
  const ceiling = SOURCE_CONFIG.gbp_authenticated.confidence_ceiling

  const mk = (field_name: string, value: any, snippet: string, confidence = ceiling): ExtractedFieldRecord => ({
    field_name,
    record: {
      value,
      source_type: 'gbp_authenticated',
      source_url: `gbp://${args.locationName}`,
      source_snippet: snippet,
      captured_at: now,
      confidence: Math.min(confidence, ceiling),
    },
  })

  const records: ExtractedFieldRecord[] = []

  if (loc.title) {
    records.push(mk('business_name', String(loc.title), `GBP title: ${loc.title}`))
  }
  if (loc.categories?.primaryCategory?.displayName) {
    records.push(mk('primary_service', loc.categories.primaryCategory.displayName,
      `GBP primary category: ${loc.categories.primaryCategory.displayName}`))
  }
  if (loc.phoneNumbers?.primaryPhone) {
    records.push(mk('phone', loc.phoneNumbers.primaryPhone,
      `GBP phone: ${loc.phoneNumbers.primaryPhone}`))
  }
  if (loc.websiteUri) {
    records.push(mk('website', loc.websiteUri, `GBP website: ${loc.websiteUri}`))
  }
  if (loc.serviceArea?.regionCode || loc.serviceArea?.places?.placeInfos?.length) {
    const areas: string[] = []
    if (Array.isArray(loc.serviceArea?.regionCode)) areas.push(...loc.serviceArea.regionCode)
    if (Array.isArray(loc.serviceArea?.places?.placeInfos)) {
      areas.push(...loc.serviceArea.places.placeInfos.map((p: any) => p.placeName).filter(Boolean))
    }
    if (areas.length) {
      records.push(mk('service_area', areas, `GBP service area: ${areas.join(', ')}`))
    }
  }
  if (loc.regularHours?.periods?.length) {
    records.push(mk('hours' as any, formatHours(loc.regularHours.periods),
      `GBP regularHours: ${JSON.stringify(loc.regularHours.periods).slice(0, 200)}`))
  }

  // Review themes (Haiku summarization)
  const themes = await summarizeReviewThemes({
    accessToken: token,
    locationName: args.locationName,
    agencyId: args.agencyId,
    clientId: args.clientId,
    maxReviews: 50,
    sourceType: 'gbp_authenticated',
  })
  for (const t of themes) {
    records.push({
      field_name: 'pain_point_emphasis',
      record: {
        value: t.theme,
        source_type: 'gbp_authenticated',
        source_url: `gbp://${args.locationName}#review-theme`,
        source_snippet: `Review theme (${t.supporting_count} reviews): ${t.theme}`,
        captured_at: now,
        confidence: Math.min(0.7, ceiling),
      },
    })
  }

  // Log token usage for GBP_AUTH_EXTRACT
  void logTokenUsage({
    feature: FEATURE_TAGS.GBP_AUTH_EXTRACT,
    model: 'google_business_api',
    inputTokens: 0,
    outputTokens: 0,
    agencyId: args.agencyId,
    metadata: { client_id: args.clientId, source_type: 'gbp_authenticated', location: args.locationName },
  })

  return records
}

export function formatHours(periods: Array<any>): string {
  return periods.map(p =>
    `${p.openDay ?? '?'} ${p.openTime?.hours ?? '?'}:${String(p.openTime?.minutes ?? '00').padStart(2, '0')}-${p.closeTime?.hours ?? '?'}:${String(p.closeTime?.minutes ?? '00').padStart(2, '0')}`
  ).join('; ')
}

// ── Review-theme Haiku summarization (D-13) ────────────────────────────────
export type ReviewTheme = {
  theme: string
  sentiment: 'positive' | 'negative' | 'mixed'
  supporting_count: number
}

export async function summarizeReviewThemes(args: {
  accessToken: string
  locationName: string
  agencyId: string
  clientId: string
  maxReviews: number
  sourceType: 'gbp_authenticated' | 'gbp_public'
  /** For Mode 3: pass reviews directly rather than fetching from Reviews API */
  providedReviews?: Array<{ text: string; rating?: number }>
}): Promise<ReviewTheme[]> {
  let reviews: Array<{ text: string; rating?: number }> = args.providedReviews ?? []

  if (!reviews.length && args.sourceType === 'gbp_authenticated') {
    // Fetch reviews from GBP Reviews API (legacy endpoint)
    const r = await fetch(
      `https://mybusiness.googleapis.com/v4/${args.locationName}/reviews?pageSize=${args.maxReviews}`,
      { headers: { Authorization: `Bearer ${args.accessToken}` } }
    )
    if (r.ok) {
      const body = await r.json() as any
      reviews = (body?.reviews ?? []).map((rv: any) => ({
        text: rv.comment ?? '',
        rating: rv.starRating,
      }))
    }
  }

  if (!reviews.length) return []

  const prompt = `Summarize the dominant themes in these customer reviews. Return ONLY JSON: {"themes":[{"theme":"...","sentiment":"positive|negative|mixed","supporting_count":N}]}. Top 5 themes max.\n\nREVIEWS:\n${reviews.slice(0, 50).map((r, i) => `${i + 1}. [${r.rating ?? '?'}] ${r.text}`).join('\n')}`

  const body = {
    model: MODELS.HAIKU,
    max_tokens: 2000,
    system: 'You are a precise JSON extractor. Output ONLY valid JSON, no prose, no markdown fences.',
    messages: [{ role: 'user' as const, content: prompt }],
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': MODELS.ANTHROPIC_VERSION,
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) return []

  const resp = await r.json() as any
  void logTokenUsage({
    feature: FEATURE_TAGS.GBP_REVIEW_THEMES,
    model: MODELS.HAIKU,
    inputTokens: resp?.usage?.input_tokens ?? 0,
    outputTokens: resp?.usage?.output_tokens ?? 0,
    agencyId: args.agencyId,
    metadata: { client_id: args.clientId, source_type: args.sourceType, review_count: reviews.length },
  })

  try {
    const text = (resp?.content?.[0]?.text ?? '').replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(text) as { themes: ReviewTheme[] }
    return Array.isArray(parsed?.themes) ? parsed.themes.slice(0, 5) : []
  } catch {
    return []
  }
}

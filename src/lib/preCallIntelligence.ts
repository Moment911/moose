// ── Pre-Call Intelligence Engine ──────────────────────────────────────────────
// Enriches caller/lead data before or at the start of a call so the AI agent
// (and the closer dashboard) have maximum context.

import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PreCallIntel {
  lead: Record<string, any> | null
  client: Record<string, any> | null
  callerHistory: CallerHistory
  businessInfo: BusinessInfo | null
  aiBriefing: string | null
  enrichedAt: string
}

export interface CallerHistory {
  totalCalls: number
  lastCallDate: string | null
  lastOutcome: string | null
  avgDuration: number
  callIds: string[]
}

export interface BusinessInfo {
  name: string
  rating: number | null
  reviewCount: number | null
  address: string | null
  phone: string | null
  website: string | null
  types: string[]
  placeId: string | null
}

// ── Main enrichment function ─────────────────────────────────────────────────

export async function enrichCallerData(
  phoneNumber: string,
  agencyId?: string,
): Promise<PreCallIntel> {
  const s = sb()
  const phone = normalizePhone(phoneNumber)

  // Run all lookups in parallel
  const [leadResult, clientResult, historyResult] = await Promise.all([
    findLead(s, phone, agencyId),
    findClient(s, phone, agencyId),
    getCallerHistory(s, phone, agencyId),
  ])

  // Try business research if we have a company name
  const companyName =
    leadResult?.prospect_company ||
    clientResult?.business_name ||
    leadResult?.prospect_name ||
    null

  let businessInfo: BusinessInfo | null = null
  if (companyName) {
    businessInfo = await researchBusiness(companyName, leadResult?.city || clientResult?.city || '')
  }

  // Generate AI briefing with all gathered context
  let aiBriefing: string | null = null
  const hasContext = leadResult || clientResult || historyResult.totalCalls > 0 || businessInfo
  if (hasContext) {
    aiBriefing = await generateBriefing({
      lead: leadResult,
      client: clientResult,
      history: historyResult,
      business: businessInfo,
      phone,
    })
  }

  return {
    lead: leadResult,
    client: clientResult,
    callerHistory: historyResult,
    businessInfo,
    aiBriefing,
    enrichedAt: new Date().toISOString(),
  }
}

// ── Database lookups ─────────────────────────────────────────────────────────

async function findLead(
  s: ReturnType<typeof sb>,
  phone: string,
  agencyId?: string,
): Promise<Record<string, any> | null> {
  let query = s.from('koto_voice_leads').select('*').eq('prospect_phone', phone)
  if (agencyId) query = query.eq('agency_id', agencyId)
  const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data || null
}

async function findClient(
  s: ReturnType<typeof sb>,
  phone: string,
  agencyId?: string,
): Promise<Record<string, any> | null> {
  let query = s.from('clients').select('*').eq('phone', phone)
  if (agencyId) query = query.eq('agency_id', agencyId)
  const { data } = await query.limit(1).maybeSingle()
  return data || null
}

async function getCallerHistory(
  s: ReturnType<typeof sb>,
  phone: string,
  agencyId?: string,
): Promise<CallerHistory> {
  let query = s.from('koto_voice_calls').select('retell_call_id, status, duration_seconds, created_at')
  // Match on from_number or to_number
  query = query.or(`from_number.eq.${phone},to_number.eq.${phone}`)
  if (agencyId) query = query.eq('agency_id', agencyId)
  const { data } = await query.order('created_at', { ascending: false }).limit(20)

  const calls = data || []
  const durations = calls.map((c: any) => c.duration_seconds || 0).filter((d: number) => d > 0)

  return {
    totalCalls: calls.length,
    lastCallDate: calls[0]?.created_at || null,
    lastOutcome: calls[0]?.status || null,
    avgDuration: durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0,
    callIds: calls.map((c: any) => c.retell_call_id),
  }
}

// ── Google Places research ───────────────────────────────────────────────────

async function researchBusiness(name: string, city: string): Promise<BusinessInfo | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
  if (!apiKey || !name) return null

  try {
    const query = city ? `${name} ${city}` : name
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,rating,user_ratings_total,formatted_address,formatted_phone_number,website,types,place_id&key=${apiKey}`

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null

    const json = await res.json()
    const place = json.candidates?.[0]
    if (!place) return null

    return {
      name: place.name || name,
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || null,
      address: place.formatted_address || null,
      phone: place.formatted_phone_number || null,
      website: place.website || null,
      types: place.types || [],
      placeId: place.place_id || null,
    }
  } catch {
    return null
  }
}

// ── AI Briefing ──────────────────────────────────────────────────────────────

async function generateBriefing(ctx: {
  lead: Record<string, any> | null
  client: Record<string, any> | null
  history: CallerHistory
  business: BusinessInfo | null
  phone: string
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const parts: string[] = []

  if (ctx.lead) {
    parts.push(`LEAD DATA: ${ctx.lead.prospect_name || 'Unknown'} at ${ctx.lead.prospect_company || 'unknown company'}. Industry: ${ctx.lead.industry || 'unknown'}. Pain point: ${ctx.lead.prospect_pain_point || 'not captured'}. Status: ${ctx.lead.status || 'new'}. Lead score: ${ctx.lead.lead_score || 'N/A'}.`)
  }

  if (ctx.client) {
    parts.push(`CLIENT RECORD: ${ctx.client.business_name || ctx.client.name || 'Unknown'}. Current services: ${ctx.client.active_services || 'none listed'}. Monthly spend: ${ctx.client.monthly_spend || 'unknown'}. Status: ${ctx.client.status || 'active'}.`)
  }

  if (ctx.history.totalCalls > 0) {
    parts.push(`CALL HISTORY: ${ctx.history.totalCalls} previous calls. Last call: ${ctx.history.lastCallDate || 'unknown'}. Last outcome: ${ctx.history.lastOutcome || 'unknown'}. Avg duration: ${ctx.history.avgDuration}s.`)
  }

  if (ctx.business) {
    parts.push(`BUSINESS RESEARCH: ${ctx.business.name}. Rating: ${ctx.business.rating || 'N/A'}/5 (${ctx.business.reviewCount || 0} reviews). Address: ${ctx.business.address || 'unknown'}. Website: ${ctx.business.website || 'none found'}. Category: ${ctx.business.types.slice(0, 3).join(', ') || 'unknown'}.`)
  }

  if (parts.length === 0) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a sales intelligence analyst. Based on the following data about a caller/prospect, write a concise pre-call briefing (3-5 bullet points) for the sales agent. Focus on: key talking points, potential objections to prepare for, and the best approach angle. Be specific and actionable.\n\n${parts.join('\n\n')}\n\nRespond with ONLY the bullet points, no intro or outro.`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return null
    const json = await res.json()
    return json.content?.[0]?.text || null
  } catch {
    return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  return '+' + digits
}

import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { pick } from '../kotoClientPick'
import type { ProvenanceRecord, SourceType } from './profileTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 / Plan 2 — Internal source pullers (Koto onboarding + recipients +
// discovery + voice post-call analysis).
//
// Each puller returns ProvenanceRecord arrays per canonical field so the
// downstream merger (Plan 3) can run discrepancy detection across sources.
// Every puller MUST:
//   - filter `.eq('agency_id', ctx.agencyId)` (T-07-01c cross-agency guard)
//   - skip soft-deleted clients with `.is('deleted_at', null)`
//   - emit ProvenanceRecord per D-04 (source_type + captured_at + confidence
//     + either source_url or source_ref)
//
// Source mappings come from 07-RESEARCH.md §3.1-3.4 and the dual-storage
// pattern in `_knowledge/modules/onboarding.md` (dedicated columns +
// `onboarding_answers` jsonb).  The shared `pick(client, ...keys)` helper
// (Plan 1, src/lib/kotoClientPick.ts) resolves first-non-empty across both.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hellokoto.com'

function sb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

// ── Row shapes ──────────────────────────────────────────────────────────────
// Production-grade typing of every column on these tables is out of scope for
// this plan; we read jsonb keys reflectively.  The `Record<string, any>` shape
// matches the kotoiqDb.ts idiom established in Plan 1 — every helper that
// touches Supabase jsonb in this codebase uses the same alias style so callers
// can destructure freely.  Narrowing happens at the use site (Array.isArray,
// String(...), the clamp01 + toIntOrNull coercion helpers below).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientsRow = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DiscoveryRow = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RecipientRow = Record<string, any>

export type Ctx = { clientId: string; agencyId: string; nowIso?: string }

function nowIsoOr(s?: string | null): string {
  return s || new Date().toISOString()
}

/**
 * Build a ProvenanceRecord with sane defaults so call sites don't have to
 * spell out every key.  Confidence defaults to 0.8 — every caller below
 * passes an explicit value, so the default only protects future code paths.
 * Confidence is always clamped to [0, 1] (T-07-11 — guards against tampering
 * via `clients.onboarding_confidence_scores` jsonb).
 */
function makeRec(
  partial: Partial<ProvenanceRecord> & { value: ProvenanceRecord['value'] },
): ProvenanceRecord {
  const { confidence, source_type, captured_at, ...rest } = partial
  return {
    source_type: source_type ?? 'onboarding_form',
    captured_at: captured_at ?? new Date().toISOString(),
    confidence: clamp01(confidence ?? 0.8),
    ...rest,
  } as ProvenanceRecord
}

/** Clamp a confidence value to [0, 1]; protects against jsonb tampering (T-07-11). */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Coerce a stringy year ("2019", "2019.0", "founded 2019") to int, else null. */
function toIntOrNull(s: string | null): number | null {
  if (s === null || s === '') return null
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. pullFromClient — clients table (dedicated columns + onboarding_answers jsonb)
//    Mapping verbatim from RESEARCH §3.1
// ─────────────────────────────────────────────────────────────────────────────
export async function pullFromClient(
  ctx: Ctx,
): Promise<{ client: ClientsRow | null; records: Record<string, ProvenanceRecord[]> }> {
  const { data: client, error } = await sb()
    .from('clients')
    .select('*')
    .eq('id', ctx.clientId)
    .eq('agency_id', ctx.agencyId) // MANDATORY — T-07-01c cross-agency guard
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !client) return { client: null, records: {} }

  const sourceUrl = `${APP_URL}/clients/${ctx.clientId}`
  const captured = nowIsoOr(client.updated_at)
  const records: Record<string, ProvenanceRecord[]> = {}

  const addIf = (
    field: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    confidence: number,
    source_type: SourceType = 'onboarding_form',
  ) => {
    if (value === null || value === undefined || value === '') return
    const rec = makeRec({
      value,
      source_type,
      source_url: sourceUrl,
      source_ref: `clients:${ctx.clientId}:${field}`,
      captured_at: captured,
      confidence,
    })
    records[field] = records[field] || []
    records[field].push(rec)
  }

  // RESEARCH §3.1 mapping table — confidence values verbatim
  addIf('business_name', client.name, 1.0)
  addIf('website', pick(client, 'website') || null, 0.95)
  addIf('phone', pick(client, 'phone', 'primary_phone') || null, 0.9)
  addIf(
    'founding_year',
    toIntOrNull(pick(client, 'founding_year', 'year_founded', 'business_age')),
    0.8,
  )
  addIf(
    'primary_service',
    pick(client, 'primary_service', 'products_services', 'top_services') || null,
    0.85,
  )
  addIf(
    'target_customer',
    pick(client, 'target_customer', 'ideal_customer_desc', 'customer_types') || null,
    0.85,
  )
  addIf(
    'unique_selling_prop',
    pick(client, 'unique_selling_prop', 'why_choose_you') || null,
    0.8,
  )
  addIf('industry', pick(client, 'industry') || null, 0.9)
  addIf('city', pick(client, 'city', 'primary_city') || null, 0.95)
  addIf('state', pick(client, 'state') || null, 0.95)
  addIf(
    'service_area',
    pick(client, 'service_area', 'service_areas', 'geographic_focus') || null,
    0.8,
  )
  addIf(
    'marketing_budget',
    pick(client, 'marketing_budget', 'monthly_ad_budget', 'budget_for_agency') || null,
    0.8,
  )
  addIf(
    'welcome_statement',
    pick(client, 'welcome_statement', 'business_description') || null,
    0.7,
  )
  addIf('customer_pain_points', pick(client, 'customer_pain_points') || null, 0.75)
  addIf(
    'current_channels',
    pick(client, 'marketing_channels', 'current_ad_platforms') || null,
    0.7,
  )

  // Voice-derived rollup that already lives on clients (see voice-onboarding.md).
  // This is appended (not replaced) — the discrepancy catcher in Plan 3 handles
  // the form vs voice comparison.
  if (client.onboarding_call_summary) {
    addIf('welcome_statement', client.onboarding_call_summary, 0.8, 'voice_call')
  }

  // Per-field voice confidence scores (jsonb, untrusted) override the default
  // confidence ONLY where higher.  Always clamped to [0, 1] (T-07-11).
  const voiceConf = (client.onboarding_confidence_scores || {}) as Record<string, number>
  for (const [field, arr] of Object.entries(records)) {
    const override = clamp01(Number(voiceConf[field]))
    if (override > 0 && arr[0]) {
      arr[0].confidence = Math.max(arr[0].confidence, override)
    }
  }

  return { client, records }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. pullFromRecipients — koto_onboarding_recipients.answers jsonb per recipient
//    Excludes the `_call_analysis` key (handled in pullFromVoiceCallAnalysis)
//    and any other key that starts with `_` (treated as internal metadata).
// ─────────────────────────────────────────────────────────────────────────────
export async function pullFromRecipients(
  ctx: Ctx,
): Promise<Record<string, ProvenanceRecord[]>> {
  const { data: recipients } = await sb()
    .from('koto_onboarding_recipients')
    .select('*')
    .eq('client_id', ctx.clientId)
    .eq('agency_id', ctx.agencyId) // MANDATORY — T-07-01c
    .order('last_active_at', { ascending: false })

  if (!recipients || recipients.length === 0) return {}

  const out: Record<string, ProvenanceRecord[]> = {}
  const sourceUrl = `${APP_URL}/onboarding-dashboard/${ctx.clientId}`

  for (const r of recipients as RecipientRow[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answers = (r.answers || {}) as Record<string, any>
    const captured = nowIsoOr(r.last_active_at || r.updated_at || r.created_at)
    for (const [key, value] of Object.entries(answers)) {
      if (key.startsWith('_')) continue // _call_analysis + any other internal meta
      if (value === null || value === undefined || value === '') continue
      const strValue = Array.isArray(value)
        ? value.filter(Boolean).join(', ')
        : String(value).trim()
      if (!strValue) continue
      const canonical = mapOnboardingKeyToCanonical(key)
      if (!canonical) continue
      const rec = makeRec({
        value: strValue,
        source_type: 'onboarding_form',
        source_url: sourceUrl,
        source_ref: `recipient:${r.id}:${key}`,
        source_snippet: strValue.slice(0, 240),
        captured_at: captured,
        confidence: 0.8,
      })
      out[canonical] = out[canonical] || []
      out[canonical].push(rec)
    }
  }
  return out
}

/**
 * Onboarding-form key → canonical profile field name.
 * Returning `null` skips the key (we don't promote unknown jsonb keys —
 * Plan 3 handles operator-added custom fields separately).
 */
function mapOnboardingKeyToCanonical(key: string): string | null {
  const map: Record<string, string> = {
    // Service-y keys → primary_service
    products_services: 'primary_service',
    top_services: 'primary_service',
    primary_service: 'primary_service',
    // Customer-y keys → target_customer
    ideal_customer_desc: 'target_customer',
    customer_types: 'target_customer',
    target_customer: 'target_customer',
    // USP
    why_choose_you: 'unique_selling_prop',
    unique_selling_prop: 'unique_selling_prop',
    // Budget
    monthly_ad_budget: 'marketing_budget',
    budget_for_agency: 'marketing_budget',
    marketing_budget: 'marketing_budget',
    // Narrative
    business_description: 'welcome_statement',
    welcome_statement: 'welcome_statement',
    // Channels
    marketing_channels: 'current_channels',
    current_ad_platforms: 'current_channels',
    current_channels: 'current_channels',
    // Geography
    geographic_focus: 'service_area',
    service_areas: 'service_area',
    service_area: 'service_area',
    // Year founded
    founding_year: 'founding_year',
    year_founded: 'founding_year',
    business_age: 'founding_year',
    // Pass-through canonicals stored in jsonb
    competitors: 'competitors',
    differentiators: 'differentiators',
    pain_points: 'pain_points',
    customer_pain_points: 'customer_pain_points',
    trust_anchors: 'trust_anchors',
    industry: 'industry',
    website: 'website',
    phone: 'phone',
    city: 'city',
    state: 'state',
  }
  return map[key] || null
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. pullFromDiscovery — koto_discovery_engagements narrative-level fields
//    Section-level Haiku extraction lives in Plan 3 (RESEARCH §3.3 — Claude
//    Haiku per section is the cheapest reliable path; this plan only does the
//    deterministic top-level pull).
// ─────────────────────────────────────────────────────────────────────────────
export async function pullFromDiscovery(
  ctx: Ctx,
): Promise<{
  engagement: DiscoveryRow | null
  narrativeRecords: Record<string, ProvenanceRecord[]>
}> {
  const { data: engagement } = await sb()
    .from('koto_discovery_engagements')
    .select('*')
    .eq('client_id', ctx.clientId)
    .eq('agency_id', ctx.agencyId) // MANDATORY — T-07-01c
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!engagement) return { engagement: null, narrativeRecords: {} }

  const sourceUrl = `${APP_URL}/discovery/${engagement.id}`
  const captured = nowIsoOr(engagement.updated_at || engagement.created_at)
  const out: Record<string, ProvenanceRecord[]> = {}

  if (engagement.executive_summary) {
    const exec = String(engagement.executive_summary).trim()
    out.welcome_statement = [
      makeRec({
        value: exec,
        source_type: 'discovery_doc',
        source_url: sourceUrl,
        source_ref: `discovery_doc:${engagement.id}:executive_summary`,
        source_snippet: exec.slice(0, 240),
        captured_at: captured,
        confidence: 0.85,
      }),
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientAnswers = (engagement.client_answers || {}) as Record<string, any>
  for (const [key, value] of Object.entries(clientAnswers)) {
    const canonical = mapOnboardingKeyToCanonical(key)
    if (!canonical) continue
    const strValue = Array.isArray(value)
      ? value.filter(Boolean).join(', ')
      : String(value ?? '').trim()
    if (!strValue) continue
    out[canonical] = out[canonical] || []
    out[canonical].push(
      makeRec({
        value: strValue,
        source_type: 'discovery_doc',
        source_url: sourceUrl,
        source_ref: `discovery_doc:${engagement.id}:client_answers.${key}`,
        source_snippet: strValue.slice(0, 240),
        captured_at: captured,
        confidence: 0.8,
      }),
    )
  }

  return { engagement, narrativeRecords: out }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. pullFromVoiceCallAnalysis — koto_onboarding_recipients.answers._call_analysis
//    The voice webhook (src/app/api/onboarding/voice/route.ts:1651-1667) writes
//    structured Haiku output here.  Mapping verbatim from RESEARCH §3.4.
// ─────────────────────────────────────────────────────────────────────────────
export async function pullFromVoiceCallAnalysis(
  ctx: Ctx,
): Promise<Record<string, ProvenanceRecord[]>> {
  const { data: recipients } = await sb()
    .from('koto_onboarding_recipients')
    .select('id, answers, updated_at, created_at')
    .eq('client_id', ctx.clientId)
    .eq('agency_id', ctx.agencyId) // MANDATORY — T-07-01c
  if (!recipients || recipients.length === 0) return {}

  const out: Record<string, ProvenanceRecord[]> = {}

  for (const r of recipients as RecipientRow[]) {
    const analysis =
      r.answers &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r.answers._call_analysis as Record<string, any> | undefined)
    if (!analysis) continue
    const captured = analysis.analyzed_at || r.updated_at || r.created_at || new Date().toISOString()
    const callId = analysis.call_id || r.id
    const ref = `retell_call:${callId}`

    const add = (
      field: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any,
      confidence: number,
      snippet?: string,
    ) => {
      if (
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      )
        return
      // Lists stay as ProvenanceRecord.value: string[]; scalars stringify.
      const out_value: string | string[] = Array.isArray(value) ? value.map(String) : String(value)
      const out_snippet =
        snippet ||
        (Array.isArray(value)
          ? value.map(String).join(' · ').slice(0, 240)
          : String(value).slice(0, 240))
      out[field] = out[field] || []
      out[field].push(
        makeRec({
          value: out_value,
          source_type: 'voice_call',
          source_ref: ref,
          source_snippet: out_snippet,
          captured_at: captured,
          confidence,
        }),
      )
    }

    add('caller_sentiment', analysis.caller_sentiment, 1.0)
    add('follow_up_flag', analysis.follow_up_recommended, 1.0)
    add('expansion_signals', analysis.upsell_signals, 0.7)
    // Both hot_lead_reasons and notable_insights map to pain_point_emphasis
    // (RESEARCH §3.4) — we append both so the discrepancy catcher in Plan 3
    // can reconcile them.
    add('pain_point_emphasis', analysis.hot_lead_reasons, 0.75)
    add('pain_point_emphasis', analysis.notable_insights, 0.7)
    if (analysis.call_summary) {
      add('welcome_statement', analysis.call_summary, 0.85, analysis.call_summary)
    }
  }
  return out
}

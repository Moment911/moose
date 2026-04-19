// Scout touch helper — the one surface any server-side code uses to emit
// activity onto a Scout opportunity. Non-throwing by design: telemetry
// failures must never break the calling flow (webhooks, invoicing, etc.).
//
// Canonical activity taxonomy is documented in migration 20260509_scout_spine.sql.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────

export type OpportunitySource =
  | 'web_visitor' | 'scout' | 'voice_call' | 'inbound_call' | 'import' | 'manual'

export type ActivityType =
  // Calls
  | 'call_inbound' | 'call_outbound' | 'call_missed' | 'call_voicemail'
  // Email
  | 'email_sent' | 'email_opened' | 'email_replied' | 'email_forwarded' | 'email_bounced'
  // SMS
  | 'sms_sent' | 'sms_received' | 'sms_delivered' | 'sms_failed'
  // Meetings
  | 'meeting_scheduled' | 'meeting_rescheduled' | 'meeting_held' | 'meeting_no_show'
  // Documents (high-level — doc registry captures detail)
  | 'proposal_sent' | 'proposal_viewed' | 'proposal_accepted' | 'proposal_rejected'
  | 'invoice_sent' | 'invoice_viewed' | 'invoice_paid'
  | 'document_signed' | 'document_viewed'
  // CRM
  | 'stage_changed' | 'assigned' | 'tag_added' | 'tag_removed' | 'note_added'
  // Signals
  | 'intent_signal' | 'enrichment_update' | 'score_change' | 'dnc_scrub' | 'consent_captured'

export type DocumentType =
  | 'proposal' | 'agreement' | 'sow' | 'nda' | 'invoice'
  | 'discovery_doc' | 'quote' | 'contract' | 'receipt'

export type DocumentStatus =
  | 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected'
  | 'signed' | 'paid' | 'expired' | 'void'

type Result<T = {}> = { ok: true } & T | { ok: false; error: string }

// ── Client ───────────────────────────────────────────────────────────────

let cached: SupabaseClient | null = null
function sb(): SupabaseClient | null {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

// ── Find or create ───────────────────────────────────────────────────────

export interface FindOrCreateParams {
  agencyId: string
  source: OpportunitySource
  // Match keys (tried in order)
  opportunityId?: string
  visitorSessionId?: string
  voiceCallId?: string
  voiceLeadId?: string
  scoutLeadId?: string
  contactPhone?: string
  contactEmail?: string
  // Creation fallback fields
  companyName?: string
  contactName?: string
  website?: string
  industry?: string
  sicCode?: string
  clientId?: string
  intel?: Record<string, any>
}

export async function findOrCreateOpportunity(
  params: FindOrCreateParams,
): Promise<Result<{ opportunityId: string; created: boolean }>> {
  const client = sb()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  if (!params.agencyId) return { ok: false, error: 'agencyId required' }

  // 1. Try direct ID
  if (params.opportunityId) {
    const { data } = await client
      .from('koto_opportunities')
      .select('id')
      .eq('id', params.opportunityId)
      .eq('agency_id', params.agencyId)
      .maybeSingle()
    if (data?.id) return { ok: true, opportunityId: data.id, created: false }
  }

  // 2. Try match by source reference columns, then contact fields
  const matchers: Array<[string, string | undefined]> = [
    ['visitor_session_id', params.visitorSessionId],
    ['voice_call_id', params.voiceCallId],
    ['voice_lead_id', params.voiceLeadId],
    ['scout_lead_id', params.scoutLeadId],
    ['contact_phone', normalizePhone(params.contactPhone)],
    ['contact_email', params.contactEmail?.trim().toLowerCase()],
  ]

  for (const [col, val] of matchers) {
    if (!val) continue
    const { data } = await client
      .from('koto_opportunities')
      .select('id')
      .eq('agency_id', params.agencyId)
      .eq(col, val)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.id) return { ok: true, opportunityId: data.id, created: false }
  }

  // 3. Create
  const insertPayload: Record<string, any> = {
    agency_id: params.agencyId,
    source: params.source,
    stage: 'new',
    visitor_session_id: params.visitorSessionId || null,
    voice_call_id: params.voiceCallId || null,
    voice_lead_id: params.voiceLeadId || null,
    scout_lead_id: params.scoutLeadId || null,
    contact_phone: normalizePhone(params.contactPhone) || null,
    contact_email: params.contactEmail?.trim().toLowerCase() || null,
    company_name: params.companyName || null,
    contact_name: params.contactName || null,
    website: params.website || null,
    industry: params.industry || null,
    sic_code: params.sicCode || null,
    client_id: params.clientId || null,
    intel: params.intel || {},
  }

  const { data, error } = await client
    .from('koto_opportunities')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message || 'Insert failed' }
  return { ok: true, opportunityId: data.id, created: true }
}

// ── Record activity ──────────────────────────────────────────────────────

export interface RecordActivityParams {
  opportunityId: string
  activityType: ActivityType | string
  description?: string
  metadata?: Record<string, any>
}

export async function recordActivity(
  params: RecordActivityParams,
): Promise<Result<{ activityId: string }>> {
  const client = sb()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  if (!params.opportunityId) return { ok: false, error: 'opportunityId required' }
  if (!params.activityType) return { ok: false, error: 'activityType required' }

  const { data, error } = await client
    .from('koto_opportunity_activities')
    .insert({
      opportunity_id: params.opportunityId,
      activity_type: params.activityType,
      description: params.description || null,
      metadata: params.metadata || {},
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message || 'Insert failed' }
  return { ok: true, activityId: data.id }
}

// ── Page view ────────────────────────────────────────────────────────────

export interface RecordPageViewParams {
  opportunityId: string
  url: string
  pageTitle?: string
  durationSeconds?: number
  referrer?: string
}

export async function recordPageView(
  params: RecordPageViewParams,
): Promise<Result> {
  const client = sb()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  if (!params.opportunityId) return { ok: false, error: 'opportunityId required' }
  if (!params.url) return { ok: false, error: 'url required' }

  const { error } = await client.from('koto_opportunity_page_views').insert({
    opportunity_id: params.opportunityId,
    url: params.url,
    page_title: params.pageTitle || null,
    duration_seconds: params.durationSeconds || 0,
    referrer: params.referrer || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Documents ────────────────────────────────────────────────────────────

export interface RecordDocumentParams {
  opportunityId: string
  documentType: DocumentType | string
  documentId?: string
  externalUrl?: string
  title?: string
  status?: DocumentStatus | string
  totalValue?: number
  sentAt?: string
  viewedAt?: string
  acceptedAt?: string
  metadata?: Record<string, any>
  emitActivity?: boolean   // default true — emits matching activity_type
}

// Creates or upserts (by documentId if provided, else inserts a new row).
export async function recordDocument(
  params: RecordDocumentParams,
): Promise<Result<{ documentRowId: string }>> {
  const client = sb()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  if (!params.opportunityId) return { ok: false, error: 'opportunityId required' }
  if (!params.documentType) return { ok: false, error: 'documentType required' }

  // Check for existing row if documentId provided
  let existingId: string | null = null
  if (params.documentId) {
    const { data } = await client
      .from('koto_opportunity_documents')
      .select('id')
      .eq('opportunity_id', params.opportunityId)
      .eq('document_id', params.documentId)
      .maybeSingle()
    existingId = data?.id || null
  }

  const payload: Record<string, any> = {
    opportunity_id: params.opportunityId,
    document_type: params.documentType,
    document_id: params.documentId || null,
    external_url: params.externalUrl || null,
    title: params.title || null,
    status: params.status || 'draft',
    total_value: params.totalValue ?? null,
    sent_at: params.sentAt || null,
    viewed_at: params.viewedAt || null,
    accepted_at: params.acceptedAt || null,
    metadata: params.metadata || {},
    updated_at: new Date().toISOString(),
  }

  let rowId: string
  if (existingId) {
    const { data, error } = await client
      .from('koto_opportunity_documents')
      .update(payload)
      .eq('id', existingId)
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message || 'Update failed' }
    rowId = data.id
  } else {
    const { data, error } = await client
      .from('koto_opportunity_documents')
      .insert(payload)
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message || 'Insert failed' }
    rowId = data.id
  }

  if (params.emitActivity !== false) {
    const activityType = deriveDocActivity(params.documentType, params.status)
    if (activityType) {
      await recordActivity({
        opportunityId: params.opportunityId,
        activityType,
        description: params.title,
        metadata: {
          document_id: params.documentId,
          document_row_id: rowId,
          total_value: params.totalValue,
          ...(params.metadata || {}),
        },
      })
    }
  }

  return { ok: true, documentRowId: rowId }
}

// ── One-shot convenience: touch ─────────────────────────────────────────
// Resolves (or creates) the opportunity and emits an activity in one call.
// Use this from webhooks where you have a phone/email/call_id but may not
// have the opportunity row yet.

export interface TouchParams extends FindOrCreateParams {
  activityType: ActivityType | string
  description?: string
  metadata?: Record<string, any>
}

export async function touch(
  params: TouchParams,
): Promise<Result<{ opportunityId: string; created: boolean }>> {
  const found = await findOrCreateOpportunity(params)
  if (!found.ok) return found
  const act = await recordActivity({
    opportunityId: found.opportunityId,
    activityType: params.activityType,
    description: params.description,
    metadata: params.metadata,
  })
  if (!act.ok) return { ok: false, error: act.error }
  return { ok: true, opportunityId: found.opportunityId, created: found.created }
}

// ── Utilities ────────────────────────────────────────────────────────────

function normalizePhone(p?: string): string | undefined {
  if (!p) return undefined
  const digits = p.replace(/[^\d+]/g, '')
  if (!digits) return undefined
  // Keep leading +, strip everything else non-digit
  return digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : `+${digits.replace(/^\+/, '')}`
}

function deriveDocActivity(
  type: string,
  status?: string,
): ActivityType | null {
  const t = type.toLowerCase()
  const s = (status || 'sent').toLowerCase()
  if (t === 'proposal') {
    if (s === 'viewed') return 'proposal_viewed'
    if (s === 'accepted') return 'proposal_accepted'
    if (s === 'rejected') return 'proposal_rejected'
    return 'proposal_sent'
  }
  if (t === 'invoice') {
    if (s === 'viewed') return 'invoice_viewed'
    if (s === 'paid') return 'invoice_paid'
    return 'invoice_sent'
  }
  if (t === 'agreement' || t === 'contract' || t === 'sow' || t === 'nda') {
    if (s === 'signed') return 'document_signed'
    if (s === 'viewed') return 'document_viewed'
    return 'document_signed'
  }
  return null
}

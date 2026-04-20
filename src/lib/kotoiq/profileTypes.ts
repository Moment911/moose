import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Client Profile Seeder shared types
//
// Single source of truth for the type surface every plan in the phase consumes.
// Mirrors the migration `supabase/migrations/20260507_kotoiq_client_profile.sql`
// (kotoiq_client_profile + kotoiq_clarifications).
//
// Decisions referenced (see 07-CONTEXT.md):
//   D-04  every field carries the full provenance quintet
//   D-05  operator-added custom fields persist in fields jsonb (CANONICAL is a baseline)
//   D-10  margin notes — Claude proactive observations
//   D-11  multi-source ProvenanceRecord array per field for the discrepancy catcher
//   D-16  Clarification queue — three views of the same row
//   D-22  EntityGraphSeed contract for downstream consumers
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCE_TYPES = [
  // Phase 7 (unchanged, keep order)
  'onboarding_form',
  'voice_call',
  'discovery_doc',
  'operator_edit',
  'claude_inference',
  'uploaded_doc',
  'deferred_v2',
  // Phase 8 — D-26 (append in this exact order)
  'typeform_api',
  'jotform_api',
  'google_forms_api',
  'form_scrape',
  'website_scrape',
  'gbp_authenticated',
  'gbp_public',
  'pdf_text_extract',
  'pdf_image_extract',
  'docx_text_extract',
  'image_ocr_vision',
] as const
export type SourceType = typeof SOURCE_TYPES[number]

/**
 * D-04 provenance quintet — every field value in `fields` jsonb is wrapped in
 * one of these. Multiple records per field name (D-11) power the discrepancy
 * catcher: the seeder appends, the highest-confidence record wins (operator
 * edits always win; ties broken by numeric confidence).
 */
export type ProvenanceRecord = {
  value: string | number | string[] | null
  source_type: SourceType
  source_url?: string
  source_ref?: string
  source_snippet?: string
  char_offset_start?: number
  char_offset_end?: number
  captured_at: string
  confidence: number
  edit_history?: Array<{ at: string; by: string; prev_value: any }>
}

/**
 * Baseline schema (D-05) — operator may add custom field names beyond this
 * list and they persist in `fields` jsonb just the same. The first 11 names
 * are the hot columns mirrored to indexed text columns on the table; the
 * remainder are spillover stored in `fields` only.
 */
export const CANONICAL_FIELD_NAMES = [
  // Hot columns (must match migration column order)
  'business_name',
  'website',
  'primary_service',
  'target_customer',
  'service_area',
  'phone',
  'founding_year',
  'unique_selling_prop',
  'industry',
  'city',
  'state',
  // Spillover — onboarding form
  'marketing_budget',
  'welcome_statement',
  'customer_pain_points',
  'current_channels',
  'competitors',
  'differentiators',
  'pain_points',
  'service_areas',
  'trust_anchors',
  // Spillover — voice call post-analysis (Retell + Haiku)
  'expansion_signals',
  'competitor_mentions',
  'objections',
  'pain_point_emphasis',
  'caller_sentiment',
  'follow_up_flag',
] as const
export type CanonicalFieldName = typeof CANONICAL_FIELD_NAMES[number]

/**
 * D-22 entity graph seed contract — Stage 0 output that Stage 2 (entity graph)
 * and Stage 4 (content generation) read.  Keep the 8-key shape stable: the
 * downstream engines (`hyperlocalContentEngine`, `semanticAgents*`,
 * `eeatEngine`, `knowledgeGraphExporter`) destructure these by name.
 */
export type EntityGraphNode = {
  id: string
  label: string
  confidence: number
  source_refs: string[]
  metadata?: Record<string, any>
}

export type EntityGraphEdge = {
  from: string
  to: string
  kind: string
  confidence: number
  source_refs: string[]
}

export type EntityGraphSeed = {
  client_node: EntityGraphNode & { url?: string }
  service_nodes: EntityGraphNode[]
  audience_nodes: EntityGraphNode[]
  competitor_nodes: EntityGraphNode[]
  service_area_nodes: EntityGraphNode[]
  differentiator_edges: EntityGraphEdge[]
  trust_anchor_nodes: EntityGraphNode[]
  confidence_by_node: Record<string, number>
}

export type ClientProfile = {
  id: string
  agency_id: string
  client_id: string

  // Hot columns (D-02)
  business_name: string | null
  website: string | null
  primary_service: string | null
  target_customer: string | null
  service_area: string | null
  phone: string | null
  founding_year: number | null
  unique_selling_prop: string | null
  industry: string | null
  city: string | null
  state: string | null

  // Spillover with provenance (D-04, D-11)
  fields: Record<string, ProvenanceRecord[]>

  // Stage 0 → Stage 2 contract (D-22). Empty object before first seed.
  entity_graph_seed: EntityGraphSeed | Record<string, never>

  // Soft launch gate (D-13/14)
  completeness_score: number | null
  completeness_reasoning: string | null
  soft_gaps: Array<{ field: string; reason: string }>

  // D-10 margin notes — Claude proactive observations
  margin_notes: Array<{
    id: string
    field_path: string
    question: string
    suggested_value?: string | null
    source_ref: string
    created_at: string
    status: 'pending' | 'accepted' | 'rejected' | 'edited'
  }>

  // Source registry (D-09 drop zone + D-25 pasted text)
  sources: Array<{
    source_type: SourceType
    source_url?: string
    source_ref?: string
    added_at: string
    added_by: string
    metadata?: Record<string, any>
  }>

  // Lifecycle
  last_seeded_at: string | null
  last_edited_at: string | null
  launched_at: string | null
  last_pipeline_run_id: string | null
  created_at: string
  updated_at: string
}

// ── Clarification queue (D-16) ──────────────────────────────────────────────

export type ClarificationSeverity = 'low' | 'medium' | 'high'
export type ClarificationStatus = 'open' | 'asked_client' | 'answered' | 'skipped'
export type ClarificationChannel = 'sms' | 'email' | 'portal' | 'operator'

export type Clarification = {
  id: string
  agency_id: string
  client_id: string
  profile_id: string | null

  question: string
  reason: string | null
  target_field_path: string | null
  severity: ClarificationSeverity

  status: ClarificationStatus
  asked_channel: ClarificationChannel | null
  asked_at: string | null
  answered_at: string | null
  answer_text: string | null
  answered_by: string | null

  impact_hint: string | null
  impact_unlocks: Array<{ stage: string; unit: string }>

  created_at: string
  updated_at: string
}

/**
 * D-07 streaming ingest narration — discriminated union surfaced over an SSE
 * stream from the `/api/kotoiq/profile?action=seed` route to the Launch Page.
 */
export type NarrationEvent =
  | { kind: 'line'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'done' }

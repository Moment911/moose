import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Client Profile Seeder central config (single source of truth).
//
// Every Plan 2-8 module imports tunables from here.  Changing a model ID,
// halo threshold, or stage demand is a one-line edit in this file — never
// scattered across call sites.
//
// Keys derived from:
//   - 07-RESEARCH.md §4 (model selection + token feature tags + confidence rubric)
//   - 07-RESEARCH.md §6 (halo thresholds + cross-source discrepancy tolerance)
//   - 07-RESEARCH.md §7 (downstream stage-demand manifest)
//   - 07-RESEARCH.md §8 (severity + channel classifier prompts)
//   - 07-RESEARCH.md §10 (cost envelope — voice transcript cap)
//   - 07-RESEARCH.md §15 (security caps — pasted text size, debounce, SMS rate limit)
//   - 07-RESEARCH.md §17 (Risk #1 — model-ID drift mitigation)
//   - Plan 1 SUMMARY (canonical Sonnet/Haiku IDs grep-confirmed in src/)
//   - kotoiq_client_profile migration (hot column order)
// ─────────────────────────────────────────────────────────────────────────────

// ── Claude model IDs ─────────────────────────────────────────────────────────
// CONTEXT.md mentioned "Sonnet 4.6 / Haiku 4.5"; codebase is on 4.5/4.5.
// Upgrade path: change one string here, grep-upgradable across every call site.
export const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929',
  HAIKU: 'claude-haiku-4-5-20251001',
  ANTHROPIC_VERSION: '2023-06-01',
} as const

// ── Halo thresholds (UI-SPEC §3 + RESEARCH §6) ───────────────────────────────
export const HALO_THRESHOLDS = {
  CONFIDENT: 0.85, // ≥ this: bright halo
  GUESSED: 0.5, // between GUESSED and CONFIDENT: pale halo; < GUESSED: dashed outline
} as const

// ── Cross-source discrepancy tolerance (RESEARCH §6) ─────────────────────────
export const DISCREPANCY_TOLERANCE = {
  numeric: 0.2, // founding_year 2019 vs 2020 → not a discrepancy; vs 2015 → flagged
  string_similarity: 0.7, // Levenshtein-normalized
  list_symmetric_diff: 0.5, // competitors list 50%+ different → flag
} as const

// ── Downstream stage-demand manifest (RESEARCH §7 — Launch gate) ─────────────
// Claude uses this + current profile to judge "complete enough to start".
// Update this ONLY if a new pipeline stage consumes profile data.
export const STAGE_DEMANDS = {
  hyperlocal_content: {
    required: ['business_name', 'primary_service', 'service_area', 'phone'],
    preferred: ['unique_selling_prop', 'website', 'target_customer'],
    weight: 1.0,
  },
  strategy: {
    required: ['primary_service', 'target_customer', 'marketing_budget'],
    preferred: ['competitors', 'pain_points', 'current_channels'],
    weight: 0.9,
  },
  entity_graph: {
    required: ['business_name', 'primary_service', 'industry'],
    preferred: ['competitors', 'trust_anchors'],
    weight: 0.8,
  },
  query_path: {
    required: ['primary_service', 'target_customer'],
    preferred: ['pain_points'],
    weight: 0.7,
  },
  eeat: {
    required: [] as string[],
    preferred: ['trust_anchors', 'founding_year', 'unique_selling_prop'],
    weight: 0.6,
  },
} as const

// ── Token-usage feature tags (RESEARCH §4 — one tag per Claude call site) ────
export const FEATURE_TAGS = {
  // Phase 7 — keep existing verbatim
  NARRATE: 'profile_seed_narrate',
  EXTRACT: 'profile_seed_extract',
  VOICE_EXTRACT: 'profile_seed_voice_extract',
  DISCOVERY_EXTRACT: 'profile_seed_discovery_extract',
  DISCREPANCY_CHECK: 'profile_discrepancy_check',
  COMPLETENESS_GATE: 'profile_completeness_gate',
  CLARIFY_SEVERITY: 'profile_clarify_severity',
  CLARIFY_CHANNEL: 'profile_clarify_channel',
  CONFIDENCE_RESCORE: 'profile_confidence_rescore',
  // Phase 8 — D-26 (external-source parsers — one tag per source family + COST_PREVIEW)
  FORM_EXTRACT: 'profile_form_extract',
  WEBSITE_EXTRACT: 'profile_website_extract',
  GBP_AUTH_EXTRACT: 'profile_gbp_auth_extract',
  GBP_PUBLIC_EXTRACT: 'profile_gbp_public_extract',
  GBP_REVIEW_THEMES: 'profile_gbp_review_themes',
  PDF_TEXT_EXTRACT: 'profile_pdf_text_extract',
  PDF_VISION_EXTRACT: 'profile_pdf_vision_extract',
  DOCX_EXTRACT: 'profile_docx_extract',
  IMAGE_VISION_EXTRACT: 'profile_image_vision_extract',
  COST_PREVIEW: 'profile_cost_preview',
} as const

// ── Confidence scoring rubric (RESEARCH §4 — verbatim) ───────────────────────
export const CONFIDENCE_RUBRIC = `For each field, assign confidence 0.0-1.0 based on:
- 1.0: Exact, unambiguous statement in source (e.g. "We've been in business since 2019.")
- 0.85: Strong implication, minor ambiguity (e.g. "about six years" → founding_year ≈ 2020, conf=0.85)
- 0.6: Plausible inference with competing interpretations
- 0.3: Weak signal, could be anything
- 0.0: Not present — DO NOT include the field

Source snippets MUST be verbatim from the input, and char_offset must be exact.`

// ── Severity rules (RESEARCH §8 Haiku prompt) ────────────────────────────────
export const SEVERITY_RULES = `Classify clarification severity:
- high: blocks ≥ 3 downstream units OR affects core identity (business_name, primary_service, service_area)
- medium: blocks 1-2 units OR fills a preferred (not required) field
- low: nice-to-have, no blocking`

// ── Channel rules (RESEARCH §8 Haiku prompt — D-18) ──────────────────────────
export const CHANNEL_RULES = `Pick the best channel:
- Short factual Q (one sentence, ≤ 80 chars) → sms
- Long open-ended Q → email
- Persistent workflow item (multi-step or recurring) → portal
Operator can override per-Q via UI kebab.`

// ── Hard caps + rate limits (RESEARCH §10, §15) ──────────────────────────────
export const MAX_VOICE_TRANSCRIPT_PULLS = 10
export const MAX_PASTED_TEXT_CHARS = 50000
export const SEED_DEBOUNCE_SECONDS = 30 // refuse re-seed within 30s unless forceRebuild
export const SMS_RATE_LIMIT_PER_CLIENT_HOUR = 3 // channel abuse mitigation

// ── Hot columns (must match migration column order + first 11 CANONICAL_FIELD_NAMES) ──
export const HOT_COLUMNS = [
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
] as const
export type HotColumn = (typeof HOT_COLUMNS)[number]

// ─── Phase 8 ───────────────────────────────────────────────────────────────
// D-28 per-source registry — every Phase 8 SOURCE_TYPES value gets an entry.
// Keys MUST stay in sync with profileTypes.ts SOURCE_TYPES (enforced by the
// parity test at tests/kotoiq/phase8/profileConfig.test.ts).  Downstream
// parsers read confidence_ceiling + default_cost_cap from here, never
// hardcoded at call sites.
export const SOURCE_CONFIG: Record<string, {
  confidence_ceiling: number
  default_cost_cap: number  // USD
  feature_tag: keyof typeof FEATURE_TAGS
  display_label: string
}> = {
  typeform_api:       { confidence_ceiling: 0.9,  default_cost_cap: 0.05, feature_tag: 'FORM_EXTRACT',          display_label: 'Typeform (API)' },
  jotform_api:        { confidence_ceiling: 0.9,  default_cost_cap: 0.05, feature_tag: 'FORM_EXTRACT',          display_label: 'Jotform (API)' },
  google_forms_api:   { confidence_ceiling: 0.9,  default_cost_cap: 0.05, feature_tag: 'FORM_EXTRACT',          display_label: 'Google Forms (API)' },
  form_scrape:        { confidence_ceiling: 0.7,  default_cost_cap: 0.15, feature_tag: 'FORM_EXTRACT',          display_label: 'Form page scrape' },
  website_scrape:     { confidence_ceiling: 0.6,  default_cost_cap: 1.50, feature_tag: 'WEBSITE_EXTRACT',       display_label: 'Website crawl' },
  gbp_authenticated:  { confidence_ceiling: 0.85, default_cost_cap: 0.30, feature_tag: 'GBP_AUTH_EXTRACT',      display_label: 'Google Business Profile (connected)' },
  gbp_public:         { confidence_ceiling: 0.75, default_cost_cap: 0.10, feature_tag: 'GBP_PUBLIC_EXTRACT',    display_label: 'Google Business Profile (public)' },
  pdf_text_extract:   { confidence_ceiling: 0.75, default_cost_cap: 0.05, feature_tag: 'PDF_TEXT_EXTRACT',      display_label: 'PDF (text)' },
  pdf_image_extract:  { confidence_ceiling: 0.6,  default_cost_cap: 1.00, feature_tag: 'PDF_VISION_EXTRACT',    display_label: 'PDF (scanned/OCR)' },
  docx_text_extract:  { confidence_ceiling: 0.75, default_cost_cap: 0.05, feature_tag: 'DOCX_EXTRACT',          display_label: 'Word document' },
  image_ocr_vision:   { confidence_ceiling: 0.6,  default_cost_cap: 0.50, feature_tag: 'IMAGE_VISION_EXTRACT',  display_label: 'Image (OCR)' },
}

// D-22 + D-23 daily budget defaults. Per-agency overrides live in
// koto_agency_integrations (Plan 03) — these are the out-of-box values.
export const BUDGETS = {
  PER_CLIENT_DAILY_USD: 5,
  PER_AGENCY_DAILY_USD: 50,
  WARN_THRESHOLD_RATIO: 0.8,
} as const

// Koto-side rate limits — enforced in API route handlers
// (RESEARCH §Security Domain).  Cap bursty operator actions that cost money
// or external-quota (form fetches, GBP OAuth starts) regardless of budget.
export const RATE_LIMITS = {
  SEED_FORM_URL_PER_AGENCY_PER_MIN: 10,
  CONNECT_GBP_OAUTH_START_PER_AGENCY_PER_HOUR: 5,
} as const

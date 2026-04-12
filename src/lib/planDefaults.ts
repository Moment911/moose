// ── Plan feature defaults — single source of truth ──────────────────────────
//
// Both the permissions API and the client-side useAuth hook reference
// these defaults. Keeping them in one file prevents drift.
//
// When adding a new feature flag:
// 1. Add the column to agency_features table (migration)
// 2. Add it here with the correct tier gating
// 3. The permissions API's apply_plan_defaults action will pick it up
// 4. The sidebar's feat() helper will gate the nav item

export type PlanTier = 'starter' | 'growth' | 'agency' | 'enterprise'

export interface PlanFeatures {
  // Core tools (all plans)
  dashboard: boolean
  clients: boolean
  tasks: boolean
  reviews: boolean
  proposals: boolean
  page_builder: boolean
  seo_hub: boolean
  proof: boolean
  desk: boolean
  discovery: boolean
  scout: boolean
  marketplace: boolean

  // Growth+ features
  cmo_agent: boolean
  voice_agent: boolean
  answering_service: boolean
  ai_research: boolean
  phone_numbers: boolean
  kotoclose: boolean
  email_sequences: boolean
  email_tracking: boolean
  video_voicemails: boolean

  // Agency+ features
  white_label: boolean
  custom_domain: boolean
  api_access: boolean
  ai_personas: boolean
  ai_social_posts: boolean
  ai_review_responses: boolean
  billing: boolean
  agency_settings: boolean

  // Enterprise
  dedicated_support: boolean
  custom_integrations: boolean
}

export const PLAN_DEFAULTS: Record<PlanTier, PlanFeatures> = {
  starter: {
    dashboard: true, clients: true, tasks: true, reviews: true,
    proposals: true, page_builder: true, seo_hub: true, proof: true,
    desk: true, discovery: true, scout: true, marketplace: true,
    // Growth features OFF
    cmo_agent: false, voice_agent: false, answering_service: false,
    ai_research: false, phone_numbers: false, kotoclose: false,
    email_sequences: false, email_tracking: false, video_voicemails: false,
    // Agency features OFF
    white_label: false, custom_domain: false, api_access: false,
    ai_personas: false, ai_social_posts: false, ai_review_responses: false,
    billing: true, agency_settings: true,
    // Enterprise OFF
    dedicated_support: false, custom_integrations: false,
  },
  growth: {
    dashboard: true, clients: true, tasks: true, reviews: true,
    proposals: true, page_builder: true, seo_hub: true, proof: true,
    desk: true, discovery: true, scout: true, marketplace: true,
    // Growth features ON
    cmo_agent: true, voice_agent: true, answering_service: true,
    ai_research: true, phone_numbers: true, kotoclose: true,
    email_sequences: true, email_tracking: true, video_voicemails: true,
    // Agency features OFF
    white_label: false, custom_domain: false, api_access: false,
    ai_personas: false, ai_social_posts: false, ai_review_responses: false,
    billing: true, agency_settings: true,
    // Enterprise OFF
    dedicated_support: false, custom_integrations: false,
  },
  agency: {
    dashboard: true, clients: true, tasks: true, reviews: true,
    proposals: true, page_builder: true, seo_hub: true, proof: true,
    desk: true, discovery: true, scout: true, marketplace: true,
    cmo_agent: true, voice_agent: true, answering_service: true,
    ai_research: true, phone_numbers: true, kotoclose: true,
    email_sequences: true, email_tracking: true, video_voicemails: true,
    // Agency features ON
    white_label: true, custom_domain: true, api_access: true,
    ai_personas: true, ai_social_posts: true, ai_review_responses: true,
    billing: true, agency_settings: true,
    // Enterprise OFF
    dedicated_support: false, custom_integrations: false,
  },
  enterprise: {
    dashboard: true, clients: true, tasks: true, reviews: true,
    proposals: true, page_builder: true, seo_hub: true, proof: true,
    desk: true, discovery: true, scout: true, marketplace: true,
    cmo_agent: true, voice_agent: true, answering_service: true,
    ai_research: true, phone_numbers: true, kotoclose: true,
    email_sequences: true, email_tracking: true, video_voicemails: true,
    white_label: true, custom_domain: true, api_access: true,
    ai_personas: true, ai_social_posts: true, ai_review_responses: true,
    billing: true, agency_settings: true,
    // Enterprise ON
    dedicated_support: true, custom_integrations: true,
  },
}

export function getPlanDefaults(plan: string): PlanFeatures {
  return PLAN_DEFAULTS[(plan as PlanTier)] || PLAN_DEFAULTS.starter
}

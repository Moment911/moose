// ─────────────────────────────────────────────────────────────
// Ads Intelligence — Zod schemas for all LLM task inputs/outputs
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

// ── Shared enums ──────────────────────────────────────────────

export const MatchTypeSchema = z.enum(['exact', 'phrase', 'broad'])
export const PlatformSchema = z.enum(['google', 'meta', 'linkedin', 'tiktok'])
export const IntentSchema = z.enum([
  'informational', 'commercial', 'transactional', 'navigational', 'brand', 'irrelevant',
])

// ── classify_search_term ──────────────────────────────────────

export const ClassifySearchTermInput = z.object({
  search_term: z.string(),
  account_context: z.object({
    industry: z.string(),
    products_or_services: z.array(z.string()),
    geos: z.array(z.string()).optional(),
    excluded_audiences: z.array(z.string()).optional(),
  }),
  metrics: z.object({
    impressions: z.number(),
    clicks: z.number(),
    cost_usd: z.number(),
    conversions: z.number(),
  }),
})

export const SearchTermClassificationSchema = z.object({
  intent: IntentSchema,
  is_relevant_to_business: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason_one_sentence: z.string(),
})

// ── recommend_negatives ───────────────────────────────────────

export const RecommendNegativesInput = z.object({
  client_summary: z.string(),
  candidates: z.array(
    z.object({
      search_term: z.string(),
      cost_usd: z.number(),
      clicks: z.number(),
      conversions: z.number(),
      ad_groups_seen_in: z.array(z.string()),
      first_seen_date: z.string(),
      last_seen_date: z.string(),
    })
  ),
})

export const NegativeRecommendationSchema = z.object({
  search_term: z.string(),
  add_as: MatchTypeSchema,
  scope: z.enum(['account', 'campaign', 'ad_group']),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  estimated_monthly_savings_usd: z.number(),
})

export const NegativesResponseSchema = z.object({
  recommendations: z.array(NegativeRecommendationSchema),
  notes: z.string().optional(),
})

// ── recommend_new_keywords ────────────────────────────────────

export const RecommendNewKeywordsInput = z.object({
  client_summary: z.string(),
  existing_keywords_sample: z.array(z.string()).max(200),
  gsc_query_gaps: z.array(
    z.object({
      query: z.string(),
      impressions: z.number(),
      clicks: z.number(),
      avg_position: z.number(),
    })
  ),
  ad_group_options: z.array(
    z.object({ id: z.string(), name: z.string(), theme: z.string() })
  ),
  target_cpa_usd: z.number().optional(),
})

export const NewKeywordRecommendationSchema = z.object({
  keyword: z.string(),
  match_type: MatchTypeSchema,
  proposed_ad_group_id: z.string(),
  intent: IntentSchema,
  rationale: z.string(),
  estimated_monthly_clicks: z.number(),
  estimated_cpc_usd: z.number(),
  priority: z.enum(['high', 'medium', 'low']),
})

export const NewKeywordsResponseSchema = z.object({
  recommendations: z.array(NewKeywordRecommendationSchema),
  themes_observed: z.array(z.string()),
})

// ── generate_ad_copy_google (RSA) ─────────────────────────────

export const GoogleRSAInput = z.object({
  client_summary: z.string(),
  brand_voice_md: z.string(),
  campaign_theme: z.string(),
  ad_group_theme: z.string(),
  top_converting_terms: z.array(z.string()).max(20),
  landing_page: z.object({
    url: z.string(),
    title: z.string().optional(),
    h1: z.string().optional(),
    key_points: z.array(z.string()).optional(),
  }),
  offer: z.string(),
  must_include_keywords: z.array(z.string()).max(5),
  forbidden_phrases: z.array(z.string()).optional(),
})

export const GoogleRSASchema = z.object({
  headlines: z.array(
    z.object({
      text: z.string(),
      pin: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
      category: z.enum(['benefit', 'feature', 'cta', 'brand', 'social_proof', 'urgency']),
    })
  ).min(15).max(15),
  descriptions: z.array(
    z.object({
      text: z.string(),
      pin: z.union([z.literal(1), z.literal(2), z.null()]),
    })
  ).min(4).max(4),
  final_url: z.string(),
  path1: z.string().optional(),
  path2: z.string().optional(),
  rationale: z.string(),
})

// ── generate_ad_copy_meta ─────────────────────────────────────

export const MetaAdInput = z.object({
  client_summary: z.string(),
  brand_voice_md: z.string(),
  audience_persona: z.string(),
  objective: z.enum(['awareness', 'traffic', 'engagement', 'leads', 'sales']),
  offer: z.string(),
  landing_page_url: z.string(),
  format: z.enum(['single_image', 'carousel', 'video']),
  prior_winners: z.array(z.string()).max(5).optional(),
})

export const MetaAdSchema = z.object({
  variants: z.array(
    z.object({
      primary_text: z.string(),
      headline: z.string(),
      description: z.string(),
      cta: z.string(),
      creative_brief: z.string(),
      hook_concept: z.string(),
    })
  ).min(3).max(5),
  audience_targeting_suggestions: z.array(z.string()),
  rationale: z.string(),
})

// ── generate_ad_copy_linkedin ─────────────────────────────────

export const LinkedInAdInput = z.object({
  client_summary: z.string(),
  brand_voice_md: z.string(),
  buyer_persona: z.object({
    title: z.string(),
    seniority: z.string(),
    industry: z.string(),
    pain_points: z.array(z.string()),
  }),
  offer: z.string(),
  format: z.enum(['single_image', 'document', 'video', 'message']),
})

export const LinkedInAdSchema = z.object({
  variants: z.array(
    z.object({
      intro_text: z.string(),
      headline: z.string(),
      description: z.string(),
      cta: z.string(),
    })
  ).min(3).max(5),
  rationale: z.string(),
})

// ── generate_ad_copy_tiktok ───────────────────────────────────

export const TikTokAdInput = z.object({
  client_summary: z.string(),
  brand_voice_md: z.string(),
  audience_persona: z.string(),
  offer: z.string(),
  trending_themes: z.array(z.string()).optional(),
})

export const TikTokAdSchema = z.object({
  variants: z.array(
    z.object({
      hook_first_3_seconds: z.string(),
      script_outline: z.array(z.string()).max(8),
      on_screen_text: z.array(z.string()),
      sound_or_music_concept: z.string(),
      caption: z.string(),
      cta: z.string(),
    })
  ).min(3).max(5),
  rationale: z.string(),
})

// ── explain_anomaly ───────────────────────────────────────────

export const ExplainAnomalyInput = z.object({
  client_summary: z.string(),
  metric: z.string(),
  scope: z.string(),
  baseline_value: z.number(),
  observed_value: z.number(),
  delta_pct: z.number(),
  window_days: z.number(),
  contributors: z.array(
    z.object({
      entity_type: z.string(),
      entity_name: z.string(),
      contribution_pct: z.number(),
      delta_value: z.number(),
    })
  ),
  recent_changes: z.array(
    z.object({
      timestamp: z.string(),
      change_type: z.string(),
      description: z.string(),
    })
  ),
  ga4_correlation: z.object({
    paid_sessions_delta_pct: z.number(),
    paid_conversions_delta_pct: z.number(),
  }).optional(),
})

export const AnomalyExplanationSchema = z.object({
  most_likely_cause: z.string(),
  confidence: z.number().min(0).max(1),
  alternative_causes: z.array(z.string()),
  recommended_actions: z.array(
    z.object({
      action: z.string(),
      urgency: z.enum(['immediate', 'this_week', 'monitor']),
    })
  ),
  one_paragraph_explanation: z.string(),
})

// ── weekly_executive_summary ──────────────────────────────────

export const WeeklySummaryInput = z.object({
  client_name: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  prior_period: z.object({ start: z.string(), end: z.string() }),
  topline: z.object({
    cost_usd: z.number(),
    cost_delta_pct: z.number(),
    conversions: z.number(),
    conversions_delta_pct: z.number(),
    cpa_usd: z.number(),
    cpa_delta_pct: z.number(),
    roas: z.number().nullable(),
    roas_delta_pct: z.number().nullable(),
  }),
  top_movers: z.array(
    z.object({
      entity: z.string(),
      metric: z.string(),
      delta_pct: z.number(),
      direction: z.enum(['up', 'down']),
    })
  ),
  wasted_spend_total_usd: z.number(),
  pending_recommendations_count: z.number(),
  alerts_count: z.number(),
  cross_channel_snapshot: z.array(
    z.object({
      channel: z.string(),
      cost_usd: z.number(),
      conversions: z.number(),
      cpa_usd: z.number(),
    })
  ),
})

export const WeeklySummarySchema = z.object({
  headline: z.string(),
  executive_summary_md: z.string(),
  wins: z.array(z.string()).max(5),
  concerns: z.array(z.string()).max(5),
  next_week_priorities: z.array(z.string()).max(5),
})

// ── label_cluster ─────────────────────────────────────────────

export const LabelClusterInput = z.object({
  cluster_id: z.number(),
  sample_terms: z.array(z.string()).max(30),
})

export const LabelClusterSchema = z.object({
  label: z.string(),
  intent: IntentSchema,
  one_line_summary: z.string(),
})

// ── period_comparison_narrative ────────────────────────────────

export const PeriodComparisonInput = z.object({
  client_summary: z.string(),
  period_a: z.object({ start: z.string(), end: z.string() }),
  period_b: z.object({ start: z.string(), end: z.string() }),
  campaign_deltas: z.array(z.any()),
  keyword_deltas: z.array(z.any()),
  flags: z.array(z.any()),
})

export const PeriodComparisonSchema = z.object({
  narrative_md: z.string(),
  key_takeaways: z.array(z.string()).max(5),
})

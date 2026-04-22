// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — central config.
//
// Single source of truth for the Sonnet chain: model IDs, feature tags used
// in koto_token_usage, daily agency budget cap, and the canonical disclaimer
// every plan JSON carries.
//
// Pattern ported from src/lib/kotoiq/profileConfig.ts (MODELS + FEATURE_TAGS).
// Changing a model ID or adding a new feature tag is a one-line edit here —
// never scattered across prompt modules or the /api/trainer/generate route.
// ─────────────────────────────────────────────────────────────────────────────

export const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929',
  HAIKU: 'claude-haiku-4-5-20251001',
  ANTHROPIC_VERSION: '2023-06-01',
} as const

// Per-prompt feature tags — one entry per Sonnet call site.  Emitted to
// koto_token_usage so cost rolls up per feature in the /token-usage dashboard.
export const FEATURE_TAGS = {
  BASELINE: 'trainer_baseline',
  ROADMAP: 'trainer_roadmap',
  WORKOUT: 'trainer_workout',
  FOOD_PREFS: 'trainer_food_prefs',
  MEALS: 'trainer_meals',
  ADJUST: 'trainer_adjust',
} as const

// Per-agency daily USD cap for the whole Trainer Sonnet chain.
// Configurable per agency later via koto_agency_integrations; this is the
// out-of-box default.
export const DAILY_AGENCY_USD_CAP_DEFAULT = 10

// Appended to every plan-generating tool output + surfaced in UI footers.
export const DISCLAIMER =
  'Not medical advice. Consult your physician before starting any new program.'

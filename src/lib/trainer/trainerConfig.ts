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
  PLAYBOOK: 'trainer_playbook',
  REFINE: 'trainer_refine',
  INTAKE_CHAT: 'trainer_intake_chat',
} as const

// Per-agency daily USD cap for the whole Trainer Sonnet chain.
// Configurable per agency later via koto_agency_integrations; this is the
// out-of-box default.
export const DAILY_AGENCY_USD_CAP_DEFAULT = 10

// Appended to every plan-generating tool output + surfaced in UI footers.
export const DISCLAIMER =
  'Not medical advice. Consult your physician before starting any new program.'

// ─────────────────────────────────────────────────────────────────────────────
// COACH_VOICE — the unified persona stamped on every Sonnet prompt.
//
// Single source of truth so the credential stack never drifts between baseline,
// roadmap, workout, meals, food-prefs, playbook, and adjust.  Per-prompt files
// may append one line of domain-specific tone (e.g. workout's kg-vs-lbs rule)
// but MUST start from this base.
// ─────────────────────────────────────────────────────────────────────────────
export const COACH_VOICE = `You are the programming intelligence of a world-class training facility, combining the knowledge of multiple experts into one AI coach:

- PhD in Biomechanics — throwing mechanics, swing analysis, movement efficiency, force production
- PhD in Nutrition — sport-science nutrition, calorie & macro programming for athletes
- PhD in Strength & Conditioning — periodization, load management, power development, speed training
- PhD in Exercise Physiology — recovery protocols, injury prevention, youth athlete development, training readiness
- PhD in Sports Psychology — mental performance, confidence building, focus under pressure, competition prep
- Ex-MLB player (pitcher and outfielder) — real pro-level playing experience informing every recommendation
- 20-year professional coaching staff — hitting, pitching, and throwing coaches at the highest level

Every recommendation you make should draw on the RIGHT expert for the context: biomechanics for movement and mechanics, nutrition for diet and fueling, S&C for programming and load, exercise physiology for health and recovery, sports psychology for mental game and motivation, and pro playing/coaching experience for baseball-specific decisions.

Be specific, credentialed, sport-aware, ROI-conscious, and grounded.  Quote numbers.  Cite the client's actual age, sport, equipment, injuries, and goal directly in every output.  No hype language ("amazing," "crushing it").  No generic cues.  When something is uncertain, name the uncertainty instead of bluffing.  Never diagnose medical conditions — if something flags real medical concern, route the person to a physician rather than program around it.  Warm but direct: plain-spoken, a little blunt when it helps.  Use imperial units (lbs, feet/inches) in all prose output — the audience is US-based.  Read intake.about_you closely — it's the trainee's own words about who they are, what they do, and what they want; let it shape every choice.`

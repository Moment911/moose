import type { IntakeInput } from '../intakeSchema'
import type { BaselineOutput } from './baseline'
import type { RoadmapOutput } from './roadmap'
import type { SonnetTool } from '../sonnetRunner'
import { COACH_VOICE } from '../trainerConfig'
import { LEGAL_COMPLIANCE_PREAMBLE } from './legalCompliance'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Coaching Playbook prompt
//
// One Sonnet call that produces the "reference-depth" sections Adam
// showed: nutrition protocol, supplement protocol, travel/on-road
// strategy, Sunday meal-prep routine, recovery & sleep protocol, 8
// real-life troubleshooting scenarios, non-negotiables rules, and a
// "never miss twice" closing philosophy.  This is one-time generation
// per trainee — it doesn't regenerate per phase like the workout block.
//
// Voice: $150/hour personal trainer + nutritionist.  Direct, specific,
// ROI-conscious, quotes numbers, uses client context.  Matches the
// depth of the 42-year-old-mom reference sample.
// ─────────────────────────────────────────────────────────────────────────────

const VOICE_DIRECTION = `${COACH_VOICE}  Playbook-specific: your output reads like a premium private-coaching playbook — reference-depth sections, each grounded in the client's specific context (scenarios, supplements, recovery, closing message).`

export type SupplementEntry = {
  name: string               // "Creatine monohydrate"
  dose: string               // "5g/day"
  rationale: string          // specific to this client's age/sex/goal
  brand_recs: string[]       // ["Creapure-labeled", "Thorne"]
  when_to_take: string       // "any time, consistency matters more than timing"
}

export type TroubleshootingScenario = {
  scenario_name: string            // "Sick Kid Week"
  description: string              // 1-sentence setup
  training_adjustment: string
  nutrition_adjustment: string
  sleep_adjustment: string
  mindset_note: string             // the truthful "this is fine, just return to baseline" note
}

export type CoachingPlaybookOutput = {
  opening_note: string             // 2-4 sentence direct-to-client opener naming their situation

  nutrition_protocol: {
    daily_targets: {
      calories: number
      protein_g: number
      fat_g: number
      carbs_g: number
      water_oz: number
      fiber_g: number
      rationale: string            // WHY these numbers for THIS person
    }
    non_negotiables: string[]      // 5-8 rules (e.g. "Protein at every meal", "Water before coffee", "Don't drink your calories")
    on_the_road_strategy: {
      context_note: string         // 1-2 sentences describing how their life looks on the road
      breakfast_options: Array<{ name: string; description: string; kcal_est: number; protein_g_est: number; fat_g_est: number; carb_g_est: number; prep_time_min: number }>
      lunch_options: Array<{ name: string; description: string; kcal_est: number; protein_g_est: number; fat_g_est: number; carb_g_est: number; prep_time_min: number }>
      snack_bag_items: Array<{ name: string; kcal_est: number; protein_g_est: number }>
      drive_thru_backup: Array<{ chain: string; order: string; kcal_est: number; protein_g_est: number }>
    }
    home_cooking_framework: {
      dinner_template: string      // "6-8 oz lean protein + 2 fistfuls vegetables + 1 fist smart carbs + 1 thumb fat"
      dinner_ideas: string[]       // 6-10 ideas that fit the macros + look cookable
      weekly_rhythm: string        // description of what each weeknight tends to look like
    }
  }

  meal_prep_routine: {
    routine_name: string           // "The 90-Minute Sunday Prep"
    total_time_min: number
    before_you_start: string       // the mindset/ritual framing
    steps: Array<{
      minutes_range: string        // "0-5" / "5-15" / ...
      step_name: string
      instructions: string
    }>
    mid_week_mini_prep: string     // what to do Thursday night
    core_principle: string         // the framing insight that makes it repeatable
  }

  supplement_protocol: {
    essentials: SupplementEntry[]  // 4-6 items
    worth_considering: SupplementEntry[]  // 0-3 items
    skip: Array<{ name: string; why_skip: string }>
    the_real_stack_summary: string // "Lift heavy 3-4x/week. Hit 150g protein. Sleep 7+ hours. Walk 8000+ steps. Take creatine and magnesium." — the boiled-down answer
    monthly_cost_estimate_usd: number
  }

  recovery_and_sleep_protocol: {
    sleep_target_hours: number
    wind_down_routine: string[]    // 5-8 specific actions
    what_good_sleep_does: string[] // 3-5 benefits specific to this age/sex
    not_enough_sleep_protocol: string[]
    daily_walking_target_steps: number
    daily_walking_rationale: string
    mobility_guidance: string
    true_rest_day_note: string
    stress_management: {
      daily_5min_options: string[]
      weekly_non_negotiable: string
    }
    age_or_hormonal_considerations: string | null  // e.g. perimenopause note, minor-athlete note, etc. — ONLY if relevant to this client
  }

  troubleshooting_guide: TroubleshootingScenario[]  // 6-10 scenarios adapted to this client's actual life

  never_miss_twice_philosophy: string  // the closing "one rule that matters most" framing, 3-5 sentences

  personal_closing_note: string     // genuine, specific-to-client closing — what success looks like for THEM, why it matters beyond the body, go-get-it note

  disclaimer: string
}

export const playbookTool: SonnetTool = {
  name: 'record_coaching_playbook',
  description: 'Record a personalized coaching playbook covering nutrition, supplements, travel strategy, meal prep, recovery, troubleshooting, and closing philosophy.',
  input_schema: {
    type: 'object',
    required: [
      'opening_note',
      'nutrition_protocol',
      'meal_prep_routine',
      'supplement_protocol',
      'recovery_and_sleep_protocol',
      'troubleshooting_guide',
      'never_miss_twice_philosophy',
      'personal_closing_note',
      'disclaimer',
    ],
    properties: {
      opening_note: { type: 'string', maxLength: 800 },

      nutrition_protocol: {
        type: 'object',
        required: ['daily_targets', 'non_negotiables', 'on_the_road_strategy', 'home_cooking_framework'],
        properties: {
          daily_targets: {
            type: 'object',
            required: ['calories', 'protein_g', 'fat_g', 'carbs_g', 'water_oz', 'fiber_g', 'rationale'],
            properties: {
              calories: { type: 'integer' },
              protein_g: { type: 'integer' },
              fat_g: { type: 'integer' },
              carbs_g: { type: 'integer' },
              water_oz: { type: 'integer' },
              fiber_g: { type: 'integer' },
              rationale: { type: 'string' },
            },
          },
          non_negotiables: { type: 'array', minItems: 5, maxItems: 10, items: { type: 'string' } },
          on_the_road_strategy: {
            type: 'object',
            required: ['context_note', 'breakfast_options', 'lunch_options', 'snack_bag_items', 'drive_thru_backup'],
            properties: {
              context_note: { type: 'string' },
              breakfast_options: {
                type: 'array', minItems: 3, maxItems: 6,
                items: {
                  type: 'object',
                  required: ['name', 'description', 'kcal_est', 'protein_g_est', 'fat_g_est', 'carb_g_est', 'prep_time_min'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    kcal_est: { type: 'integer', description: 'Estimated calories for the full option as described.' },
                    protein_g_est: { type: 'integer' },
                    fat_g_est: { type: 'integer' },
                    carb_g_est: { type: 'integer' },
                    prep_time_min: { type: 'integer' },
                  },
                },
              },
              lunch_options: {
                type: 'array', minItems: 3, maxItems: 6,
                items: {
                  type: 'object',
                  required: ['name', 'description', 'kcal_est', 'protein_g_est', 'fat_g_est', 'carb_g_est', 'prep_time_min'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    kcal_est: { type: 'integer' },
                    protein_g_est: { type: 'integer' },
                    fat_g_est: { type: 'integer' },
                    carb_g_est: { type: 'integer' },
                    prep_time_min: { type: 'integer' },
                  },
                },
              },
              snack_bag_items: {
                type: 'array', minItems: 3,
                items: {
                  type: 'object',
                  required: ['name', 'kcal_est', 'protein_g_est'],
                  properties: {
                    name: { type: 'string', description: 'Short item name with portion, e.g. "Protein bar (Quest, 20g)"' },
                    kcal_est: { type: 'integer' },
                    protein_g_est: { type: 'integer' },
                  },
                },
              },
              drive_thru_backup: {
                type: 'array', minItems: 3,
                items: {
                  type: 'object',
                  required: ['chain', 'order', 'kcal_est', 'protein_g_est'],
                  properties: {
                    chain: { type: 'string' },
                    order: { type: 'string' },
                    kcal_est: { type: 'integer' },
                    protein_g_est: { type: 'integer' },
                  },
                },
              },
            },
          },
          home_cooking_framework: {
            type: 'object',
            required: ['dinner_template', 'dinner_ideas', 'weekly_rhythm'],
            properties: {
              dinner_template: { type: 'string' },
              dinner_ideas: { type: 'array', minItems: 6, maxItems: 12, items: { type: 'string' } },
              weekly_rhythm: { type: 'string' },
            },
          },
        },
      },

      meal_prep_routine: {
        type: 'object',
        required: ['routine_name', 'total_time_min', 'before_you_start', 'steps', 'mid_week_mini_prep', 'core_principle'],
        properties: {
          routine_name: { type: 'string' },
          total_time_min: { type: 'integer' },
          before_you_start: { type: 'string' },
          steps: {
            type: 'array', minItems: 4, maxItems: 8,
            items: {
              type: 'object',
              required: ['minutes_range', 'step_name', 'instructions'],
              properties: {
                minutes_range: { type: 'string' },
                step_name: { type: 'string' },
                instructions: { type: 'string' },
              },
            },
          },
          mid_week_mini_prep: { type: 'string' },
          core_principle: { type: 'string' },
        },
      },

      supplement_protocol: {
        type: 'object',
        required: ['essentials', 'worth_considering', 'skip', 'the_real_stack_summary', 'monthly_cost_estimate_usd'],
        properties: {
          essentials: {
            type: 'array', minItems: 3, maxItems: 6,
            items: {
              type: 'object',
              required: ['name', 'dose', 'rationale', 'brand_recs', 'when_to_take'],
              properties: {
                name: { type: 'string' },
                dose: { type: 'string' },
                rationale: { type: 'string' },
                brand_recs: { type: 'array', items: { type: 'string' } },
                when_to_take: { type: 'string' },
              },
            },
          },
          worth_considering: {
            type: 'array', maxItems: 4,
            items: {
              type: 'object',
              required: ['name', 'dose', 'rationale', 'brand_recs', 'when_to_take'],
              properties: {
                name: { type: 'string' },
                dose: { type: 'string' },
                rationale: { type: 'string' },
                brand_recs: { type: 'array', items: { type: 'string' } },
                when_to_take: { type: 'string' },
              },
            },
          },
          skip: {
            type: 'array', minItems: 2,
            items: {
              type: 'object',
              required: ['name', 'why_skip'],
              properties: { name: { type: 'string' }, why_skip: { type: 'string' } },
            },
          },
          the_real_stack_summary: { type: 'string' },
          monthly_cost_estimate_usd: { type: 'integer' },
        },
      },

      recovery_and_sleep_protocol: {
        type: 'object',
        required: [
          'sleep_target_hours', 'wind_down_routine', 'what_good_sleep_does',
          'not_enough_sleep_protocol', 'daily_walking_target_steps',
          'daily_walking_rationale', 'mobility_guidance', 'true_rest_day_note',
          'stress_management',
        ],
        properties: {
          sleep_target_hours: { type: 'number' },
          wind_down_routine: { type: 'array', minItems: 4, items: { type: 'string' } },
          what_good_sleep_does: { type: 'array', minItems: 3, items: { type: 'string' } },
          not_enough_sleep_protocol: { type: 'array', minItems: 3, items: { type: 'string' } },
          daily_walking_target_steps: { type: 'integer' },
          daily_walking_rationale: { type: 'string' },
          mobility_guidance: { type: 'string' },
          true_rest_day_note: { type: 'string' },
          stress_management: {
            type: 'object',
            required: ['daily_5min_options', 'weekly_non_negotiable'],
            properties: {
              daily_5min_options: { type: 'array', minItems: 3, items: { type: 'string' } },
              weekly_non_negotiable: { type: 'string' },
            },
          },
          age_or_hormonal_considerations: { type: ['string', 'null'] },
        },
      },

      troubleshooting_guide: {
        type: 'array', minItems: 6, maxItems: 10,
        items: {
          type: 'object',
          required: ['scenario_name', 'description', 'training_adjustment', 'nutrition_adjustment', 'sleep_adjustment', 'mindset_note'],
          properties: {
            scenario_name: { type: 'string' },
            description: { type: 'string' },
            training_adjustment: { type: 'string' },
            nutrition_adjustment: { type: 'string' },
            sleep_adjustment: { type: 'string' },
            mindset_note: { type: 'string' },
          },
        },
      },

      never_miss_twice_philosophy: { type: 'string' },
      personal_closing_note: { type: 'string' },
      disclaimer: { type: 'string' },
    },
  },
}

export function buildPlaybookPrompt(input: {
  intake: IntakeInput
  baseline: BaselineOutput
  roadmap: RoadmapOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${LEGAL_COMPLIANCE_PREAMBLE}

${VOICE_DIRECTION}

You are producing a COMPLETE COACHING PLAYBOOK for a real athlete.  This is the one-time comprehensive guide they'll reference for the next 90 days.  It must read like something a personal AI coach hand-wrote for THEIR actual life — NOT a generic wellness article.

IMPORTANT: Speak directly to the athlete in second person ("you", "your"). This is athlete-facing — no coach in between. You are AI, not a doctor — always remind them to consult a physician for medical concerns.

Use the intake + baseline + roadmap you've been given.  Tailor every section to this specific person.  Adapt context intelligently:
- Sport / activity (if any surfaces in trainer_notes) → sport-specific notes
- Age / sex → appropriate hormonal + recovery considerations (perimenopause for women 40+; minor-athlete safeguards for <18; testosterone + muscle-retention for men 40+; etc.)
- Lifestyle clues (occupation_activity, trainer_notes, stress_level) → shape the on-the-road strategy and meal-prep routine
- Budget (grocery_budget_usd_per_week) → suggest accessible options; flag if supplement cost exceeds what's reasonable
- Dietary preference → skip incompatible options (no whey suggestion if vegan; no pork options if keto-halal, etc.)
- Allergies → HARD EXCLUSIONS in every food recommendation
- Medical flags / pregnancy → conservative programming notes in recovery section; physician-route anything serious

Structural requirements:

1. opening_note (2-4 sentences): direct-to-client, name their situation, land the "I see you" moment that makes a $150/hr coaching relationship worth it.

2. nutrition_protocol.daily_targets: use the baseline's calorie + macros as the source of truth — do NOT recompute differently.  Add rationale that names WHY these numbers for THIS person specifically.

3. nutrition_protocol.non_negotiables: 5-8 rules this person actually needs.  Examples from reference: "Protein at every meal", "Water before coffee", "Don't drink your calories", "Magnesium glycinate at night".  Tailor to the client.

4. nutrition_protocol.on_the_road_strategy: if their life involves travel/car time/meetings (surface from intake), provide breakfast + lunch options, a snack bag, and drive-thru backups.  If they're home most of the time, reframe this as "when life derails" rather than travel.

5. nutrition_protocol.home_cooking_framework: dinner template + 6-10 recipe IDEAS (not full recipes) + weekly rhythm.  Keep it inspiring for people who cook; pragmatic for people who don't.

6. meal_prep_routine: structured step-by-step Sunday (or whichever day fits their life) flow — 4-8 steps with minute ranges.  Include a mid-week mini-prep + a core principle that makes it stick.

7. supplement_protocol: essentials (3-6 items with dose, rationale, brand recs, when) + worth_considering (0-4) + skip (2+).  Tailor to age/sex — e.g. creatine for women 40+ is high-value and often overlooked; vitamin D + K2 for minor indoor athletes; fish oil for anyone with inflammation risk.  Include "the_real_stack_summary" — the boiled-down version that ends the section with clarity.

8. recovery_and_sleep_protocol: sleep target, wind-down routine, what good sleep actually does (specific to their age/sex), what to do when sleep is short, walking target + rationale, mobility + rest-day notes, 5-min stress options + weekly non-negotiable.  Include age_or_hormonal_considerations ONLY IF relevant (don't force it).

9. troubleshooting_guide: 6-10 REAL scenarios this specific person will face.  Examples: sick kid, work crisis, vacation, wine nights/dinners out, period week for women, stalled progress, cravings, holidays.  Each scenario: training adjustment + nutrition adjustment + sleep adjustment + honest mindset note.  Adapt to their life — a 19-year-old college athlete gets different scenarios than a 42-year-old mom.

10. never_miss_twice_philosophy: 3-5 sentences.  The "missing once is normal; never miss twice" framing.  Make it land emotionally — this is the mindset that determines long-term success.

11. personal_closing_note: genuine, specific-to-client.  Name something meaningful about their situation beyond the physical — modeling for kids, leadership at work, future self, whatever is true for THIS client based on their intake.  Close with a direct "go do the work, come back at day 30" call to action.

12. disclaimer: "Not medical advice. Consult your physician before starting any new program."

Hard constraints:
- Daily_targets.calories MUST equal baseline.calorie_target_kcal exactly.
- Daily_targets.protein_g MUST equal baseline.macro_targets_g.protein_g.
- Every breakfast / lunch / snack / drive-thru item MUST include kcal_est and protein_g_est. Breakfast + lunch items ALSO require fat_g_est and carb_g_est. Estimates should be realistic and roughly internally consistent: 4*protein_g + 4*carb_g + 9*fat_g ≈ kcal (within ~15%). These numbers power the athlete's daily tracker and must be usable, not decorative.
- No supplement recommendation exceeds $25/month on its own — flag budget impact if client has a low grocery_budget_usd_per_week.
- Allergies are HARD — zero mentions of allergens in food lists.
- Dietary_preference is HARD — no animal-product suggestions for vegan, etc.
- If baseline.training_readiness.ok_to_train === false, include a physician-consultation note in opening and treat every section as "once cleared to train."
- If age < 18, recovery section must include "parental/coach awareness" note; supplement section should skip creatine unless specifically cleared (note this), emphasize whole food; training adjustments in troubleshooting should reflect conservative programming.

Voice check: reread every section.  Does it sound like a $150/hr coach?  Does it use THIS client's specifics?  Does it quote numbers?  Is it direct without hype?  If not, rewrite.
`

  const userMessage = JSON.stringify(
    {
      intake: input.intake,
      baseline: input.baseline,
      roadmap: input.roadmap,
    },
    null,
    2,
  )

  return { systemPrompt, userMessage }
}

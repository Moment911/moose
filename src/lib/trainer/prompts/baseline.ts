// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — Prompt 1: generate_baseline.
//
// Turns a raw intake row into a grounded baseline: calorie target, macro split,
// estimated body composition, training-readiness verdict, top 3 focus areas,
// and an honest timeline.  Every downstream prompt reads this baseline, so it
// must be numerically correct and honest about edge cases.
//
// Voice: $150/hour personal trainer + registered dietitian.  Specific,
// credentialed, sport-aware, ROI-conscious, grounded.  Quotes numbers.  Uses
// the client's specific context (age, sport from trainer_notes, goal) in the
// coach_summary.  Not a generic friendly coach.
//
// Ported & expanded from
// .planning/phases/trainer-01-intake-and-dispatcher/prompts/01-generate-baseline.md
// with these post-pivot updates (2026-04-21):
//   - Voice replaced with $150/hr coach persona.
//   - Added top_3_focus_areas output (most leveraged moves for THIS client).
//   - Explicit minor-athlete safeguard (age < 18 → no 1RM testing, emphasize
//     movement quality).
//   - Sport-aware direction — trainer_notes often reveals a sport; baseline
//     should name it and orient focus areas accordingly.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeInput } from '../intakeSchema'
import type { SonnetTool } from '../sonnetRunner'
import { DISCLAIMER } from '../trainerConfig'

export type BaselineOutput = {
  body_composition: {
    bmi_or_null: number | null
    category: 'underweight' | 'normal' | 'overweight' | 'obese' | 'unknown'
    notes: string
  }
  starting_fitness_level: 'deconditioned' | 'beginner' | 'intermediate' | 'advanced'
  training_readiness: {
    ok_to_train: boolean
    red_flags: string[]
    modifications_required: string[]
  }
  calorie_target_kcal: number
  macro_targets_g: { protein_g: number; fat_g: number; carb_g: number }
  estimated_weekly_weight_change_kg: number
  adjusted_target_weight_timeline_weeks: number | null
  /** NEW — the 3 most leveraged priorities for THIS specific client. */
  top_3_focus_areas: string[]
  /** 2-3 sentence $150/hr coach voice; cites client specifics. */
  coach_summary: string
  disclaimer: string
}

const VOICE_DIRECTION = `You are a $150/hour personal trainer and registered dietitian with 15 years of experience — the kind of coach high performers hire when they're done guessing. You are specific, credentialed, sport-aware, and ROI-conscious. You quote numbers. You cite the client's actual age, sport, equipment, and goal in every output — never generic coaching. You do not use hype language ("amazing," "incredible," "crushing it") and you do not talk down to the client. When something is uncertain, you name the uncertainty instead of bluffing. You never diagnose medical conditions — if something flags real medical concern, you route the person to a physician rather than program around it. Your tone is warm but direct: plain-spoken, grounded, a little blunt when it helps.  Use imperial units (lbs, feet/inches) in all prose output — the audience is US-based.  Read intake.about_you — it's the trainee's own words about who they are, what they do, and what they want; let it shape every choice.`

export function buildBaselinePrompt(input: { intake: IntakeInput }): {
  systemPrompt: string
  userMessage: string
} {
  const systemPrompt = `${VOICE_DIRECTION}

You are producing a baseline assessment for a new trainee.  You have their intake form data.  Your job is to compute calorie + macro targets, estimate their starting fitness level, flag any medical red lines, name the top 3 focus areas that will move the needle most for THIS person, and give an honest timeline for the stated goal.

Approach:
1. BMR via Mifflin-St Jeor.  For sex not recorded, use the average of male/female formulas and flag it in coach_summary.
2. Activity factor from occupation_activity: sedentary=1.2, light=1.375, moderate=1.55, heavy=1.725.  Training days add ~150-300 kcal depending on intensity.
3. Goal-based delta: lose_fat = -400 to -600 kcal/day, gain_muscle = +200 to +400, recomp = -100 to +100, maintain = 0, performance = 0 to +300.
4. Macros: protein 1.6-2.2 g/kg of current weight (higher for lose_fat, lower for maintain); fat 0.6-1.0 g/kg; carbs fill the rest.  Protein floor: ≥ 0.8 g/kg even on the most aggressive deficit.
5. Training readiness: if medical_flags, injuries, or pregnancy_or_nursing flag anything serious → ok_to_train=false.  Serious = cardiac, uncontrolled hypertension, recent surgery, active eating disorder, pregnancy (any trimester — defer to OB), active acute injury.
6. Timeline: -1.0 kg/week is the fastest safe loss, +0.5 kg/week is the fastest realistic gain.  If target implies faster, recalibrate and explain in coach_summary.
7. Starting fitness level: deconditioned (0 training days/week, heavy injuries, or sedentary+40yo+), beginner (0-1 years, 0-3 days/week), intermediate (1-3 years, 3-5 days/week), advanced (3+ years, 4-6 consistent days/week).

Minor-athlete safeguard (age < 18):
- Flag in coach_summary.  Populate training_readiness.modifications_required with: "no 1RM testing", "emphasize movement quality over load", "progress via reps before load".
- Do NOT set ok_to_train=false on age alone — adolescents train safely every day.  The modifications go downstream into workout prompts.

Context-aware direction:
- **intake.about_you is your most valuable input.**  This is a free-text paragraph the trainee wrote themselves — their sport, their job, their life, their goals, what's gotten in their way before.  Read it closely.  It overrides generic assumptions and MUST shape every field of the output.  Quote or paraphrase it in coach_summary to show you heard them.
- intake.trainer_notes is the agency's internal notes — secondary to about_you but still useful.
- When a sport or competitive context surfaces (from about_you OR trainer_notes) — e.g. "high school baseball shortstop", "recreational 5k runner", "masters powerlifter" — the top_3_focus_areas MUST reflect that sport's real demands.  Examples:
  - Baseball / rotational sport → rotational power + shoulder health + posterior chain.
  - Distance running → aerobic base + single-leg stability + hip / ankle mobility.
  - Powerlifting → main-lift technique + recovery capacity + accessory volume.
  - Tactical / military → work capacity + load carriage + injury-proofing.
  If no sport is named, focus areas reflect primary_goal + biggest limiter visible in the intake.

top_3_focus_areas rules:
- Exactly 3 entries.  Each is a short, specific, coach-voice phrase the operator can read aloud to the trainee — NOT a category label.
- Must be the MOST LEVERAGED moves for this specific person, not generic ("eat more protein" only if the intake reveals a protein deficit).
- Cite a number or a named movement / tissue / system where possible ("Hit 150g protein every day before you think about anything else" > "eat more protein").

coach_summary rules:
- 2-3 sentences.  Cites at least one specific: age, sport/context from about_you, goal, or current vs target weight.
- If about_you is non-empty, the coach_summary MUST echo something concrete from it — a phrase, a goal, a constraint — so the trainee knows you read it.
- One strength, one concern, one headline target — in that order.
- Plain English.  No jargon.  No hype.

Constraints:
- Never diagnose.  Phrase flags as "this pattern typically warrants physician sign-off before starting a program" — never "you have X condition."
- Age > 70 → flag for conservative programming regardless of other inputs.
- calorie_target_kcal must be ≥ 1200 for women, ≥ 1500 for men (biological floor).  If math suggests lower, raise floor + extend timeline + note in coach_summary.
- If primary_goal is null and target_weight_kg is null → set goal to maintain and note in coach_summary that no goal was provided.
- Category "unknown" is allowed when height_cm is null (can't compute BMI without it).
- Every output carries disclaimer: "${DISCLAIMER}"`

  // Compact intake payload — dropping undefined values keeps token count low.
  const intakePayload = stripUndefined({
    full_name: input.intake.full_name,
    age: input.intake.age ?? null,
    sex: input.intake.sex ?? null,
    height_cm: input.intake.height_cm ?? null,
    current_weight_kg: input.intake.current_weight_kg ?? null,
    target_weight_kg: input.intake.target_weight_kg ?? null,
    primary_goal: input.intake.primary_goal ?? null,
    training_experience_years: input.intake.training_experience_years ?? null,
    training_days_per_week: input.intake.training_days_per_week ?? null,
    equipment_access: input.intake.equipment_access ?? null,
    medical_flags: input.intake.medical_flags ?? null,
    injuries: input.intake.injuries ?? null,
    pregnancy_or_nursing: input.intake.pregnancy_or_nursing ?? null,
    dietary_preference: input.intake.dietary_preference ?? null,
    allergies: input.intake.allergies ?? null,
    sleep_hours_avg: input.intake.sleep_hours_avg ?? null,
    stress_level: input.intake.stress_level ?? null,
    occupation_activity: input.intake.occupation_activity ?? null,
    trainer_notes: input.intake.trainer_notes ?? null,
  })

  const userMessage = `Intake:
${JSON.stringify(intakePayload, null, 2)}

Produce the baseline assessment by calling the record_baseline tool.`

  return { systemPrompt, userMessage }
}

export const baselineTool: SonnetTool = {
  name: 'record_baseline',
  description: "Record the trainee's baseline assessment.",
  input_schema: {
    type: 'object',
    required: [
      'body_composition',
      'starting_fitness_level',
      'training_readiness',
      'calorie_target_kcal',
      'macro_targets_g',
      'estimated_weekly_weight_change_kg',
      'adjusted_target_weight_timeline_weeks',
      'top_3_focus_areas',
      'coach_summary',
      'disclaimer',
    ],
    properties: {
      body_composition: {
        type: 'object',
        required: ['bmi_or_null', 'category', 'notes'],
        properties: {
          bmi_or_null: { type: ['number', 'null'] },
          category: {
            type: 'string',
            enum: ['underweight', 'normal', 'overweight', 'obese', 'unknown'],
          },
          notes: { type: 'string' },
        },
      },
      starting_fitness_level: {
        type: 'string',
        enum: ['deconditioned', 'beginner', 'intermediate', 'advanced'],
      },
      training_readiness: {
        type: 'object',
        required: ['ok_to_train', 'red_flags', 'modifications_required'],
        properties: {
          ok_to_train: { type: 'boolean' },
          red_flags: { type: 'array', items: { type: 'string' } },
          modifications_required: { type: 'array', items: { type: 'string' } },
        },
      },
      calorie_target_kcal: { type: 'integer' },
      macro_targets_g: {
        type: 'object',
        required: ['protein_g', 'fat_g', 'carb_g'],
        properties: {
          protein_g: { type: 'integer' },
          fat_g: { type: 'integer' },
          carb_g: { type: 'integer' },
        },
      },
      estimated_weekly_weight_change_kg: { type: 'number' },
      adjusted_target_weight_timeline_weeks: { type: ['integer', 'null'] },
      top_3_focus_areas: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
        description:
          'Exactly 3 short coach-voice phrases naming the most leveraged priorities for THIS client.',
      },
      coach_summary: { type: 'string', maxLength: 500 },
      disclaimer: { type: 'string' },
    },
  },
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}

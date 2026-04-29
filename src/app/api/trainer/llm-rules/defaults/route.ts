import { NextResponse } from 'next/server'
import { COACH_VOICE, DISCLAIMER, MODELS, DAILY_AGENCY_USD_CAP_DEFAULT, FEATURE_TAGS } from '../../../../../lib/trainer/trainerConfig'
import { LEGAL_COMPLIANCE_PREAMBLE } from '../../../../../lib/trainer/prompts/legalCompliance'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trainer/llm-rules/defaults
//
// Returns the current code-defined defaults for all LLM rule sections.
// The admin page shows these when no DB override exists.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

export async function GET() {
  // Import guardrail patterns — they're regex, so we serialize them as strings
  const { classifyInput } = await import('../../../../../lib/trainer/guardrails')

  const defaults: Record<string, string> = {
    coach_voice: COACH_VOICE,
    legal_compliance: LEGAL_COMPLIANCE_PREAMBLE,
    guardrail_patterns: [
      '# Emergency Patterns (Level 3 — urgent response)',
      'chest pain, heart attack, can\'t breathe, suicidal, self-harm, kill self, fainting, passed out, seizure, overdose, want to die',
      '',
      '# Medical Patterns (Level 2 — block + redirect)',
      'diabetes, diabetic, thyroid, PCOS, heart disease/condition/failure, kidney, pregnant, pregnancy, postpartum, medication, prescription, insulin, chemotherapy, cancer, hypertension, epilepsy, asthma, autoimmune',
      '',
      '# Eating Disorder Patterns (Level 2 — block + redirect)',
      'starve/starving, purge/purging, binge, bulimia, anorexia, eating disorder, under 800 calories, 500 calories per day, not eating anything/at all',
      '',
      '# Injury Patterns (Level 1 — allow with caution)',
      'torn, herniated, numbness, tingling, fracture, slipped disc, severe pain, sharp pain, can\'t move/walk/lift, swelling + joint/knee/ankle/wrist',
    ].join('\n'),
    intake_chat: [
      '# Intake Chat Rules (from intakeChat.ts)',
      '',
      '1. Ask ONE question at a time. Only height+weight may be combined.',
      '2. Acknowledge briefly, vary acknowledgments, then ask next.',
      '2b. Multi-topic: separate with blank lines for multiple chat bubbles.',
      '3. Always produce text FIRST, then call update_intake_fields tool.',
      '5. ALWAYS call the tool on every response.',
      '6. Imperial in conversation, metric in tool output.',
      '7. medical_flags/injuries/allergies: "None" if trainee says none.',
      '8. Handle corrections naturally.',
      '9. Build about_you narrative incrementally.',
      '10. Never diagnose. Refer to physician.',
      '11. No hype language.',
      '12. Wrap up when all fields collected.',
      '13. CRITICAL: asking_field + suggested_replies in EVERY tool call.',
    ].join('\n'),
    workout_design: [
      '# Workout Design Rules (from workout.ts)',
      '',
      '- Match training_days_per_week exactly',
      '- Match equipment_access strictly',
      '- 2-week periodization with RPE progression',
      '- Stable snake_case exercise_id across blocks',
      '- 5-8 min warmup, 3-5 min cooldown',
      '- Max 5 exercises per session',
      '- Every exercise: performance_cues (3-6), common_mistakes (2-4), video_query',
      '- kg in tool output, lbs in coaching cues',
    ].join('\n'),
    nutrition_meals: [
      '# Nutrition & Meals Rules (from meals.ts)',
      '',
      '- Calorie tolerance: +/- 7% averaged across 14 days',
      '- Macro tolerance: +/- 10% daily average',
      '- Allergies = HARD EXCLUSIONS',
      '- dietary_preference = non-negotiable',
      '- Meals per day must match intake.meals_per_day',
      '- Grocery list aggregated across 2 weeks by aisle',
      '- Cook time tolerance: STRICT per trainee preference',
      '- Prize adherence over theoretical optimization',
    ].join('\n'),
    baseline_assessment: [
      '# Baseline Assessment Rules (from baseline.ts)',
      '',
      '- BMR via Mifflin-St Jeor formula',
      '- Activity factors: sedentary=1.2, light=1.375, moderate=1.55, heavy=1.725',
      '- Goal deltas: lose_fat -400 to -600 kcal, gain_muscle +200 to +400 kcal',
      '- Protein floor: >= 0.8 g/kg bodyweight',
      '- Max weight loss rate: ~1.0 kg/week',
      '- Max weight gain rate: ~0.5 kg/week',
      '- Athletes <18: no 1RM testing, conservative loading',
    ].join('\n'),
    roadmap_phases: [
      '# 90-Day Roadmap Rules (from roadmap.ts)',
      '',
      '- Exactly 3 phases: days 1-30, 31-60, 61-90',
      '- Phases must be "clearly distinct" not rebrands of same month',
      '- Milestones must cite numbers (reps, weights, times, macros)',
      '- Phase nutrition themes per goal:',
      '  lose_fat: aggressive -> hold -> refeed',
      '  gain_muscle: +300 kcal -> hold -> mini-cut',
      '  recomp: maintenance -> hypertrophy -> slight cut',
    ].join('\n'),
    coaching_playbook: [
      '# Coaching Playbook Rules (from playbook.ts)',
      '',
      '- 11 major sections required',
      '- Supplements: 3-6 essentials, max $25/month each',
      '- Creatine: skip for <18 unless cleared',
      '- Troubleshooting: 6-10 real-life scenarios',
      '- Meal macros: 4*p + 4*c + 9*f = kcal within ~15%',
      '- Opening note: max 800 characters',
      '- Non-negotiable nutrition rules: 5-10',
    ].join('\n'),
    plan_adjustment: [
      '# Plan Adjustment Rules (from adjust.ts)',
      '',
      '- Hit targets + RPE <= 7: apply progression',
      '- RPE 7-8: half intensity progression',
      '- Miss targets > 2 reps: deload 5%',
      '- RPE <= 6 both sessions: accelerate 2x',
      '- Missing logs entirely: hold',
      '- Pain notes 2+: substitute exercise',
      '',
      '# Adherence modifiers:',
      '- >= 80%: proceed normally',
      '- 60-79%: hold volume, progress clear',
      '- 40-59%: hold load + reps',
      '- < 40%: degrade',
      '- Volume progression: +10% for >= 80% adherence',
    ].join('\n'),
    website_copy: [
      '# Website Copy & Disclaimers',
      '',
      '## Hero',
      'Build smarter fitness and nutrition habits with structured AI guidance tailored to your goals, preferences, and lifestyle.',
      '',
      '## Hero Subtext',
      'Koto provides general wellness guidance for educational purposes and is not a medical service.',
      '',
      '## Global Footer',
      'Koto provides general wellness information and does not provide medical advice, diagnosis, or treatment.',
      '',
      '## Workout Disclaimer',
      'Exercise involves risk. Start conservatively and stop if you experience pain, dizziness, or discomfort.',
      '',
      '## Nutrition Disclaimer',
      'Nutrition suggestions are general guidance and not medical or dietary advice.',
      '',
      '## Testimonial Disclaimer',
      'Individual experiences vary. Koto provides general wellness guidance, not guaranteed results.',
    ].join('\n'),
    model_config: [
      '# Model & Budget Config',
      '',
      `Sonnet model: ${MODELS.SONNET}`,
      `Haiku model: ${MODELS.HAIKU}`,
      `Daily budget cap per agency: $${DAILY_AGENCY_USD_CAP_DEFAULT}`,
      '',
      '# Feature tags (for cost tracking):',
      ...Object.entries(FEATURE_TAGS).map(([k, v]) => `- ${k}: ${v}`),
    ].join('\n'),
  }

  return NextResponse.json({ defaults })
}

// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — prompts/protocolSchedule.ts
//
// Generates the week-by-week protocol schedule with milestones and
// re-evaluation points.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../../trainer/sonnetRunner'
import type { FourrIntakeInput } from '../intakeSchema'
import type { AssessmentOutput } from './assessment'
import type { PhaseRecommendationOutput } from './phaseRecommendation'
import type { ModalityPlanOutput } from './modalityPlan'
import { FOURR_VOICE } from '../fourrConfig'

export type ProtocolScheduleOutput = {
  weeks: Array<{
    week_number: number
    phase_id: string
    focus: string
    visits_per_week: number
    modalities: string[]
    milestone: string | null
  }>
  total_estimated_duration: string
  reassessment_points: string[]
  expected_outcomes: string[]
}

export function buildProtocolSchedulePrompt(input: {
  intake: FourrIntakeInput
  assessment: AssessmentOutput
  phaseRecommendation: PhaseRecommendationOutput
  modalityPlan: ModalityPlanOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${FOURR_VOICE}

You are building a week-by-week protocol schedule for this patient based on all previous assessments.

## Schedule Rules

1. **Generate 12-20 weeks** of schedule (covering at least the first 2 applicable phases).
2. **Each week** specifies: which phase they're in, visit frequency, which modalities, and a focus area.
3. **Milestones** mark expected progress points (e.g., "Pain should be below 5/10", "Corrections beginning to hold between visits").
4. **Phase transitions** should be clearly marked (e.g., week 8: "Transition from R1 to R2 — corrections are holding").
5. **Reassessment points** — typically every 4-6 weeks. The doctors will do a structural re-evaluation.
6. **Expected outcomes** — 3-5 bullet points of what the patient can expect at the end of the scheduled period.
7. **Be realistic.** Chronic conditions take longer. Acute conditions may progress faster. Match the patient's severity and chronicity.
8. **Gradual frequency reduction** as phases progress (R1: 3-5x/week → R2: 2-3x/week → R3: 1-2x/week → R4: 1-2x/month).

Call the record_protocol_schedule tool.`

  const userMessage = `Patient intake:\n${JSON.stringify(input.intake, null, 2)}\n\nAssessment:\n${JSON.stringify(input.assessment, null, 2)}\n\nPhase recommendation:\n${JSON.stringify(input.phaseRecommendation, null, 2)}\n\nModality plan:\n${JSON.stringify(input.modalityPlan, null, 2)}\n\nBuild the week-by-week schedule. Call the record_protocol_schedule tool.`

  return { systemPrompt, userMessage }
}

export const protocolScheduleTool: SonnetTool = {
  name: 'record_protocol_schedule',
  description: 'Record the week-by-week protocol schedule with milestones.',
  input_schema: {
    type: 'object',
    required: ['weeks', 'total_estimated_duration', 'reassessment_points', 'expected_outcomes'],
    properties: {
      weeks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['week_number', 'phase_id', 'focus', 'visits_per_week', 'modalities'],
          properties: {
            week_number: { type: 'integer', minimum: 1 },
            phase_id: { type: 'string' },
            focus: { type: 'string', description: 'Primary focus of this week.' },
            visits_per_week: { type: 'integer', minimum: 1, maximum: 7 },
            modalities: { type: 'array', items: { type: 'string' } },
            milestone: { type: ['string', 'null'], description: 'Expected milestone reached this week, if any.' },
          },
        },
      },
      total_estimated_duration: { type: 'string' },
      reassessment_points: { type: 'array', items: { type: 'string' } },
      expected_outcomes: { type: 'array', items: { type: 'string' } },
    },
  },
}

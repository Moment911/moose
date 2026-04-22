// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — prompts/phaseRecommendation.ts
//
// Determines which 4R phases apply, the starting phase, expected sequence,
// and rationale.  Uses the assessment output to inform the decision.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../../trainer/sonnetRunner'
import type { FourrIntakeInput } from '../intakeSchema'
import type { AssessmentOutput } from './assessment'
import { FOURR_VOICE, FOURR_PHASES } from '../fourrConfig'

export type PhaseRecommendationOutput = {
  starting_phase: string
  starting_phase_name: string
  starting_phase_subtitle: string
  rationale: string
  phases: Array<{
    phase_id: string
    name: string
    description: string
    frequency: string
    duration: string
    rationale: string
    applicable: boolean
  }>
  expected_phase_transitions: string
  total_estimated_program_duration: string
}

export function buildPhaseRecommendationPrompt(input: {
  intake: FourrIntakeInput
  assessment: AssessmentOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${FOURR_VOICE}

You are determining which phases of the 4R Method apply to this patient and in what sequence.

## The 4R Framework

${JSON.stringify(FOURR_PHASES, null, 2)}

## Phase Determination Logic

The 4R Method is a SEQUENCE, not a menu. Patients progress through phases in order.

1. **R1 Repair is ALWAYS the entry phase when active pain or structural dysfunction exists.**
   - Acute pain (severity 7+, <4 weeks): R1 aggressive (4-5x/week)
   - Subacute (severity 4-6, 4-12 weeks): R1 standard (3-4x/week)
   - Chronic (>12 weeks): R1 may overlap with early R2

2. **R2 Rebuild begins when initial corrections are holding** — typically when pain drops below 4/10 and structural corrections show stability on reassessment.

3. **R3 Regenerate begins when structural stability is confirmed** — the body is structurally sound, now optimize at the cellular level.

4. **R4 Refine is ongoing maintenance** — every patient eventually transitions here. This is lifetime care.

5. **Exceptions:**
   - If the patient has NO active pain and is seeking optimization/prevention, they may start at R3 or R4.
   - If red flags are present, R1 proceeds ONLY after physician clearance.

6. **Mark phases as applicable=false** if the patient's condition doesn't warrant that phase yet (e.g., a maintenance patient doesn't need R1 Repair).

For each applicable phase, recommend frequency and duration based on the patient's specific presentation (age, severity, chronicity, lifestyle demands).

Call the record_phase_recommendation tool.`

  const userMessage = `Patient intake:\n${JSON.stringify(input.intake, null, 2)}\n\nClinical assessment:\n${JSON.stringify(input.assessment, null, 2)}\n\nDetermine the phase recommendation. Call the record_phase_recommendation tool.`

  return { systemPrompt, userMessage }
}

export const phaseRecommendationTool: SonnetTool = {
  name: 'record_phase_recommendation',
  description: 'Record which 4R phases apply and in what sequence.',
  input_schema: {
    type: 'object',
    required: ['starting_phase', 'starting_phase_name', 'starting_phase_subtitle', 'rationale', 'phases', 'expected_phase_transitions', 'total_estimated_program_duration'],
    properties: {
      starting_phase: { type: 'string', description: 'e.g. "R1"' },
      starting_phase_name: { type: 'string', description: 'e.g. "Repair"' },
      starting_phase_subtitle: { type: 'string', description: 'e.g. "Restore Structural Integrity"' },
      rationale: { type: 'string', description: '2-3 sentences explaining why this starting phase was selected.' },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          required: ['phase_id', 'name', 'description', 'frequency', 'duration', 'rationale', 'applicable'],
          properties: {
            phase_id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            frequency: { type: 'string' },
            duration: { type: 'string' },
            rationale: { type: 'string' },
            applicable: { type: 'boolean' },
          },
        },
      },
      expected_phase_transitions: { type: 'string', description: 'Narrative of how the patient is expected to progress through phases.' },
      total_estimated_program_duration: { type: 'string', description: 'e.g. "6-9 months to reach R4 maintenance"' },
    },
  },
}

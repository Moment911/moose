// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — prompts/modalityPlan.ts
//
// Selects specific modalities for each applicable phase based on the patient's
// condition, the assessment, and the phase recommendation.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../../trainer/sonnetRunner'
import type { FourrIntakeInput } from '../intakeSchema'
import type { AssessmentOutput } from './assessment'
import type { PhaseRecommendationOutput } from './phaseRecommendation'
import { FOURR_VOICE, FOURR_PHASES } from '../fourrConfig'

export type ModalityPlanOutput = {
  phases: Array<{
    phase_id: string
    modalities: Array<{
      name: string
      description: string
      frequency: string
      indication: string
    }>
    session_structure: string
  }>
  contraindications_noted: string[]
}

export function buildModalityPlanPrompt(input: {
  intake: FourrIntakeInput
  assessment: AssessmentOutput
  phaseRecommendation: PhaseRecommendationOutput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${FOURR_VOICE}

You are selecting specific treatment modalities for each phase of this patient's 4R protocol.

## Available Modalities by Phase

${JSON.stringify(FOURR_PHASES, null, 2)}

## Modality Selection Rules

1. **Match modalities to the patient's condition.** Not every modality in a phase is appropriate for every patient. Select based on:
   - Pain locations and type
   - Severity and chronicity
   - Structural concerns from the assessment
   - Previous treatment response (if they've tried something before, note if it worked)
   - Red flags or contraindications

2. **Contraindications to note:**
   - Cryotherapy: Raynaud's, cold sensitivity, open wounds
   - Shockwave: pregnancy, blood clotting disorders, over growth plates in minors
   - Acupuncture: blood thinners (relative), needle phobia
   - Red light: photosensitivity medications
   - General: any modality over an area of active infection or malignancy

3. **Session structure:** Describe what a typical visit looks like for each phase (e.g., "20-min adjustment, 10-min shockwave, 10-min cryotherapy").

4. **Be specific about frequency** for each modality within the phase (some modalities may run less frequently than the overall visit schedule).

5. For each modality, write the **indication** — why THIS patient specifically needs it (not generic descriptions).

Call the record_modality_plan tool.`

  const userMessage = `Patient intake:\n${JSON.stringify(input.intake, null, 2)}\n\nAssessment:\n${JSON.stringify(input.assessment, null, 2)}\n\nPhase recommendation:\n${JSON.stringify(input.phaseRecommendation, null, 2)}\n\nSelect modalities for each applicable phase. Call the record_modality_plan tool.`

  return { systemPrompt, userMessage }
}

export const modalityPlanTool: SonnetTool = {
  name: 'record_modality_plan',
  description: 'Record the selected modalities for each 4R phase.',
  input_schema: {
    type: 'object',
    required: ['phases', 'contraindications_noted'],
    properties: {
      phases: {
        type: 'array',
        items: {
          type: 'object',
          required: ['phase_id', 'modalities', 'session_structure'],
          properties: {
            phase_id: { type: 'string' },
            modalities: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'description', 'frequency', 'indication'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string', description: 'One sentence explaining what this modality does.' },
                  frequency: { type: 'string', description: 'e.g. "Every visit", "2x per week", "As needed"' },
                  indication: { type: 'string', description: 'Why THIS patient needs this modality specifically.' },
                },
              },
            },
            session_structure: { type: 'string', description: 'What a typical visit looks like in this phase.' },
          },
        },
      },
      contraindications_noted: {
        type: 'array',
        items: { type: 'string' },
        description: 'Any contraindications identified based on the patient profile.',
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — prompts/assessment.ts
//
// Clinical assessment from intake data.  Produces severity classification,
// structural/neurological patterns, functional limitations, and safety flags.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../../trainer/sonnetRunner'
import type { FourrIntakeInput } from '../intakeSchema'
import { FOURR_VOICE } from '../fourrConfig'

export type AssessmentOutput = {
  summary: string
  severity_classification: 'acute' | 'subacute' | 'chronic' | 'maintenance'
  structural_concerns: string[]
  functional_limitations: string[]
  red_flag_alerts: string[]
  neurological_indicators: string[]
  recommended_imaging: string | null
  ok_to_proceed: boolean
  referral_needed: string | null
}

export function buildAssessmentPrompt(input: {
  intake: FourrIntakeInput
}): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `${FOURR_VOICE}

You are performing a clinical assessment based on the patient's intake data. This is NOT a diagnosis — it is a structured summary for the doctors to review.

## Assessment Rules

1. **Severity classification**: Based on pain duration and severity:
   - acute: onset <4 weeks, usually severity 6+
   - subacute: 4-12 weeks duration
   - chronic: >12 weeks duration
   - maintenance: no active complaint, seeking optimization/prevention

2. **Structural concerns**: Infer from pain locations, type, and aggravating factors. Example: "Possible L4-L5 involvement based on lower back pain with left sciatica."

3. **Functional limitations**: What daily activities are likely affected. Be specific to their occupation and lifestyle.

4. **Red flag alerts**: If ANY red flags were reported (loss of bladder/bowel, progressive weakness, unexplained weight loss, fever with back pain), flag them prominently. These require physician evaluation before starting any protocol.

5. **Neurological indicators**: Signs of nerve involvement (radiating pain, numbness/tingling, sciatica).

6. **Recommended imaging**: If no imaging has been done and the presentation warrants it, suggest X-ray or MRI. If imaging exists, note "Review existing imaging."

7. **ok_to_proceed**: false ONLY if red flags suggest the patient needs emergency care or physician clearance first.

8. **referral_needed**: If the patient needs to see an MD/specialist before starting, specify who (e.g., "Orthopedic surgeon for MRI evaluation").

Be thorough but concise. Each structural concern and functional limitation should be one clear sentence. Call the record_assessment tool.`

  const userMessage = `Patient intake data:\n${JSON.stringify(input.intake, null, 2)}\n\nProduce the clinical assessment. Call the record_assessment tool.`

  return { systemPrompt, userMessage }
}

export const assessmentTool: SonnetTool = {
  name: 'record_assessment',
  description: 'Record the clinical assessment based on patient intake data.',
  input_schema: {
    type: 'object',
    required: ['summary', 'severity_classification', 'structural_concerns', 'functional_limitations', 'red_flag_alerts', 'neurological_indicators', 'ok_to_proceed'],
    properties: {
      summary: { type: 'string', description: '2-4 sentence clinical summary of the patient presentation.' },
      severity_classification: { type: 'string', enum: ['acute', 'subacute', 'chronic', 'maintenance'] },
      structural_concerns: { type: 'array', items: { type: 'string' } },
      functional_limitations: { type: 'array', items: { type: 'string' } },
      red_flag_alerts: { type: 'array', items: { type: 'string' } },
      neurological_indicators: { type: 'array', items: { type: 'string' } },
      recommended_imaging: { type: ['string', 'null'] },
      ok_to_proceed: { type: 'boolean' },
      referral_needed: { type: ['string', 'null'] },
    },
  },
}

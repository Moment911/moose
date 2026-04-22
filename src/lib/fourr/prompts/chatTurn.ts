// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — prompts/chatTurn.ts
//
// Per-message chat turn prompt.  Each turn:
//   1. Acknowledges what the patient just said
//   2. Extracts any new structured fields from their latest message
//   3. Asks the next most natural question based on conversation flow
//   4. Signals when all required fields are captured
//
// Uses the same callSonnet() + tool_choice pattern as the trainer, but the
// conversation history is packed into the user message.
// ─────────────────────────────────────────────────────────────────────────────

import type { SonnetTool } from '../../trainer/sonnetRunner'
import type { FourrIntakeInput } from '../intakeSchema'
import { FOURR_VOICE } from '../fourrConfig'
import {
  REQUIRED_FOURR_INTAKE_FIELDS,
  type RequiredFourrIntakeField,
} from '../intakeCompleteness'

export type ChatTurnOutput = {
  /** The AI's response message to show in the chat */
  assistant_message: string
  /** Newly extracted fields from this turn (partial FourrIntakeInput) */
  extracted_fields: Partial<FourrIntakeInput>
  /** Whether all required fields are now captured */
  is_intake_complete: boolean
  /** Which fields were just extracted this turn (for progress animation) */
  fields_extracted_this_turn: string[]
}

export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
  extracted_fields?: string[]
}

/**
 * Build the system prompt and user message for a single chat turn.
 * The conversation history is packed into the user message so we can
 * reuse the standard callSonnet() single-message interface.
 */
export function buildChatTurnPrompt(input: {
  conversationHistory: ChatMessage[]
  extractedSoFar: Partial<FourrIntakeInput>
  remainingFields: RequiredFourrIntakeField[]
  patientName?: string | null
  isFirstMessage: boolean
}): {
  systemPrompt: string
  userMessage: string
} {
  const { conversationHistory, extractedSoFar, remainingFields, patientName, isFirstMessage } = input

  const systemPrompt = `${FOURR_VOICE}

You are conducting a conversational intake for a new patient. Your job is to gather all the information the doctors need to build a personalized 4R protocol — one question at a time, naturally.

## Conversation Rules

1. **One question at a time.** Never ask more than one question per message. Let the patient answer before moving on.
2. **Acknowledge first.** Briefly acknowledge what they just said before asking your next question. Be empathetic — these people are often in pain.
3. **Follow natural clinical flow:**
   - Start with: what brings them in (chief complaint)
   - Then: pain details (location, severity, duration, type, frequency)
   - Then: medical history (conditions, surgeries, medications)
   - Then: previous treatments (chiro, PT, imaging)
   - Then: lifestyle (occupation, exercise, sleep, stress)
   - Then: goals (what they hope to achieve)
   - Last: safety screening (red flags — frame gently)
4. **Extract fields as you go.** Every time the patient reveals information that maps to a required field, extract it into the structured output.
5. **Accept "None" as a valid answer** for medical history, surgeries, medications, previous treatments, and imaging. Don't push if they say they have none.
6. **Handle corrections gracefully.** If the patient corrects something they said earlier ("actually I'm 45 not 44"), update the extracted field.
7. **Don't re-ask answered fields.** Check the extracted_so_far object — if a field is already captured, skip it.
8. **Keep messages concise.** 1-3 sentences per response. No lectures, no long explanations of the 4R Method during intake.
9. **Mark complete** when ALL required fields are captured. Your final message should warmly summarize what you've gathered and let them know the doctors will review it.

## Field Extraction Rules

When extracting fields, use these canonical values:

- **pain_locations**: Array from [neck, upper_back, mid_back, lower_back, left_shoulder, right_shoulder, left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle, left_wrist, right_wrist, jaw_tmj, headaches, sciatica_left, sciatica_right, ribcage, tailbone]
- **pain_type**: sharp | dull | burning | aching | throbbing | radiating | stiffness
- **pain_frequency**: constant | intermittent | occasional | activity_dependent | morning_only | night_only
- **occupation_activity**: sedentary | light | moderate | heavy (infer from their job description)
- **goals**: Array from [pain_relief, improved_mobility, better_posture, athletic_performance, injury_prevention, stress_reduction, better_sleep, overall_wellness, neurological_optimization, cellular_health]
- **red_flags**: Array from [numbness_tingling, loss_of_bladder_bowel_control, recent_trauma, unexplained_weight_loss, fever_with_back_pain, progressive_weakness, night_pain_waking]. If none, set to empty array [].
- **medical_conditions, surgeries, medications, previous_chiro, previous_pt, imaging_done**: "None" if explicitly stated they have none. Leave null if not discussed yet.
- **about_you**: Build this progressively — a cleaned narrative of everything the patient has shared about their situation, in their voice. Update it each turn.

## Severity → Urgency Mapping (for your tone, not for diagnosis)
- 8-10: Express genuine concern. "That sounds really difficult."
- 5-7: Empathetic but steady. "I can see how that would affect your daily life."
- 1-4: Encouraging. "That's good — we can work with that."

## Red Flag Handling
If any red flag is detected (especially loss_of_bladder_bowel_control or sudden severe symptoms), pause the intake and direct them to seek emergency care: "I want to pause here — that symptom needs immediate medical attention. Please call 911 or go to your nearest ER right away."

Call the record_chat_turn tool with your response.`

  // Build the user message with conversation context
  const extractedSummary = Object.keys(extractedSoFar).length > 0
    ? `\n\nFields extracted so far:\n${JSON.stringify(extractedSoFar, null, 2)}`
    : '\n\nNo fields extracted yet.'

  const remainingStr = remainingFields.length > 0
    ? `\n\nRequired fields still needed: ${remainingFields.join(', ')}`
    : '\n\nAll required fields are captured! Mark is_intake_complete = true.'

  const nameHint = patientName ? `\nPatient name from account: "${patientName}"` : ''

  let conversationStr: string
  if (isFirstMessage) {
    conversationStr = `This is the start of the conversation. Greet the patient warmly, introduce yourself as the 4R Method intake coordinator, and ask what brings them in today.${nameHint}`
  } else {
    const historyLines = conversationHistory.map((m) =>
      `${m.role === 'assistant' ? 'You' : 'Patient'}: ${m.content}`
    ).join('\n\n')
    conversationStr = `Conversation so far:\n---\n${historyLines}\n---${nameHint}`
  }

  const userMessage = `${conversationStr}${extractedSummary}${remainingStr}

Respond naturally, extract any new fields from the patient's latest message, and ask the next question. Call the record_chat_turn tool.`

  return { systemPrompt, userMessage }
}

export const chatTurnTool: SonnetTool = {
  name: 'record_chat_turn',
  description: 'Record the AI response, extracted fields, and completion status for this chat turn.',
  input_schema: {
    type: 'object',
    required: ['assistant_message', 'extracted_fields', 'is_intake_complete', 'fields_extracted_this_turn'],
    properties: {
      assistant_message: {
        type: 'string',
        description: 'The AI message to display in the chat. 1-3 sentences, warm and professional.',
      },
      extracted_fields: {
        type: 'object',
        description: 'Partial FourrIntakeInput — only fields newly extracted or updated this turn, plus about_you (progressive narrative).',
        properties: {
          age: { type: 'integer', minimum: 1, maximum: 120 },
          sex: { type: 'string' },
          height_cm: { type: 'number' },
          weight_kg: { type: 'number' },
          chief_complaint: { type: 'string' },
          pain_locations: { type: 'array', items: { type: 'string' } },
          pain_severity: { type: 'integer', minimum: 1, maximum: 10 },
          pain_duration: { type: 'string' },
          pain_type: { type: 'string', enum: ['sharp', 'dull', 'burning', 'aching', 'throbbing', 'radiating', 'stiffness'] },
          pain_frequency: { type: 'string', enum: ['constant', 'intermittent', 'occasional', 'activity_dependent', 'morning_only', 'night_only'] },
          aggravating_factors: { type: 'string' },
          relieving_factors: { type: 'string' },
          medical_conditions: { type: 'string' },
          surgeries: { type: 'string' },
          medications: { type: 'string' },
          previous_chiro: { type: 'string' },
          previous_pt: { type: 'string' },
          previous_other_treatments: { type: 'string' },
          imaging_done: { type: 'string' },
          occupation: { type: 'string' },
          occupation_activity: { type: 'string', enum: ['sedentary', 'light', 'moderate', 'heavy'] },
          exercise_frequency: { type: 'string' },
          sleep_hours_avg: { type: 'number', minimum: 0, maximum: 16 },
          sleep_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
          stress_level: { type: 'integer', minimum: 1, maximum: 10 },
          goals: { type: 'array', items: { type: 'string' } },
          red_flags: { type: 'array', items: { type: 'string' } },
          about_you: { type: 'string' },
        },
      },
      is_intake_complete: {
        type: 'boolean',
        description: 'True when ALL required fields have been captured.',
      },
      fields_extracted_this_turn: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of field names extracted or updated in this turn.',
      },
    },
  },
}

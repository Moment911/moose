// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — chat engine orchestrator.
//
// Anonymous-first: no auth required.  Patients identified by session_id
// (client-generated UUID stored in localStorage).
//
// Flow:
//   1. Loads or creates patient row by session_id
//   2. Builds the chat turn prompt with history + extracted fields
//   3. Calls Sonnet via callSonnet()
//   4. Merges newly extracted fields into the patient record
//   5. Returns the response for the client to render
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { callSonnet } from '../trainer/sonnetRunner'
import { FEATURE_TAGS } from './fourrConfig'
import type { FourrIntakeInput } from './intakeSchema'
import { REQUIRED_FOURR_INTAKE_FIELDS, missingFourrIntakeFields } from './intakeCompleteness'
import {
  buildChatTurnPrompt,
  chatTurnTool,
  type ChatTurnOutput,
  type ChatMessage,
} from './prompts/chatTurn'

export type ChatTurnResult =
  | {
      ok: true
      assistant_message: string
      extracted_count: number
      total_required: number
      is_complete: boolean
      fields_extracted_this_turn: string[]
    }
  | { ok: false; error: string }

/**
 * Process a single chat turn for a 4R intake conversation.
 *
 * Creates the patient row if it doesn't exist (first message).
 * Updates conversation_log and extracted fields after each turn.
 */
export async function processChatTurn(args: {
  sb: SupabaseClient
  agencyId: string
  sessionId: string
  userMessage?: string | null
}): Promise<ChatTurnResult & { patient_id?: string }> {
  const { sb, agencyId, sessionId } = args

  // ── 1. Resolve or create patient row by session_id ──────────────────────
  let patientId: string
  let conversationLog: ChatMessage[] = []
  let extractedSoFar: Partial<FourrIntakeInput> = {}

  const { data: existing } = await sb
    .from('koto_fourr_patients')
    .select('*')
    .eq('session_id', sessionId)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (existing) {
    const p = existing as Record<string, unknown>
    patientId = p.id as string
    conversationLog = (p.conversation_log as ChatMessage[]) || []
    extractedSoFar = extractFieldsFromRow(p)
  } else {
    // First interaction — create patient row
    const { data: newPatient, error: insErr } = await sb
      .from('koto_fourr_patients')
      .insert({
        agency_id: agencyId,
        session_id: sessionId,
        full_name: 'New Patient',
        status: 'intake_in_progress',
        conversation_log: [],
      })
      .select('id')
      .single()

    if (insErr || !newPatient) {
      console.error('[fourr/chat] patient insert error:', insErr?.message)
      return { ok: false, error: 'Could not create patient record' }
    }
    patientId = (newPatient as { id: string }).id
  }

  // ── 2. Append user message to history (if not first turn) ───────────────
  const isFirstMessage = conversationLog.length === 0 && !args.userMessage
  if (args.userMessage) {
    conversationLog.push({
      role: 'user',
      content: args.userMessage,
      timestamp: new Date().toISOString(),
    })
  }

  // ── 3. Build prompt + call Sonnet ───────────────────────────────────────
  const remaining = missingFourrIntakeFields(extractedSoFar)

  const { systemPrompt, userMessage } = buildChatTurnPrompt({
    conversationHistory: conversationLog,
    extractedSoFar,
    remainingFields: remaining,
    patientName: extractedSoFar.full_name !== 'New Patient' ? extractedSoFar.full_name : null,
    isFirstMessage,
  })

  const result = await callSonnet<ChatTurnOutput>({
    featureTag: FEATURE_TAGS.CHAT_TURN,
    systemPrompt,
    tool: chatTurnTool,
    userMessage,
    agencyId,
    maxTokens: 2000,
    metadata: { patient_id: patientId, session_id: sessionId, turn: conversationLog.length },
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const { assistant_message, extracted_fields, is_intake_complete, fields_extracted_this_turn } = result.data

  // ── 4. Merge extracted fields + append AI message ───────────────────────
  const merged = { ...extractedSoFar, ...extracted_fields }

  conversationLog.push({
    role: 'assistant',
    content: assistant_message,
    timestamp: new Date().toISOString(),
    extracted_fields: fields_extracted_this_turn,
  })

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    conversation_log: conversationLog,
  }

  // Map extracted fields to DB columns
  const fieldKeys: (keyof FourrIntakeInput)[] = [
    'full_name', 'email', 'phone',
    'age', 'sex', 'height_cm', 'weight_kg',
    'chief_complaint', 'pain_locations', 'pain_severity', 'pain_duration',
    'pain_type', 'pain_frequency', 'aggravating_factors', 'relieving_factors',
    'medical_conditions', 'surgeries', 'medications',
    'previous_chiro', 'previous_pt', 'previous_other_treatments', 'imaging_done',
    'occupation', 'occupation_activity', 'exercise_frequency',
    'sleep_hours_avg', 'sleep_quality', 'stress_level',
    'goals', 'red_flags', 'about_you',
  ]

  for (const k of fieldKeys) {
    const v = extracted_fields[k]
    if (v !== undefined && v !== null) {
      updatePayload[k] = v
    }
  }

  // If intake is complete, flip status
  if (is_intake_complete) {
    updatePayload.status = 'intake_complete'
  }

  const { error: updErr } = await sb
    .from('koto_fourr_patients')
    .update(updatePayload)
    .eq('id', patientId)
    .eq('agency_id', agencyId)

  if (updErr) {
    console.error('[fourr/chat] patient update error:', updErr.message)
  }

  const filledCount = REQUIRED_FOURR_INTAKE_FIELDS.length - missingFourrIntakeFields(merged).length

  return {
    ok: true,
    patient_id: patientId,
    assistant_message,
    extracted_count: filledCount,
    total_required: REQUIRED_FOURR_INTAKE_FIELDS.length,
    is_complete: is_intake_complete,
    fields_extracted_this_turn,
  }
}

/**
 * Extract the structured intake fields from a raw patient DB row.
 */
function extractFieldsFromRow(row: Record<string, unknown>): Partial<FourrIntakeInput> {
  const out: Partial<FourrIntakeInput> = {}
  const fields: (keyof FourrIntakeInput)[] = [
    'full_name', 'email', 'phone',
    'age', 'sex', 'height_cm', 'weight_kg',
    'chief_complaint', 'pain_locations', 'pain_severity', 'pain_duration',
    'pain_type', 'pain_frequency', 'aggravating_factors', 'relieving_factors',
    'medical_conditions', 'surgeries', 'medications',
    'previous_chiro', 'previous_pt', 'previous_other_treatments', 'imaging_done',
    'occupation', 'occupation_activity', 'exercise_frequency',
    'sleep_hours_avg', 'sleep_quality', 'stress_level',
    'goals', 'red_flags', 'about_you',
  ]
  for (const f of fields) {
    const v = row[f]
    if (v !== null && v !== undefined) {
      (out as Record<string, unknown>)[f] = v
    }
  }
  return out
}

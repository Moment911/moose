import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  assertFourrMethodEnabled,
  isFeatureDisabledError,
} from '../../../../lib/fourr/featureFlag'
import type { FourrIntakeInput } from '../../../../lib/fourr/intakeSchema'
import { isFourrIntakeComplete } from '../../../../lib/fourr/intakeCompleteness'
import { callSonnet } from '../../../../lib/trainer/sonnetRunner'
import { FEATURE_TAGS } from '../../../../lib/fourr/fourrConfig'
import {
  buildAssessmentPrompt,
  assessmentTool,
  type AssessmentOutput,
} from '../../../../lib/fourr/prompts/assessment'
import {
  buildPhaseRecommendationPrompt,
  phaseRecommendationTool,
  type PhaseRecommendationOutput,
} from '../../../../lib/fourr/prompts/phaseRecommendation'
import {
  buildModalityPlanPrompt,
  modalityPlanTool,
  type ModalityPlanOutput,
} from '../../../../lib/fourr/prompts/modalityPlan'
import {
  buildProtocolSchedulePrompt,
  protocolScheduleTool,
  type ProtocolScheduleOutput,
} from '../../../../lib/fourr/prompts/protocolSchedule'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fourr/self-signup
//
// Protocol generation chain:
//   1. Assessment (clinical summary)
//   2. Phase recommendation (which R-phases, starting phase)
//   3. Modality plan (per-phase modality selections)
//   4. Protocol schedule (week-by-week plan)
//
// Total: ~30-45s blocking.  maxDuration=300 for headroom.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 300

const DEFAULT_AGENCY_FALLBACK = '70ab75b3-1cee-4130-bfd5-bd2687c701ad'

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

async function resolveUser(
  req: NextRequest,
  sb: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, userId: data.user.id }
}

export async function POST(req: NextRequest) {
  const sb = getDb()
  const agencyId = process.env.DEFAULT_FOURR_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  try {
    await assertFourrMethodEnabled(sb, agencyId)
  } catch (e) {
    if (isFeatureDisabledError(e)) return err(404, 'Not found')
    return err(500, 'Feature gate check failed')
  }

  const auth = await resolveUser(req, sb)
  if (!auth.ok) return err(auth.status, auth.error)

  // ── 1. Resolve patient via mapping ──────────────────────────────────────
  const { data: mapping } = await sb
    .from('koto_fourr_patient_users')
    .select('patient_id')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (!mapping) {
    return err(404, 'No patient record found. Complete the intake assessment first.')
  }

  const patientId = (mapping as { patient_id: string }).patient_id

  const { data: patientRow, error: loadErr } = await sb
    .from('koto_fourr_patients')
    .select('*')
    .eq('id', patientId)
    .eq('agency_id', agencyId)
    .single()

  if (loadErr || !patientRow) {
    return err(404, 'Patient record not found.')
  }

  const intake = patientRow as unknown as FourrIntakeInput & { id: string; status: string }

  // Check intake completeness
  if (!isFourrIntakeComplete(intake)) {
    return err(400, 'intake_incomplete', { message: 'Please complete the intake assessment first.' })
  }

  // Check if protocol already exists
  const { data: existing } = await sb
    .from('koto_fourr_protocols')
    .select('id')
    .eq('patient_id', patientId)
    .maybeSingle()

  if (existing) {
    return err(409, 'protocol_already_generated', { protocol_id: (existing as { id: string }).id })
  }

  // ── 2. Run the 4-step Sonnet chain ──────────────────────────────────────
  const progress: {
    assessment?: AssessmentOutput
    phase_recommendation?: PhaseRecommendationOutput
    modality_plan?: ModalityPlanOutput
    protocol_schedule?: ProtocolScheduleOutput
  } = {}
  const errors: string[] = []

  // Step 1: Assessment
  try {
    const { systemPrompt, userMessage } = buildAssessmentPrompt({ intake })
    const r = await callSonnet<AssessmentOutput>({
      featureTag: FEATURE_TAGS.ASSESSMENT,
      systemPrompt,
      tool: assessmentTool,
      userMessage,
      agencyId,
      maxTokens: 4000,
      metadata: { patient_id: patientId },
    })
    if (r.ok) progress.assessment = r.data
    else errors.push(`assessment:${r.error}`)
  } catch (e) {
    errors.push(`assessment:${e instanceof Error ? e.message : String(e)}`)
  }

  // Bail if assessment says not ok to proceed
  if (progress.assessment && !progress.assessment.ok_to_proceed) {
    // Still create the protocol row with just the assessment
    const { data: protocolRow } = await sb
      .from('koto_fourr_protocols')
      .insert({
        agency_id: agencyId,
        patient_id: patientId,
        assessment: progress.assessment,
        generated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    return NextResponse.json({
      patient_id: patientId,
      protocol_id: protocolRow ? (protocolRow as { id: string }).id : null,
      ok_to_proceed: false,
      red_flag_alerts: progress.assessment.red_flag_alerts,
      referral_needed: progress.assessment.referral_needed,
      errors,
    })
  }

  // Step 2: Phase Recommendation
  if (progress.assessment) {
    try {
      const { systemPrompt, userMessage } = buildPhaseRecommendationPrompt({
        intake,
        assessment: progress.assessment,
      })
      const r = await callSonnet<PhaseRecommendationOutput>({
        featureTag: FEATURE_TAGS.PHASE_REC,
        systemPrompt,
        tool: phaseRecommendationTool,
        userMessage,
        agencyId,
        maxTokens: 6000,
        metadata: { patient_id: patientId },
      })
      if (r.ok) progress.phase_recommendation = r.data
      else errors.push(`phase_recommendation:${r.error}`)
    } catch (e) {
      errors.push(`phase_recommendation:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Step 3: Modality Plan
  if (progress.assessment && progress.phase_recommendation) {
    try {
      const { systemPrompt, userMessage } = buildModalityPlanPrompt({
        intake,
        assessment: progress.assessment,
        phaseRecommendation: progress.phase_recommendation,
      })
      const r = await callSonnet<ModalityPlanOutput>({
        featureTag: FEATURE_TAGS.MODALITY,
        systemPrompt,
        tool: modalityPlanTool,
        userMessage,
        agencyId,
        maxTokens: 8000,
        metadata: { patient_id: patientId },
      })
      if (r.ok) progress.modality_plan = r.data
      else errors.push(`modality_plan:${r.error}`)
    } catch (e) {
      errors.push(`modality_plan:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Step 4: Protocol Schedule
  if (progress.assessment && progress.phase_recommendation && progress.modality_plan) {
    try {
      const { systemPrompt, userMessage } = buildProtocolSchedulePrompt({
        intake,
        assessment: progress.assessment,
        phaseRecommendation: progress.phase_recommendation,
        modalityPlan: progress.modality_plan,
      })
      const r = await callSonnet<ProtocolScheduleOutput>({
        featureTag: FEATURE_TAGS.SCHEDULE,
        systemPrompt,
        tool: protocolScheduleTool,
        userMessage,
        agencyId,
        maxTokens: 10000,
        metadata: { patient_id: patientId },
      })
      if (r.ok) progress.protocol_schedule = r.data
      else errors.push(`protocol_schedule:${r.error}`)
    } catch (e) {
      errors.push(`protocol_schedule:${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── 3. Persist the protocol ─────────────────────────────────────────────
  const { data: protocolRow, error: protocolErr } = await sb
    .from('koto_fourr_protocols')
    .insert({
      agency_id: agencyId,
      patient_id: patientId,
      assessment: progress.assessment ?? null,
      phase_recommendation: progress.phase_recommendation ?? null,
      modality_plan: progress.modality_plan ?? null,
      protocol_schedule: progress.protocol_schedule ?? null,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (protocolErr || !protocolRow) {
    console.error('[fourr/self-signup] protocol insert error:', protocolErr?.message)
    errors.push(`persist:${protocolErr?.message || 'unknown'}`)
  }

  // Update patient status
  if (progress.protocol_schedule) {
    await sb
      .from('koto_fourr_patients')
      .update({ status: 'protocol_generated' })
      .eq('id', patientId)
      .eq('agency_id', agencyId)
  }

  return NextResponse.json({
    patient_id: patientId,
    protocol_id: protocolRow ? (protocolRow as { id: string }).id : null,
    assessment_ready: !!progress.assessment,
    phases_ready: !!progress.phase_recommendation,
    modalities_ready: !!progress.modality_plan,
    schedule_ready: !!progress.protocol_schedule,
    errors,
  })
}

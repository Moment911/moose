import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { callSonnet } from '../../../../lib/trainer/sonnetRunner'
import { FEATURE_TAGS } from '../../../../lib/trainer/trainerConfig'
import {
  buildIntakeExtractPrompt,
  intakeExtractTool,
  type IntakeExtractOutput,
} from '../../../../lib/trainer/prompts/intakeExtract'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/intake-extract
//
// AI-first intake step 1: trainee writes ONE free-text paragraph about
// themselves and their goals; this endpoint calls Sonnet to extract every
// IntakeInput field it can and list the remaining required questions.
//
// Auth: any authenticated Supabase user.  We don't require a trainee
// mapping yet — this fires during /my-intake, BEFORE self-signup provisions
// the trainee row.  The user may or may not have a mapping; either way
// we just need a valid session.
//
// Billing: the token cost lands on DEFAULT_SELF_SIGNUP_AGENCY_ID (Olympic
// Heights Training).  This is pre-trainee-row, so there's no trainee_id to
// charge against yet.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

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

export async function POST(req: NextRequest) {
  const sb = getDb()

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return err(401, 'Unauthorized')
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) return err(401, 'Unauthorized')
  const user = userData.user

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }
  const freeText = typeof body.free_text === 'string' ? body.free_text.trim() : ''
  if (freeText.length < 20) {
    return err(400, 'free_text must be at least 20 characters — tell us about yourself in a sentence or two')
  }
  if (freeText.length > 4000) {
    return err(400, 'free_text too long (max 4000 chars)')
  }

  // alreadyFilled — structured fields the trainee answered on step 1 of
  // the intake (name / age / sex / height / weight / etc).  Sonnet keeps
  // these verbatim in extracted and won't re-ask them in remaining_questions.
  const alreadyFilled = (body.already_filled && typeof body.already_filled === 'object')
    ? (body.already_filled as Record<string, unknown>)
    : undefined

  const fullNameHint = user.user_metadata?.full_name ?? null

  const agencyId = process.env.DEFAULT_SELF_SIGNUP_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  const { systemPrompt, userMessage } = buildIntakeExtractPrompt({
    freeText,
    fullNameHint,
    alreadyFilled: alreadyFilled as Parameters<typeof buildIntakeExtractPrompt>[0]['alreadyFilled'],
  })
  const result = await callSonnet<IntakeExtractOutput>({
    featureTag: FEATURE_TAGS.REFINE, // Same bucket — cheap one-shot.
    systemPrompt,
    tool: intakeExtractTool,
    userMessage,
    agencyId,
    metadata: { user_id: user.id, stage: 'intake_extract' },
  })
  if (!result.ok) {
    return err(result.status ?? 502, 'sonnet_error', { detail: result.error })
  }

  const payload = result.data as IntakeExtractOutput
  return NextResponse.json({
    extracted: payload.extracted ?? {},
    remaining_questions: payload.remaining_questions ?? [],
    about_you: payload.about_you ?? '',
  })
}

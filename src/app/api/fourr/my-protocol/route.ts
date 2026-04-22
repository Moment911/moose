import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fourr/my-protocol?session_id=xxx
//
// Anonymous-first: fetches protocol by session_id (no auth required).
// Returns { protocol, patient } or 404 if no protocol exists.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const DEFAULT_AGENCY_FALLBACK = '09ac0024-2634-4f52-8a68-b9b8fedc26bf'

function getDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function err(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function GET(req: NextRequest) {
  const sb = getDb()
  const agencyId = (process.env.DEFAULT_FOURR_AGENCY_ID || DEFAULT_AGENCY_FALLBACK).trim()

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return err(400, 'session_id is required')

  // Load patient by session_id
  const { data: patient } = await sb
    .from('koto_fourr_patients')
    .select('id, full_name, email, age, sex, chief_complaint, pain_severity, pain_duration, pain_locations, goals, status')
    .eq('session_id', sessionId)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (!patient) return err(404, 'No patient record found.')

  const patientId = (patient as { id: string }).id

  // Load latest protocol
  const { data: protocol } = await sb
    .from('koto_fourr_protocols')
    .select('*')
    .eq('patient_id', patientId)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!protocol) return err(404, 'No protocol generated yet.')

  return NextResponse.json({ protocol, patient })
}

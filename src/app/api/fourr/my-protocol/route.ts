import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fourr/my-protocol
//
// Fetches the generated protocol for the authenticated patient.
// Resolves patient via koto_fourr_patient_users mapping.
// Returns { protocol, patient } or 404 if no protocol exists.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'

const DEFAULT_AGENCY_FALLBACK = '70ab75b3-1cee-4130-bfd5-bd2687c701ad'

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
  const agencyId = process.env.DEFAULT_FOURR_AGENCY_ID || DEFAULT_AGENCY_FALLBACK

  // Auth
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return err(401, 'Unauthorized')
  const { data: authData, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !authData?.user) return err(401, 'Unauthorized')
  const userId = authData.user.id

  // Resolve patient
  const { data: mapping } = await sb
    .from('koto_fourr_patient_users')
    .select('patient_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!mapping) return err(404, 'No patient record found.')
  const patientId = (mapping as { patient_id: string }).patient_id

  // Load patient
  const { data: patient } = await sb
    .from('koto_fourr_patients')
    .select('id, full_name, email, age, sex, chief_complaint, pain_severity, pain_duration, pain_locations, goals, status')
    .eq('id', patientId)
    .eq('agency_id', agencyId)
    .single()

  if (!patient) return err(404, 'Patient record not found.')

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

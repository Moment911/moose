import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trainer/intake-plan
//
// Token-based plan reader for athletes coming through /intake/:traineeId.
// The trainee_id in the URL IS the token — same security model as the
// intake flow.  Returns the latest plan row, trainee info, and agency
// branding so the DoneScreen can render the built plan without
// requiring the athlete to log in.
//
// This sits alongside /api/trainer/my-plan (which is session-gated for
// returning athletes).  Writes / logging go through my-plan; this route
// is read-only.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60

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

export async function POST(req: NextRequest) {
  const sb = getDb()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err(400, 'Invalid JSON')
  }

  const traineeId = typeof body.trainee_id === 'string' ? body.trainee_id.trim() : ''
  if (!traineeId) return err(400, 'trainee_id required')

  // Validate trainee exists (agency_id comes off the row so we never
  // trust client-supplied agency scoping).
  const { data: trainee, error: tErr } = await sb
    .from('koto_fitness_trainees')
    .select('id, agency_id, full_name, status, primary_goal, about_you')
    .eq('id', traineeId)
    .maybeSingle()
  if (tErr || !trainee) return err(404, 'Trainee not found')

  const agencyId = (trainee as { agency_id: string }).agency_id

  // Latest plan for this trainee (highest block_number).
  const { data: plan } = await sb
    .from('koto_fitness_plans')
    .select('id, block_number, baseline, roadmap, workout_plan, playbook, generated_at')
    .eq('trainee_id', traineeId)
    .eq('agency_id', agencyId)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: agencyRow } = await sb
    .from('agencies')
    .select('name, brand_name, brand_color, brand_logo_url, support_email')
    .eq('id', agencyId)
    .maybeSingle()

  return NextResponse.json({
    trainee,
    plan: plan ?? null,
    agency: agencyRow
      ? {
          name: (agencyRow as { brand_name?: string; name?: string }).brand_name
            || (agencyRow as { name?: string }).name
            || null,
          brand_color: (agencyRow as { brand_color?: string }).brand_color || null,
          logo_url: (agencyRow as { brand_logo_url?: string }).brand_logo_url || null,
          support_email: (agencyRow as { support_email?: string }).support_email || null,
        }
      : null,
  })
}

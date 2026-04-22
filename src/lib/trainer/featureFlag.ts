import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — fitness_coach feature-flag gate.
//
// CONTEXT D-09: every /api/trainer/* action runs this gate.  If the session's
// agency does not have agencies.features->>fitness_coach === 'true', the
// helper throws a tagged error that the route handler maps to HTTP 404 (NOT
// 403 — link-enumeration mitigation, matches Phase 7 T-07 pattern).
//
// CONTEXT D-18: defense in depth.  This is the real gate; the sidebar render
// (Plan 03) is UX-only, and DB-layer gates land in Phase 3 with trainee auth.
//
// No cache: every request reads live agency.features so Koto admin toggles
// take effect immediately.
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_DISABLED_CODE = 'trainer_feature_disabled'

export class TrainerFeatureDisabledError extends Error {
  readonly code: typeof FEATURE_DISABLED_CODE = FEATURE_DISABLED_CODE
  constructor(message = 'Trainer module is not enabled for this agency') {
    super(message)
    this.name = 'TrainerFeatureDisabledError'
  }
}

/**
 * Assert agencies.features->fitness_coach is true for the given agency_id.
 * Throws TrainerFeatureDisabledError on disabled, missing agency, or any
 * lookup failure.  Route handler catches and maps to 404.
 */
export async function assertFitnessCoachEnabled(
  sb: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const { data, error } = await sb
    .from('agencies')
    .select('features')
    .eq('id', agencyId)
    .maybeSingle()

  if (error) {
    // Lookup failed — fail closed.  Don't leak the DB error to the client.
    throw new TrainerFeatureDisabledError()
  }
  if (!data) {
    // Agency row not found (deleted? race?) — fail closed.
    throw new TrainerFeatureDisabledError()
  }

  const features = (data as { features?: Record<string, unknown> | null }).features
  const fitnessCoach = features?.fitness_coach
  if (fitnessCoach !== true && fitnessCoach !== 'true') {
    // The jsonb column can round-trip as either a boolean true or the string
    // 'true' depending on how it was written; treat both as enabled.
    throw new TrainerFeatureDisabledError()
  }
}

export function isFeatureDisabledError(e: unknown): e is TrainerFeatureDisabledError {
  return (
    e instanceof TrainerFeatureDisabledError ||
    (typeof e === 'object' && e !== null && (e as { code?: string }).code === FEATURE_DISABLED_CODE)
  )
}

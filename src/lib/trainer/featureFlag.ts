import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 02 — fitness_coach feature-flag gate.
//
// CONTEXT D-09: every /api/trainer/* action runs this gate.  If the session's
// agency does not have agency_features.fitness_coach === true, the helper
// throws a tagged error that the route handler maps to HTTP 404 (NOT 403 —
// link-enumeration mitigation, matches Phase 7 T-07 pattern).
//
// CONTEXT D-18: defense in depth.  This is the real gate; the sidebar render
// (Plan 03) is UX-only, and DB-layer gates land in Phase 3 with trainee auth.
//
// Canonical source of truth: public.agency_features table, one boolean
// column per feature (see 20260439_feature_permissions.sql precedent —
// koto_desk, voice_agent, answering_service, etc.).  Migration
// 20260526_agency_features_fitness_coach.sql adds the fitness_coach column.
// useAuth loads this table into `agencyFeatures` state at session boot and
// Sidebar reads it via the shared `feat(featureKey)` helper, so server-side
// and client-side see the same truth.
//
// DEVIATION from Plan 02 original: the first version read
// agencies.features->>fitness_coach (jsonb).  That column still exists
// (Plan 01 added it as a generic jsonb flag host) but is NOT where this
// feature gate lives — canonical pattern is the agency_features boolean
// column, for consistency with every other feature flag in Koto.
//
// No cache: every request reads live agency_features so Koto admin toggles
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
 * Assert agency_features.fitness_coach is true for the given agency_id.
 * Throws TrainerFeatureDisabledError on disabled, missing row, or any
 * lookup failure.  Route handler catches and maps to 404.
 */
export async function assertFitnessCoachEnabled(
  sb: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const { data, error } = await sb
    .from('agency_features')
    .select('fitness_coach')
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (error) {
    // Lookup failed — fail closed.  Don't leak the DB error to the client.
    throw new TrainerFeatureDisabledError()
  }
  if (!data) {
    // No agency_features row for this agency — treat as disabled.  Seeding
    // an agency_features row for every agency is out of scope for this gate;
    // absence defaults to locked down.
    throw new TrainerFeatureDisabledError()
  }

  const fitnessCoach = (data as { fitness_coach?: boolean | null }).fitness_coach
  if (fitnessCoach !== true) {
    throw new TrainerFeatureDisabledError()
  }
}

export function isFeatureDisabledError(e: unknown): e is TrainerFeatureDisabledError {
  return (
    e instanceof TrainerFeatureDisabledError ||
    (typeof e === 'object' && e !== null && (e as { code?: string }).code === FEATURE_DISABLED_CODE)
  )
}

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// 4R Method — feature flag gate.
//
// Mirrors src/lib/trainer/featureFlag.ts pattern.  Every /api/fourr/* action
// runs this gate.  If the agency does not have agency_features.fourr_method
// === true, throws a tagged error that route handlers map to HTTP 404 (not
// 403 — link-enumeration mitigation).
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_DISABLED_CODE = 'fourr_feature_disabled'

export class FourrFeatureDisabledError extends Error {
  readonly code: typeof FEATURE_DISABLED_CODE = FEATURE_DISABLED_CODE
  constructor(message = '4R Method module is not enabled for this agency') {
    super(message)
    this.name = 'FourrFeatureDisabledError'
  }
}

export async function assertFourrMethodEnabled(
  sb: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const { data, error } = await sb
    .from('agency_features')
    .select('fourr_method')
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (error) {
    console.error('[fourr/featureFlag] DB error:', error.message, 'agencyId:', agencyId)
    throw new FourrFeatureDisabledError()
  }
  if (!data) {
    console.error('[fourr/featureFlag] No agency_features row for agencyId:', agencyId)
    throw new FourrFeatureDisabledError()
  }

  const fourrMethod = (data as { fourr_method?: boolean | null }).fourr_method
  if (fourrMethod !== true) {
    console.error('[fourr/featureFlag] fourr_method is not true:', fourrMethod, 'agencyId:', agencyId)
    throw new FourrFeatureDisabledError()
  }
}

export function isFeatureDisabledError(e: unknown): e is FourrFeatureDisabledError {
  return (
    e instanceof FourrFeatureDisabledError ||
    (typeof e === 'object' && e !== null && (e as { code?: string }).code === FEATURE_DISABLED_CODE)
  )
}

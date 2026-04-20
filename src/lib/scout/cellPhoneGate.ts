import 'server-only'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

type CellDetectionResult = {
  is_cell: boolean | null
  method: string
}

type ConsentResult = {
  allowed: boolean
  reason?: string
  warn?: string
}

/**
 * Check if a phone number is a cell phone based on the TCPA record.
 * If no record or is_cell_phone is null, returns unknown (conservative: assume cell).
 */
export async function detectCellPhone(
  phone: string,
  agencyId: string
): Promise<CellDetectionResult> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('koto_voice_tcpa_records')
    .select('is_cell_phone, cell_detection_method')
    .eq('phone', phone)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (!data || data.is_cell_phone === null) {
    return { is_cell: null, method: 'unknown' }
  }

  return {
    is_cell: data.is_cell_phone,
    method: data.cell_detection_method || 'unknown',
  }
}

/**
 * Check if a call to this phone is allowed under TCPA rules.
 * - Opted-out numbers are always blocked.
 * - Cell phones require express written or express oral consent.
 * - Landlines (is_cell_phone = false) are allowed without express consent.
 * - No record = assume landline but warn (conservative logging).
 */
export async function checkConsentForCall(
  phone: string,
  agencyId: string
): Promise<ConsentResult> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('koto_voice_tcpa_records')
    .select('opt_out, is_cell_phone, consent_status')
    .eq('phone', phone)
    .eq('agency_id', agencyId)
    .maybeSingle()

  // No TCPA record — assume landline but warn
  if (!data) {
    return { allowed: true, warn: 'no_tcpa_record' }
  }

  // Opt-out always blocks
  if (data.opt_out) {
    return { allowed: false, reason: 'opted_out' }
  }

  // If confirmed landline, allow (no express consent needed for non-ATDS)
  if (data.is_cell_phone === false) {
    return { allowed: true }
  }

  // Cell phone (is_cell_phone = true OR null/unknown — conservative)
  // Requires express written or express oral consent
  const hasConsent =
    data.consent_status === 'express_written' ||
    data.consent_status === 'express_oral'

  if (!hasConsent) {
    return { allowed: false, reason: 'no_consent_cell' }
  }

  return { allowed: true }
}

/**
 * Combined TCPA gate — runs cell detection + consent check.
 * Call this before queuing/dialing any outbound call.
 */
export async function tcpaGate(
  phone: string,
  agencyId: string
): Promise<{ allowed: boolean; reason?: string; warn?: string }> {
  // Run consent check (which encompasses opt-out + cell + consent logic)
  const consent = await checkConsentForCall(phone, agencyId)
  return consent
}

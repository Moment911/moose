import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

type DNCStatus = 'clean' | 'blocked' | 'unverified'

export async function checkDNC(
  phone: string,
  agencyId: string
): Promise<{ status: DNCStatus; reason?: string }> {
  const supabase = getSupabase()

  // 1. Check internal opt-out list
  const { data: optOut } = await supabase
    .from('koto_voice_tcpa_records')
    .select('id')
    .eq('phone', phone)
    .eq('opt_out', true)
    .limit(1)
    .single()

  if (optOut) {
    return { status: 'blocked', reason: 'Internal opt-out list' }
  }

  // 2. Try free DNC API
  let status: DNCStatus = 'clean'
  let reason: string | undefined

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`https://www.donotcall.gov/api/lookup/${phone}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (data.onList || data.registered) {
        status = 'blocked'
        reason = 'National Do Not Call Registry'
      }
    } else if (res.status === 404) {
      // 3. DNC API returned 404 — cannot verify
      status = 'unverified'
      reason = 'DNC API returned 404'
    } else {
      status = 'unverified'
      reason = `DNC API returned ${res.status}`
    }
  } catch (e: any) {
    // 3. DNC API failed (timeout, network error)
    status = 'unverified'
    reason = e.name === 'AbortError' ? 'DNC API timeout' : `DNC API error: ${e.message}`
  }

  // 4. Log check to koto_voice_tcpa_records
  await supabase.from('koto_voice_tcpa_records').upsert(
    {
      phone,
      agency_id: agencyId,
      dnc_checked: true,
      dnc_result: status,
      dnc_checked_at: new Date().toISOString(),
    },
    { onConflict: 'phone,agency_id' }
  )

  // 5. Return status
  return { status, reason }
}

export async function checkBatchDNC(
  phones: string[],
  agencyId: string
): Promise<Map<string, DNCStatus>> {
  const supabase = getSupabase()
  const results = new Map<string, DNCStatus>()

  await Promise.all(
    phones.map(async (phone) => {
      const { status } = await checkDNC(phone, agencyId)
      results.set(phone, status)

      // Update koto_voice_leads.dnc_status for each phone
      await supabase
        .from('koto_voice_leads')
        .update({ dnc_status: status })
        .eq('phone', phone)
        .eq('agency_id', agencyId)
    })
  )

  return results
}

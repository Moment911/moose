import 'server-only' // fails the build if this module is ever imported from a client component
// ── Parallel Dialing Engine ───────────────────────────────────────────────────
// Dials 2-5 leads simultaneously. First to answer gets the AI agent.
// Others get clean hangup or voicemail drop.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const RETELL_API = 'https://api.retellai.com'

export interface ParallelDialConfig {
  campaignId: string
  agencyId: string
  parallelCount: number
  fromNumbers: string[]
  agentId: string
  dynamicVariables: Record<string, string>
}

export interface DialBatchResult {
  connected: boolean
  winning_lead_id: string | null
  winning_call_id: string | null
  abandoned_call_ids: string[]
  batch_duration_ms: number
}

// ── Core Batch Dialer ────────────────────────────────────────────────────────

export async function dialBatch(
  leads: any[],
  config: ParallelDialConfig,
  batchNumber: number,
  sessionId: string
): Promise<DialBatchResult> {
  const sb = getSupabase()
  const retellKey = process.env.RETELL_API_KEY || ''
  const startTime = Date.now()

  // 1. Start all calls simultaneously
  const callPromises = leads.map(async (lead, index) => {
    const fromNumber = config.fromNumbers[index % config.fromNumbers.length]
    try {
      const res = await fetch(`${RETELL_API}/v2/create-phone-call`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${retellKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_number: fromNumber,
          to_number: lead.prospect_phone || lead.phone,
          override_agent_id: config.agentId,
          retell_llm_dynamic_variables: {
            ...config.dynamicVariables,
            prospect_name: lead.prospect_name || lead.first_name || lead.business_name || '',
            business_name: lead.prospect_company || lead.business_name || '',
            city: lead.city || '',
            industry: lead.industry_name || '',
          },
          metadata: {
            lead_id: lead.id,
            campaign_id: config.campaignId,
            agency_id: config.agencyId,
            session_id: sessionId,
            batch_number: batchNumber,
            is_parallel: true,
          },
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return { lead_id: lead.id, call_id: null, status: 'failed' }
      const data = await res.json()
      return { lead_id: lead.id, call_id: data.call_id, status: 'dialing' }
    } catch {
      return { lead_id: lead.id, call_id: null, status: 'failed' }
    }
  })

  const attempts = await Promise.all(callPromises)
  const activeCallIds = attempts.filter(a => a.call_id).map(a => a.call_id!)

  // 2. Poll for first connection (check every 2s for up to 25s)
  let winnerCallId: string | null = null
  let winnerLeadId: string | null = null

  for (let poll = 0; poll < 12; poll++) {
    await new Promise(r => setTimeout(r, 2000))

    for (const attempt of attempts) {
      if (!attempt.call_id || attempt.status === 'failed') continue
      try {
        const res = await fetch(`${RETELL_API}/v2/get-call/${attempt.call_id}`, {
          headers: { 'Authorization': `Bearer ${retellKey}` },
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const callData = await res.json()
          if (callData.call_status === 'ongoing' || callData.call_status === 'connected') {
            winnerCallId = attempt.call_id
            winnerLeadId = attempt.lead_id
            break
          }
          if (callData.call_status === 'ended' || callData.call_status === 'error') {
            attempt.status = 'ended'
          }
        }
      } catch { /* continue polling */ }
    }
    if (winnerCallId) break
  }

  // 3. Handle results
  const abandonedCallIds: string[] = []

  if (winnerCallId) {
    // End all other calls
    for (const attempt of attempts) {
      if (attempt.call_id && attempt.call_id !== winnerCallId && attempt.status !== 'ended') {
        try {
          await fetch(`${RETELL_API}/v2/end-call/${attempt.call_id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${retellKey}` },
            signal: AbortSignal.timeout(5000),
          })
          abandonedCallIds.push(attempt.call_id)
        } catch { /* best effort */ }
      }
    }
  } else {
    // No connection — end all remaining active calls
    for (const attempt of attempts) {
      if (attempt.call_id && attempt.status !== 'ended') {
        try {
          await fetch(`${RETELL_API}/v2/end-call/${attempt.call_id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${retellKey}` },
            signal: AbortSignal.timeout(5000),
          })
        } catch { /* best effort */ }
      }
    }
  }

  // 4. Log batch attempt
  await sb.from('koto_parallel_dial_attempts').insert({
    session_id: sessionId,
    agency_id: config.agencyId,
    campaign_id: config.campaignId,
    batch_number: batchNumber,
    batch_size: leads.length,
    batch_started_at: new Date(startTime).toISOString(),
    batch_completed_at: new Date().toISOString(),
    lead_attempts: attempts.map(a => ({
      lead_id: a.lead_id,
      call_id: a.call_id,
      status: a.call_id === winnerCallId ? 'connected' : a.status === 'failed' ? 'failed' : 'abandoned',
    })),
    winning_lead_id: winnerLeadId,
    winning_call_id: winnerCallId,
    connected: !!winnerCallId,
  })

  // 5. Re-queue abandoned leads (they weren't truly rejected)
  for (const attempt of attempts) {
    if (attempt.lead_id !== winnerLeadId && attempt.status !== 'failed') {
      await sb.from('koto_voice_leads').update({
        status: 'pending', // re-queue for future batch
        updated_at: new Date().toISOString(),
      }).eq('id', attempt.lead_id).eq('status', 'calling')
    }
  }

  return {
    connected: !!winnerCallId,
    winning_lead_id: winnerLeadId,
    winning_call_id: winnerCallId,
    abandoned_call_ids: abandonedCallIds,
    batch_duration_ms: Date.now() - startTime,
  }
}

// ── Session Runner ───────────────────────────────────────────────────────────

export async function runParallelSession(
  sessionId: string,
  leads: any[],
  config: ParallelDialConfig
): Promise<void> {
  const sb = getSupabase()
  const batchSize = config.parallelCount
  let batchNumber = 0
  let connected = 0
  let dialed = 0

  for (let i = 0; i < leads.length; i += batchSize) {
    // Check session status
    const { data: session } = await sb.from('koto_parallel_dial_sessions').select('status, started_at').eq('id', sessionId).single()
    if (session?.status === 'paused' || session?.status === 'stopped') break

    // Check calling hours
    const compliance = checkParallelDialCompliance(leads.slice(i, i + batchSize))
    if (!compliance.compliant) {
      await sb.from('koto_parallel_dial_sessions').update({ status: 'paused', paused_at: new Date().toISOString() }).eq('id', sessionId)
      break
    }

    const batch = leads.slice(i, i + batchSize)
    batchNumber++

    const result = await dialBatch(batch, config, batchNumber, sessionId)
    dialed += batch.length
    if (result.connected) connected++

    // Update session stats
    await sb.from('koto_parallel_dial_sessions').update({
      leads_dialed: dialed,
      leads_connected: connected,
      connection_rate: dialed > 0 ? connected / dialed : 0,
      calls_per_hour: batchNumber > 0 ? Math.round(dialed / (Date.now() - new Date(session?.started_at || Date.now()).getTime()) * 3600000) : 0,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)

    // Rate limit: 3 second gap between batches
    await new Promise(r => setTimeout(r, 3000))
  }

  // Mark session complete
  await sb.from('koto_parallel_dial_sessions').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId)
}

// ── Compliance ───────────────────────────────────────────────────────────────

export function checkParallelDialCompliance(leads: any[]): { compliant: boolean; issues: string[] } {
  const issues: string[] = []
  const now = new Date()
  const hour = now.getHours()

  // TCPA: 8am-9pm local time
  if (hour < 8) issues.push('Before 8am -- TCPA violation')
  if (hour >= 21) issues.push('After 9pm -- TCPA violation')

  // Check for phone numbers
  const noPhone = leads.filter(l => !l.prospect_phone && !l.phone)
  if (noPhone.length > 0) issues.push(`${noPhone.length} leads have no phone number`)

  return { compliant: issues.length === 0, issues }
}

// ── Optimal Batch Size Calculator ────────────────────────────────────────────

export function calculateOptimalBatchSize(connectionRate: number): number {
  // Target: ~1 connection per batch
  // Formula: ceil(1 / connectionRate), capped 2-5
  if (connectionRate <= 0) return 3
  return Math.min(5, Math.max(2, Math.ceil(1 / connectionRate)))
}

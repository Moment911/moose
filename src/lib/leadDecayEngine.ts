// ── Lead Decay Engine ────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
}

const DECAY_STAGES: Record<string, { max_days: number; multiplier: number; label: string; action: string }> = {
  fresh:   { max_days: 1,   multiplier: 1.0,  label: 'Fresh',   action: 'Call immediately' },
  warm:    { max_days: 3,   multiplier: 0.85, label: 'Warm',    action: 'Call today' },
  cooling: { max_days: 7,   multiplier: 0.65, label: 'Cooling', action: 'Call this week' },
  cold:    { max_days: 14,  multiplier: 0.40, label: 'Cold',    action: 'Use re-engagement script' },
  frozen:  { max_days: 30,  multiplier: 0.20, label: 'Frozen',  action: 'Email first, then call' },
  dead:    { max_days: 999, multiplier: 0.05, label: 'Dead',    action: 'Remove or archive' },
}

export function calculateDecayScore(lead: any): {
  decay_multiplier: number; decay_stage: string; days_old: number; adjusted_score: number; reengagement_needed: boolean; recommended_action: string; urgency: string
} {
  const created = lead.created_at ? new Date(lead.created_at) : new Date()
  const daysOld = Math.floor((Date.now() - created.getTime()) / 86400000)

  let stage = 'dead'
  for (const [key, config] of Object.entries(DECAY_STAGES)) {
    if (daysOld <= config.max_days) { stage = key; break }
  }

  const config = DECAY_STAGES[stage]
  const baseScore = lead.lead_score || lead.propensity_score || 50
  const adjusted = Math.round(baseScore * config.multiplier)

  return {
    decay_multiplier: config.multiplier,
    decay_stage: stage,
    days_old: daysOld,
    adjusted_score: adjusted,
    reengagement_needed: stage === 'cold' || stage === 'frozen',
    recommended_action: config.action,
    urgency: stage === 'fresh' ? 'critical' : stage === 'warm' ? 'high' : stage === 'cooling' ? 'medium' : 'low',
  }
}

export async function runDecayUpdate(agencyId: string): Promise<Record<string, number>> {
  const sb = getSupabase()
  const { data: leads } = await sb.from('koto_voice_leads')
    .select('id, lead_score, created_at')
    .eq('agency_id', agencyId)
    .in('status', ['pending', 'new', 'callback', 'no_answer'])
    .limit(500)

  const counts: Record<string, number> = { fresh: 0, warm: 0, cooling: 0, cold: 0, frozen: 0, dead: 0 }

  for (const lead of leads || []) {
    const decay = calculateDecayScore(lead)
    counts[decay.decay_stage] = (counts[decay.decay_stage] || 0) + 1

    await sb.from('koto_lead_scores_history').insert({
      lead_id: lead.id, agency_id: agencyId,
      propensity_score: lead.lead_score || 50,
      decay_multiplier: decay.decay_multiplier,
      adjusted_score: decay.adjusted_score,
      is_decaying: decay.decay_stage !== 'fresh',
      decay_stage: decay.decay_stage,
      reengagement_needed: decay.reengagement_needed,
      score_breakdown: { days_old: decay.days_old, action: decay.recommended_action },
    })
  }

  return counts
}

export async function getDecayDashboard(agencyId: string): Promise<{ by_stage: any[]; urgent_count: number; recommended_actions: string[] }> {
  const sb = getSupabase()
  const { data: leads } = await sb.from('koto_voice_leads')
    .select('id, lead_score, created_at, prospect_name, prospect_company, status')
    .eq('agency_id', agencyId)
    .in('status', ['pending', 'new', 'callback', 'no_answer'])
    .limit(500)

  const stages: Record<string, any[]> = {}
  let urgent = 0

  for (const lead of leads || []) {
    const decay = calculateDecayScore(lead)
    if (!stages[decay.decay_stage]) stages[decay.decay_stage] = []
    stages[decay.decay_stage].push({ ...lead, ...decay })
    if (decay.urgency === 'critical' || decay.urgency === 'high') urgent++
  }

  const actions: string[] = []
  if ((stages.cold?.length || 0) > 5) actions.push(`${stages.cold.length} cold leads need re-engagement scripts`)
  if ((stages.frozen?.length || 0) > 3) actions.push(`${stages.frozen.length} frozen leads -- email before calling`)
  if ((stages.dead?.length || 0) > 5) actions.push(`${stages.dead.length} dead leads -- consider archiving`)

  return {
    by_stage: Object.entries(stages).map(([stage, leads]) => ({ stage, count: leads.length, leads: leads.slice(0, 5) })),
    urgent_count: urgent,
    recommended_actions: actions,
  }
}

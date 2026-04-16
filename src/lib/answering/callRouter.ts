/**
 * Call router -- resolves which routing target (human) an in-progress call
 * should transfer to, based on detected intent + current hours.
 * Ported from backend/src/services/call-router.js (Prisma -> Supabase).
 */
import { createClient } from '@supabase/supabase-js'
import { isWithinHours } from './hours'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export type ResolvedRoute = {
  phoneNumber: string
  label: string
  targetId: string
  email?: string | null
} | null

export async function resolveRoute({
  agentId,
  intent,
  now = new Date(),
}: {
  agentId: string
  intent?: string
  now?: Date
}): Promise<ResolvedRoute> {
  const supabase = sb()

  const { data: agent } = await supabase
    .from('koto_inbound_agents')
    .select('id, status, business_hours, timezone')
    .eq('id', agentId)
    .maybeSingle()

  if (!agent) return null
  if (agent.status && agent.status !== 'active') return null

  const { data: targets } = await supabase
    .from('koto_inbound_routing_targets')
    .select('id, label, phone_number, email, priority, conditions')
    .eq('agent_id', agentId)
    .order('priority', { ascending: true })

  if (!targets?.length) return null

  const open = isWithinHours(agent.business_hours, agent.timezone || 'America/New_York', now)

  for (const t of targets) {
    const cond = (t.conditions || {}) as { intent?: string; hours?: string }
    if (cond.hours === 'open' && !open) continue
    if (cond.hours === 'closed' && open) continue
    if (cond.intent && cond.intent !== 'any' && cond.intent !== intent) continue
    return {
      phoneNumber: t.phone_number,
      label: t.label,
      targetId: t.id,
      email: t.email,
    }
  }
  return null
}

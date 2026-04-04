// ══════════════════════════════════════════════════════════════════════════════
// MOOSEDESK — AI routing, knowledge base, time tracking helpers
// ══════════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase'
import { callClaude } from './ai'

const CATEGORIES = [
  'general','bug','feature_request','billing','content','design',
  'seo','paid_ads','social_media','reporting','access','urgent','other'
]

// ── AI Triage — classify, prioritize, summarize, suggest response ─────────────
export async function triageTicket(ticket, knowledgeBase = []) {
  const kbContext = knowledgeBase.slice(0, 5).map(k =>
    `Previous similar issue (${k.category}): "${k.subject_pattern}" → Resolution: ${k.resolution}`
  ).join('\n')

  const prompt =
    'You are an AI support agent for a marketing agency. Triage this incoming support ticket.\n\n' +
    'Subject: ' + ticket.subject + '\n' +
    'From: ' + ticket.submitter_name + ' (' + ticket.submitter_email + ')\n' +
    'Message: ' + ticket.description + '\n' +
    (kbContext ? '\nKnowledge base context:\n' + kbContext : '') +
    '\n\nReturn ONLY this JSON:\n' +
    '{"category":"one of: ' + CATEGORIES.join('|') + '",' +
    '"priority":"low|normal|high|urgent|critical",' +
    '"sentiment":"positive|neutral|negative|frustrated",' +
    '"summary":"1 sentence summary of what the client needs",' +
    '"tags":["tag1","tag2","tag3"],' +
    '"suggestedResponse":"A professional, helpful draft response the agent can send to the client (2-4 sentences). Use their name. Be specific to their issue. Sign off with the agency name.",' +
    '"internalNote":"1-2 sentence internal analysis for the agent: what this is really about, urgency, and recommended first action."}'

  const raw = await callClaude(
    'You are an expert support desk AI. Return only raw JSON, no markdown.',
    prompt, 1500
  )
  const clean = raw.replace(/```json|```/g,'').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s === -1) throw new Error('No JSON in triage response')
  try { return JSON.parse(clean.slice(s, e+1)) }
  catch(_) { return JSON.parse(clean.slice(s, e+1).replace(/,\s*}/g,'}').replace(/,\s*]/g,']')) }
}

// ── Apply routing rules to a ticket ──────────────────────────────────────────
export async function applyRoutingRules(ticket, agencyId) {
  const { data: rules } = await supabase
    .from('desk_routing_rules')
    .select('*, desk_agents(*)')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('priority')

  if (!rules?.length) return null

  for (const rule of rules) {
    let matches = true

    if (rule.match_category?.length) {
      if (!rule.match_category.includes(ticket.ai_category || ticket.category)) matches = false
    }
    if (rule.match_priority?.length) {
      if (!rule.match_priority.includes(ticket.ai_priority || ticket.priority)) matches = false
    }
    if (rule.match_client_id) {
      if (rule.match_client_id !== ticket.client_id) matches = false
    }
    if (rule.match_keywords?.length && matches) {
      const text = (ticket.subject + ' ' + ticket.description).toLowerCase()
      const hasKw = rule.match_keywords.some(kw => text.includes(kw.toLowerCase()))
      if (!hasKw) matches = false
    }

    if (matches) return rule
  }
  return null
}

// ── Log activity ──────────────────────────────────────────────────────────────
export async function logActivity(ticketId, actor, action, detail, metadata = {}) {
  await supabase.from('desk_activity').insert({
    ticket_id: ticketId,
    actor_name: actor.name || 'System',
    actor_type: actor.type || 'system',
    action, detail, metadata,
  })
}

// ── Start time tracking ───────────────────────────────────────────────────────
export async function startTimer(ticketId, agent) {
  const { data, error } = await supabase.from('desk_time_logs').insert({
    ticket_id:   ticketId,
    agent_id:    agent.id,
    agent_name:  agent.name,
    hourly_rate: agent.hourly_rate || 0,
    started_at:  new Date().toISOString(),
    is_running:  true,
  }).select().single()
  return { data, error }
}

// ── Stop time tracking ────────────────────────────────────────────────────────
export async function stopTimer(logId, note = '') {
  const { data: log } = await supabase.from('desk_time_logs')
    .select('*').eq('id', logId).single()
  if (!log) return null

  const stoppedAt = new Date()
  const minutes   = Math.round((stoppedAt - new Date(log.started_at)) / 60000)
  const cost      = parseFloat(((minutes / 60) * (log.hourly_rate || 0)).toFixed(2))

  const { data } = await supabase.from('desk_time_logs').update({
    stopped_at: stoppedAt.toISOString(),
    minutes, cost, note, is_running: false,
  }).eq('id', logId).select().single()

  // Update ticket totals
  await supabase.rpc('update_ticket_time_totals', { p_ticket_id: log.ticket_id })
    .catch(() => {
      // Fallback: manual update
      supabase.from('desk_tickets').select('total_time_minutes,total_cost')
        .eq('id', log.ticket_id).single().then(({ data: t }) => {
          if (t) {
            supabase.from('desk_tickets').update({
              total_time_minutes: (t.total_time_minutes || 0) + minutes,
              total_cost: parseFloat(((t.total_cost || 0) + cost).toFixed(2)),
              updated_at: new Date().toISOString(),
            }).eq('id', log.ticket_id)
          }
        })
    })

  return data
}

// ── Learn from resolved ticket (adds to knowledge base) ──────────────────────
export async function learnFromTicket(ticket, resolution, agencyId) {
  if (!resolution?.trim()) return
  await supabase.from('desk_knowledge').insert({
    agency_id:       agencyId,
    ticket_id:       ticket.id,
    category:        ticket.ai_category || ticket.category,
    subject_pattern: ticket.subject?.slice(0, 100),
    resolution:      resolution,
    tags:            ticket.ai_tags || [],
    confidence:      1.0,
  })
}

// ── Get knowledge base context for similar tickets ────────────────────────────
export async function getKnowledgeContext(subject, category, agencyId) {
  const { data } = await supabase.from('desk_knowledge')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('category', category)
    .order('use_count', { ascending: false })
    .limit(5)
  return data || []
}

export { CATEGORIES }

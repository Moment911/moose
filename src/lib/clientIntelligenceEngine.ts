// ── Client Intelligence Engine ───────────────────────────────────────────────
// Builds complete AI system prompts from client intelligence profiles.

import { createClient } from '@supabase/supabase-js'
import { getIndustryConfig } from './industryLLMEngine'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function buildClientSystemPrompt(
  clientId: string,
  campaignId?: string
): Promise<string> {
  const supabase = getSupabase()

  // Fetch client intelligence
  const { data: intel } = await supabase
    .from('koto_client_intelligence')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (!intel) return 'You are an AI voice agent for a marketing agency.'

  // Fetch call brief if campaign specified
  let brief: any = null
  if (campaignId) {
    const { data } = await supabase
      .from('koto_client_call_briefs')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .maybeSingle()
    brief = data
  }

  // Fetch client's industry config
  const { data: client } = await supabase
    .from('clients')
    .select('industry_sic_code')
    .eq('id', clientId)
    .maybeSingle()

  let industryConfig: any = null
  if (client?.industry_sic_code) {
    industryConfig = await getIndustryConfig(client.industry_sic_code)
  }

  // Build the prompt
  const parts: string[] = []

  // Agent identity
  parts.push(`You are ${intel.agent_name || 'Alex'}, a voice agent calling on behalf of ${intel.dba_name || intel.business_legal_name || 'a business'}.`)
  if (intel.agent_persona) parts.push(`PERSONA: ${intel.agent_persona}`)
  if (intel.brand_voice) parts.push(`BRAND VOICE: ${intel.brand_voice}`)

  // Business context
  parts.push('\n-- ABOUT THE BUSINESS --')
  if (intel.elevator_pitch) parts.push(intel.elevator_pitch)
  if (intel.primary_service) parts.push(`PRIMARY SERVICE: ${intel.primary_service}`)
  if (intel.unique_value_proposition) parts.push(`UNIQUE VALUE: ${intel.unique_value_proposition}`)
  if (intel.years_in_business) parts.push(`IN BUSINESS: ${intel.years_in_business} years`)

  // Proof points
  const proofs = intel.proof_points || []
  if (proofs.length > 0) {
    parts.push('\n-- PROOF POINTS (use naturally in conversation) --')
    proofs.slice(0, 5).forEach((p: any) => parts.push(`- ${typeof p === 'string' ? p : p.point || p.text || JSON.stringify(p)}`))
  }

  // Closer details
  if (intel.closer_name) {
    parts.push('\n-- THE CLOSER (who you are booking for) --')
    parts.push(`Name: ${intel.closer_name}`)
    if (intel.closer_title) parts.push(`Title: ${intel.closer_title}`)
    if (intel.closer_bio) parts.push(`Bio: ${intel.closer_bio}`)
    if (intel.closer_results) parts.push(`Results: ${intel.closer_results}`)
    if (intel.meeting_duration_minutes) parts.push(`Meeting: ${intel.meeting_duration_minutes} minutes via ${intel.meeting_platform || 'phone'}`)
  }

  // Discovery questions
  const questions = intel.custom_discovery_questions || []
  if (questions.length > 0) {
    parts.push('\n-- DISCOVERY QUESTIONS --')
    questions.forEach((q: any, i: number) => parts.push(`${i + 1}. ${typeof q === 'string' ? q : q.question || JSON.stringify(q)}`))
  }

  // Objection handling
  const objections = intel.custom_objection_responses || []
  if (objections.length > 0) {
    parts.push('\n-- OBJECTION HANDLING --')
    objections.forEach((o: any) => {
      if (typeof o === 'string') parts.push(`- ${o}`)
      else parts.push(`"${o.objection || o.trigger}": ${o.response}`)
    })
  }

  // Competition awareness
  const competitors = intel.main_competitors || []
  if (competitors.length > 0) {
    parts.push('\n-- COMPETITION (if prospect mentions) --')
    competitors.forEach((c: any) => {
      parts.push(`${c.name}: Our advantage: ${c.our_advantage || c.weakness || 'we deliver better results'}`)
    })
  }

  // Things to never say
  const neverSay = intel.things_to_never_say || []
  const sensitive = intel.sensitive_topics || []
  if (neverSay.length > 0 || sensitive.length > 0) {
    parts.push('\n-- NEVER SAY / AVOID --')
    neverSay.forEach((t: any) => parts.push(`- NEVER: ${typeof t === 'string' ? t : JSON.stringify(t)}`))
    sensitive.forEach((t: any) => parts.push(`- AVOID TOPIC: ${typeof t === 'string' ? t : JSON.stringify(t)}`))
    if (intel.pricing_restrictions) parts.push(`- PRICING: ${intel.pricing_restrictions}`)
  }

  // Campaign-specific brief
  if (brief) {
    parts.push('\n-- CAMPAIGN BRIEF --')
    if (brief.campaign_objective) parts.push(`OBJECTIVE: ${brief.campaign_objective}`)
    if (brief.primary_message) parts.push(`KEY MESSAGE: ${brief.primary_message}`)
    if (brief.call_to_action) parts.push(`CTA: ${brief.call_to_action}`)
    const talkingPoints = brief.top_talking_points || []
    talkingPoints.forEach((tp: any) => parts.push(`- ${typeof tp === 'string' ? tp : JSON.stringify(tp)}`))
  }

  // Industry context
  if (industryConfig) {
    parts.push('\n-- INDUSTRY CONTEXT --')
    if (industryConfig.vocabulary?.length) parts.push(`INDUSTRY TERMS: ${industryConfig.vocabulary.slice(0, 8).join(', ')}`)
    if (industryConfig.benchmark_talking_points?.length) {
      parts.push('BENCHMARKS:')
      industryConfig.benchmark_talking_points.forEach((b: string) => parts.push(`- ${b}`))
    }
  }

  // Special instructions
  if (intel.special_instructions) parts.push(`\n-- SPECIAL INSTRUCTIONS --\n${intel.special_instructions}`)
  if (intel.opening_line) parts.push(`\nOPENING LINE: ${intel.opening_line}`)

  // Standard rules
  parts.push('\n-- RULES --')
  parts.push('- Be natural and conversational, not robotic')
  parts.push('- Listen more than you talk')
  parts.push('- Keep calls under 4 minutes unless prospect is engaged')
  parts.push('- If not interested after 2 attempts, thank them and end politely')

  return parts.join('\n')
}

export function scoreClientProfileCompleteness(intel: any): number {
  if (!intel) return 0

  const required: [string, number][] = [
    ['business_legal_name', 5], ['primary_service', 8], ['elevator_pitch', 8],
    ['unique_value_proposition', 8], ['closer_name', 8], ['closer_phone', 5],
    ['closer_calendar_url', 5], ['agent_name', 5], ['opening_line', 5],
    ['brand_voice', 3],
  ]

  const optional: [string, number][] = [
    ['founder_story', 3], ['testimonials', 4], ['case_studies', 4],
    ['proof_points', 4], ['main_competitors', 3], ['custom_discovery_questions', 4],
    ['custom_objection_responses', 4], ['things_to_never_say', 2],
    ['closer_bio', 3], ['closer_expertise', 2], ['meeting_duration_minutes', 2],
    ['ideal_customer_profile', 3], ['customer_pain_points', 3],
    ['geographic_coverage', 2], ['google_business_data', 2],
  ]

  let score = 0
  for (const [field, weight] of required) {
    const val = intel[field]
    if (val && (typeof val === 'string' ? val.length > 0 : Array.isArray(val) ? val.length > 0 : typeof val === 'object' ? Object.keys(val).length > 0 : true)) {
      score += weight
    }
  }
  for (const [field, weight] of optional) {
    const val = intel[field]
    if (val && (typeof val === 'string' ? val.length > 0 : Array.isArray(val) ? val.length > 0 : typeof val === 'object' ? Object.keys(val).length > 0 : true)) {
      score += weight
    }
  }

  return Math.min(100, score)
}

export async function autoResearchClient(clientId: string): Promise<any> {
  const supabase = getSupabase()

  const { data: client } = await supabase
    .from('clients')
    .select('business_name, website, phone, city, state')
    .eq('id', clientId)
    .single()

  if (!client) return null

  const research: any = { researched_at: new Date().toISOString() }

  // Google Places lookup
  const placesKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
  if (placesKey && client.business_name) {
    try {
      const query = `${client.business_name} ${client.city || ''} ${client.state || ''}`
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,rating,user_ratings_total,formatted_address,formatted_phone_number,website,types,place_id,opening_hours&key=${placesKey}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const json = await res.json()
        const place = json.candidates?.[0]
        if (place) {
          research.google_business_data = {
            name: place.name,
            rating: place.rating,
            review_count: place.user_ratings_total,
            address: place.formatted_address,
            phone: place.formatted_phone_number,
            website: place.website,
            types: place.types,
            place_id: place.place_id,
          }
        }
      }
    } catch { /* continue */ }
  }

  // Update client intelligence
  const updates: any = {
    last_updated_at: new Date().toISOString(),
  }
  if (research.google_business_data) {
    updates.google_business_data = research.google_business_data
    updates.avg_review_rating = research.google_business_data.rating
    updates.total_reviews = research.google_business_data.review_count
  }

  await supabase
    .from('koto_client_intelligence')
    .update(updates)
    .eq('client_id', clientId)

  return research
}

export function buildRetellDynamicVarsFromClient(intel: any, industryConfig: any): Record<string, string> {
  const vars: Record<string, string> = {}

  vars.agent_name = intel?.agent_name || 'Alex'
  vars.client_name = intel?.dba_name || intel?.business_legal_name || ''
  vars.primary_service = intel?.primary_service || ''
  vars.unique_value = intel?.unique_value_proposition || ''
  vars.closer_name = intel?.closer_name || 'our team'
  vars.closer_title = intel?.closer_title || ''
  vars.closer_bio = (intel?.closer_bio || '').substring(0, 200)
  vars.meeting_duration = String(intel?.meeting_duration_minutes || 15)

  const proofs = intel?.proof_points || []
  vars.proof_point = proofs[0] ? (typeof proofs[0] === 'string' ? proofs[0] : proofs[0].text || '') : ''

  if (industryConfig) {
    vars.industry_context = industryConfig.industry_name || ''
    const benchmarks = industryConfig.benchmark_talking_points || []
    vars.top_pain_point = benchmarks[0] || ''
  }

  const questions = intel?.custom_discovery_questions || []
  vars.best_question_1 = questions[0] ? (typeof questions[0] === 'string' ? questions[0] : questions[0].question || '') : ''
  vars.best_question_2 = questions[1] ? (typeof questions[1] === 'string' ? questions[1] : questions[1].question || '') : ''
  vars.best_question_3 = questions[2] ? (typeof questions[2] === 'string' ? questions[2] : questions[2].question || '') : ''

  return vars
}

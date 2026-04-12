import 'server-only' // fails the build if this module is ever imported from a client component
// ── Live Conversation Engine ──────────────────────────────────────────────────
// Feature 3: Dynamic Script Adaptation
// Feature 4: Competitor Intelligence Injection

import { createClient } from '@supabase/supabase-js'
import { classifyQuestion, classifyAnswer } from './qaIntelligence'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface NextQuestionSuggestion {
  question_text: string
  question_type: string
  appointment_rate: number
  times_asked: number
  rationale: string
  urgency: 'high' | 'medium' | 'low'
}

export interface BattleCard {
  competitor: string
  detected_in: string
  talking_points: string[]
  pivot_question: string
  weakness_to_probe: string
}

export interface LiveRoutingResult {
  next_questions: NextQuestionSuggestion[]
  battle_cards: BattleCard[]
  conversation_stage: 'opening' | 'discovery' | 'pitch' | 'objection' | 'closing'
  engagement_signal: 'hot' | 'warm' | 'neutral' | 'cooling'
  suggested_pivot: string | null
  transcript_summary: string
}

const COMPETITOR_INTEL: Record<string, { weaknesses: string[]; pivot: string; probe: string }> = {
  'Vendasta': { weaknesses: ['complex platform with steep learning curve', 'expensive for small agencies', 'support response times are slow'], pivot: 'Koto is purpose-built for agencies under 50 clients — no bloat, no enterprise pricing', probe: 'What\'s the one thing Vendasta hasn\'t been able to solve for you?' },
  'Birdeye': { weaknesses: ['reviews-only — no voice, no SEO, no AI outreach in one place', 'pricing scales steeply per location', 'no outbound calling capability'], pivot: 'Koto combines AI voice outreach + reputation + SEO in a single platform at a fraction of the cost', probe: 'Are you getting measurable new leads from Birdeye, or mostly review management?' },
  'Podium': { weaknesses: ['primarily SMS-focused, not a full marketing platform', 'high per-location pricing', 'no AI voice calling or SEO tools'], pivot: 'Podium owns the conversation channel — Koto owns the full customer acquisition funnel', probe: 'Beyond text messaging, how are you generating net-new leads right now?' },
  'Yext': { weaknesses: ['listing management focus with limited growth tools', 'expensive annual contracts', 'no AI voice or outbound automation'], pivot: 'Yext keeps you accurate — Koto makes you discoverable and gets prospects on the phone', probe: 'Are you seeing a direct revenue impact from Yext, or mostly citation cleanup?' },
  'GoHighLevel': { weaknesses: ['complex CRM requiring heavy setup', 'not purpose-built for local service businesses', 'voice AI is basic compared to Retell-powered calling'], pivot: 'GHL is a great ops tool — Koto is your AI-powered new client acquisition engine on top of it', probe: 'How much time does your team spend setting up and maintaining GHL workflows?' },
  'Semrush': { weaknesses: ['SEO data tool only — no client delivery, no voice, no reputation', 'expensive for agencies delivering SEO services', 'clients can\'t log in or see progress'], pivot: 'Koto takes the Semrush data and turns it into automated deliverables clients can see', probe: 'Are your clients getting reports or just raw keyword data right now?' },
  'Reputation': { weaknesses: ['enterprise focus with pricing to match', 'complex implementation', 'limited AI outbound capability'], pivot: 'Reputation.com is built for franchise brands — Koto is built for your agency to scale local clients', probe: 'What does implementation look like for a new client on their platform?' },
}

const GENERIC_BATTLE_CARDS = [
  'Ask: "What\'s the one thing your current solution hasn\'t been able to solve?"',
  'Ask: "Are you locked into a contract, or is this month-to-month?"',
  'Ask: "If you could wave a magic wand and change one thing about it, what would it be?"',
  'Position: Koto is the only platform combining AI voice outreach + SEO + reputation management for agencies',
]

function getConversationStage(durationSeconds: number, transcript: string): 'opening' | 'discovery' | 'pitch' | 'objection' | 'closing' {
  if (/schedule|book|calendar|appointment|next step|meet|demo/i.test(transcript) && durationSeconds > 90) return 'closing'
  if (/not interested|already have|don't need|no thanks|remove me/i.test(transcript)) return 'objection'
  if (durationSeconds < 45) return 'opening'
  if (durationSeconds < 120) return 'discovery'
  if (durationSeconds < 240) return 'pitch'
  return 'closing'
}

function getRationale(questionType: string, lastAnswerType: string, stage: string, apptRate: number): string {
  if (lastAnswerType === 'objection' && questionType === 'discovery') return `Reframe after objection — re-engage with discovery ${apptRate ? `(${Math.round(apptRate)}% appt rate)` : ''}`
  if (lastAnswerType === 'interest' && questionType === 'closing') return `Prospect showed interest — move toward close ${apptRate ? `(${Math.round(apptRate)}% appt rate)` : ''}`
  if (stage === 'closing') return `Closing stage — high-converting ask ${apptRate ? `(${Math.round(apptRate)}% appt rate)` : ''}`
  return `Top performer for this stage ${apptRate ? `(${Math.round(apptRate)}% appt rate)` : ''}`
}

function getDefaultQuestions(stage: string): NextQuestionSuggestion[] {
  const defaults: Record<string, NextQuestionSuggestion[]> = {
    opening: [{ question_text: 'How are you currently getting new customers?', question_type: 'discovery', appointment_rate: 0, times_asked: 0, rationale: 'Standard opener — reveals current strategy', urgency: 'medium' }, { question_text: 'What does your online presence look like right now?', question_type: 'discovery', appointment_rate: 0, times_asked: 0, rationale: 'Opens door to website/SEO/reviews pitch', urgency: 'medium' }],
    discovery: [{ question_text: 'If you could double your inbound calls, what would that do for your business?', question_type: 'discovery', appointment_rate: 0, times_asked: 0, rationale: 'Aspirational question — creates desire', urgency: 'high' }, { question_text: 'What\'s your biggest challenge with getting reviews from happy customers?', question_type: 'discovery', appointment_rate: 0, times_asked: 0, rationale: 'Pain-point for reviews pitch', urgency: 'medium' }],
    objection: [{ question_text: 'I completely understand — what would need to be different for this to be a fit?', question_type: 'objection', appointment_rate: 0, times_asked: 0, rationale: 'Non-confrontational reframe', urgency: 'high' }, { question_text: 'What\'s the one thing holding you back from moving forward today?', question_type: 'objection', appointment_rate: 0, times_asked: 0, rationale: 'Isolates the real objection', urgency: 'high' }],
    closing: [{ question_text: 'Does Tuesday or Wednesday work better for a 20-minute demo?', question_type: 'closing', appointment_rate: 0, times_asked: 0, rationale: 'Assumptive close with two options', urgency: 'high' }, { question_text: 'What would you need to see in a demo to feel confident moving forward?', question_type: 'closing', appointment_rate: 0, times_asked: 0, rationale: 'Uncovers demo criteria before booking', urgency: 'medium' }],
    pitch: [{ question_text: 'How many new clients would you need per month to consider this a success?', question_type: 'discovery', appointment_rate: 0, times_asked: 0, rationale: 'Anchors ROI expectation', urgency: 'medium' }],
  }
  return defaults[stage] || defaults.discovery
}

export async function getNextQuestionSuggestions(partialTranscript: string, sicCode: string, agencyId: string, callDurationSeconds: number): Promise<NextQuestionSuggestion[]> {
  const supabase = sb()
  const lines = partialTranscript.split('\n').filter(l => l.trim().length > 5)
  const recentLines = lines.slice(-8)
  const stage = getConversationStage(callDurationSeconds, partialTranscript)
  const lastProspectLine = recentLines.filter(l => /^(?:prospect|customer|lead|caller|human|user):/i.test(l)).pop() || ''
  const lastProspectText = lastProspectLine.replace(/^[^:]+:\s*/, '').trim()
  const lastAnswerType = lastProspectText ? classifyAnswer(lastProspectText) : 'neutral'
  const lastAgentLine = recentLines.filter(l => /^(?:agent|ai|rep|sales|assistant):/i.test(l)).pop() || ''
  const lastAgentText = lastAgentLine.replace(/^[^:]+:\s*/, '').trim()
  const lastQuestionType = lastAgentText ? classifyQuestion(lastAgentText) : 'discovery'
  const positionMin = stage === 'opening' ? 0 : stage === 'discovery' ? 15 : stage === 'pitch' ? 40 : 70
  const positionMax = stage === 'opening' ? 25 : stage === 'discovery' ? 55 : stage === 'pitch' ? 75 : 100
  let query = supabase.from('koto_qa_intelligence').select('question_text, question_type, appointment_rate_when_asked, times_asked, avg_position_in_call').gte('total_calls_with_question', 2).gte('avg_position_in_call', positionMin).lte('avg_position_in_call', positionMax).order('appointment_rate_when_asked', { ascending: false }).limit(20)
  if (sicCode && sicCode !== 'unknown') query = query.eq('industry_sic_code', sicCode)
  const { data: candidates } = await query
  if (!candidates || candidates.length === 0) return getDefaultQuestions(stage)
  return candidates.map(q => { let s = q.appointment_rate_when_asked || 0; if (lastAnswerType === 'objection' && q.question_type === 'objection') s += 20; if (lastAnswerType === 'interest' && q.question_type === 'closing') s += 15; if (lastAnswerType === 'acceptance' && q.question_type === 'closing') s += 25; if (stage === 'closing' && q.question_type === 'closing') s += 10; if (q.question_type === lastQuestionType && lastQuestionType !== 'objection') s -= 15; return { ...q, composite_score: s } }).sort((a, b) => b.composite_score - a.composite_score).slice(0, 3).map(q => ({ question_text: q.question_text, question_type: q.question_type, appointment_rate: Math.round(q.appointment_rate_when_asked || 0), times_asked: q.times_asked, rationale: getRationale(q.question_type, lastAnswerType, stage, q.appointment_rate_when_asked), urgency: (q.appointment_rate_when_asked >= 60 ? 'high' : q.appointment_rate_when_asked >= 35 ? 'medium' : 'low') as 'high' | 'medium' | 'low' }))
}

export function detectAndInjectBattleCards(partialTranscript: string, previouslyDetected: string[] = []): BattleCard[] {
  const recentLines = partialTranscript.split('\n').slice(-10)
  const results: BattleCard[] = []
  for (const line of recentLines) {
    if (/^(?:agent|ai|rep|sales|assistant):/i.test(line)) continue
    const lineText = line.replace(/^[^:]+:\s*/, '').trim()
    if (lineText.length < 5) continue
    for (const [competitor, intel] of Object.entries(COMPETITOR_INTEL)) {
      if (previouslyDetected.includes(competitor)) continue
      if (new RegExp(competitor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(lineText)) {
        results.push({ competitor, detected_in: lineText.substring(0, 120), talking_points: intel.weaknesses.map(w => `Their weakness: ${w}`), pivot_question: intel.pivot, weakness_to_probe: intel.probe })
      }
    }
    if (/(?:we (?:use|work with|have)|currently (?:using|working with)|already (?:have|using))\s+(?:an?\s+)?(?:agency|company|platform|tool|vendor|someone|another)/i.test(lineText) && !previouslyDetected.includes('__generic__')) {
      const nameMatch = lineText.match(/(?:use|working with|have)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)\s/i)
      const competitor = nameMatch?.[1] || 'Unknown'
      if (!results.some(r => r.competitor === competitor)) results.push({ competitor, detected_in: lineText.substring(0, 120), talking_points: GENERIC_BATTLE_CARDS, pivot_question: 'Koto is the only platform combining AI voice + SEO + reputation management in one place', weakness_to_probe: 'What\'s the one thing your current solution hasn\'t been able to solve?' })
    }
  }
  return results
}

export async function getLiveRoutingPacket(callId: string, partialTranscript: string, sicCode: string, agencyId: string, durationSeconds: number, knownCompetitors: string[] = []): Promise<LiveRoutingResult> {
  const [nextQuestions, battleCards] = await Promise.all([getNextQuestionSuggestions(partialTranscript, sicCode, agencyId, durationSeconds), Promise.resolve(detectAndInjectBattleCards(partialTranscript, knownCompetitors))])
  const stage = getConversationStage(durationSeconds, partialTranscript)
  const t = partialTranscript.toLowerCase()
  const engagement: 'hot' | 'warm' | 'neutral' | 'cooling' = /schedule|book|calendar|yes|sounds good|tell me more|interested|love to/i.test(t) ? 'hot' : /maybe|possibly|not sure|let me think/i.test(t) ? 'warm' : /not interested|no thanks|already|busy|call back/i.test(t) ? 'cooling' : 'neutral'
  const suggestedPivot = engagement === 'cooling' ? 'Prospect cooling — pivot to pain discovery: "What would need to change for this to be the right time?"' : engagement === 'hot' && stage !== 'closing' ? 'Buying signal detected — move to close: "Does Tuesday or Wednesday work for a quick demo?"' : battleCards.length > 0 ? `Competitor detected — use probe: "${battleCards[0].weakness_to_probe}"` : null
  const lines = partialTranscript.split('\n').filter(l => l.trim().length > 5)
  return { next_questions: nextQuestions, battle_cards: battleCards, conversation_stage: stage, engagement_signal: engagement, suggested_pivot: suggestedPivot, transcript_summary: lines.slice(-6).join(' | ').substring(0, 300) }
}

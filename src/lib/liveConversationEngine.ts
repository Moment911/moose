// ── Live conversation routing engine ──────────────────────────────────────────
// Runs mid-call to decide the next best move and inject competitor battle cards.

export interface RoutingSignal {
  action: 'continue' | 'transfer' | 'offer_appointment' | 'send_info' | 'escalate' | 'wrap_up'
  confidence: number
  reason: string
}

export interface BattleCard {
  competitor: string
  weaknesses: string[]
  our_advantage: string
  suggested_rebuttal: string
}

export interface LiveRoutingResult {
  next_move: RoutingSignal
  battle_cards: BattleCard[]
  suggested_questions: string[]
  momentum: 'rising' | 'steady' | 'falling'
  talk_ratio_warning: boolean
}

// ── Competitor database ─────────────────────────────────────────────────────

const COMPETITOR_INTEL: Record<string, Omit<BattleCard, 'competitor'>> = {
  scorpion: {
    weaknesses: ['Long-term contracts (12-24mo)', 'Templated websites with limited customization', 'Slow response times reported by clients'],
    our_advantage: 'Month-to-month flexibility with fully custom builds',
    suggested_rebuttal: 'Unlike Scorpion, we don\'t lock you into long contracts — you stay because of results, not a signature.',
  },
  hibu: {
    weaknesses: ['Generic content across clients', 'Limited reporting transparency', 'Bundled packages with hidden fees'],
    our_advantage: 'Full transparency — you own everything we build, with real-time reporting',
    suggested_rebuttal: 'We hear that a lot from Hibu clients. The difference is we give you full access to your data and you own every asset.',
  },
  thryv: {
    weaknesses: ['All-in-one but shallow on each feature', 'Higher price point for SMBs', 'Poor SEO track record'],
    our_advantage: 'Deep specialization in what actually drives leads — SEO, reviews, and local presence',
    suggested_rebuttal: 'Thryv tries to do everything, which means nothing gets done deeply. We focus on what moves the needle for your revenue.',
  },
  yext: {
    weaknesses: ['Listing management only — no lead gen', 'Expensive for what you get', 'Listings revert if you cancel'],
    our_advantage: 'Listings plus full lead generation pipeline that you own permanently',
    suggested_rebuttal: 'Yext is great for listings, but listings alone don\'t generate calls. We build the full pipeline.',
  },
  default: {
    weaknesses: ['Generic approach', 'Limited local expertise', 'No AI-powered optimization'],
    our_advantage: 'AI-driven local marketing with real-time optimization and transparent reporting',
    suggested_rebuttal: 'What specifically are they doing for you today? Let\'s compare apples to apples.',
  },
}

// ── Signal detection patterns ───────────────────────────────────────────────

const TRANSFER_SIGNALS = [
  /ready to (?:get started|sign up|move forward)/i,
  /let'?s do (?:it|this)/i,
  /where do i sign/i,
  /send (?:me )?the (?:contract|agreement|proposal)/i,
  /what(?:'s| is) the next step/i,
  /i'?m sold/i,
  /can we start (?:this|next) week/i,
]

const APPOINTMENT_SIGNALS = [
  /can we (?:meet|schedule|set up)/i,
  /what does your (?:calendar|schedule) look like/i,
  /i'?d like to (?:see|hear) more/i,
  /show me (?:a demo|examples|results)/i,
  /when are you (?:free|available)/i,
]

const OBJECTION_SIGNALS = [
  /too expensive|out of (?:my|our) budget/i,
  /need to think about it/i,
  /talk to my (?:partner|wife|husband|boss)/i,
  /not (?:the right|a good) time/i,
  /already (?:have|using|working with)/i,
  /we tried (?:that|marketing|seo) before/i,
]

const DISENGAGEMENT_SIGNALS = [
  /(?:just )?send (?:me )?(?:an )?email/i,
  /i(?:'m| am) not interested/i,
  /take me off|stop calling/i,
  /(?:i )?gotta go|in a meeting/i,
]

const COMPETITOR_PATTERNS = [
  { pattern: /scorpion/i, name: 'scorpion' },
  { pattern: /hibu/i, name: 'hibu' },
  { pattern: /thryv/i, name: 'thryv' },
  { pattern: /yext/i, name: 'yext' },
  { pattern: /(?:using|working with|have)\s+(?:a |an )?(?:another |different )?(agency|company|vendor|firm)/i, name: 'default' },
]

// ── Suggested follow-up questions ───────────────────────────────────────────

const QUESTION_BANK: Record<string, string[]> = {
  pricing_objection: [
    'What kind of budget were you thinking for marketing this year?',
    'If I could show a 3x return within 90 days, would that change the conversation?',
    'What are you spending now on marketing that isn\'t working?',
  ],
  not_decision_maker: [
    'That makes sense — would it help if I put together a one-page summary they can review?',
    'Could we set up a quick 15-minute call with both of you?',
  ],
  competitor_mentioned: [
    'What\'s working well with them currently?',
    'What would need to change for you to consider a switch?',
    'Are you under contract, or is that month-to-month?',
  ],
  general_interest: [
    'What\'s your biggest challenge right now when it comes to getting new customers?',
    'If you could fix one thing about your online presence today, what would it be?',
    'How are most of your current customers finding you?',
  ],
  high_engagement: [
    'Based on what you\'ve told me, I think we could put together something really targeted — want me to walk you through what that looks like?',
    'Should I put together a custom proposal so you can see exactly what we\'d do?',
  ],
}

// ── Core routing logic ──────────────────────────────────────────────────────

export function computeLiveRouting(
  transcript: string,
  durationSec: number,
  leadScore: number,
  sentiment: string,
): LiveRoutingResult {
  const lines = transcript.split('\n').filter(l => l.trim().length > 0)
  const recentLines = lines.slice(-10) // focus on last 10 lines
  const recentText = recentLines.join('\n')

  // Detect signals in recent conversation
  let transferScore = 0
  let appointmentScore = 0
  let objectionScore = 0
  let disengageScore = 0

  for (const line of recentLines) {
    for (const p of TRANSFER_SIGNALS) { if (p.test(line)) transferScore++ }
    for (const p of APPOINTMENT_SIGNALS) { if (p.test(line)) appointmentScore++ }
    for (const p of OBJECTION_SIGNALS) { if (p.test(line)) objectionScore++ }
    for (const p of DISENGAGEMENT_SIGNALS) { if (p.test(line)) disengageScore++ }
  }

  // Detect competitors
  const battle_cards: BattleCard[] = []
  const detectedCompetitors = new Set<string>()
  for (const line of lines) {
    for (const { pattern, name } of COMPETITOR_PATTERNS) {
      if (pattern.test(line) && !detectedCompetitors.has(name)) {
        detectedCompetitors.add(name)
        const intel = COMPETITOR_INTEL[name] || COMPETITOR_INTEL.default
        battle_cards.push({ competitor: name, ...intel })
      }
    }
  }

  // Compute momentum
  const earlyLines = lines.slice(0, Math.floor(lines.length / 2))
  const lateLines = lines.slice(Math.floor(lines.length / 2))
  let earlyPositive = 0, latePositive = 0
  for (const l of earlyLines) { if (/interesting|great|yes|sure|ok|definitely/i.test(l)) earlyPositive++ }
  for (const l of lateLines) { if (/interesting|great|yes|sure|ok|definitely/i.test(l)) latePositive++ }
  const momentum: 'rising' | 'steady' | 'falling' =
    latePositive > earlyPositive + 1 ? 'rising' :
    earlyPositive > latePositive + 1 ? 'falling' : 'steady'

  // Talk ratio warning (agent talking too much)
  let agentLines = 0, prospectLines = 0
  for (const l of recentLines) {
    if (/^(?:agent|rep|sales|you)\s*:/i.test(l)) agentLines++
    else prospectLines++
  }
  const talk_ratio_warning = prospectLines > 0 ? (agentLines / prospectLines) > 2.0 : agentLines > 5

  // Determine next move
  let next_move: RoutingSignal

  if (disengageScore >= 2) {
    next_move = { action: 'wrap_up', confidence: 90, reason: 'Prospect showing disengagement signals — wrap up gracefully' }
  } else if (transferScore >= 2 || (leadScore >= 85 && transferScore >= 1)) {
    next_move = { action: 'transfer', confidence: 85 + transferScore * 5, reason: 'Strong buying signals detected — transfer to closer' }
  } else if (appointmentScore >= 1 && sentiment !== 'negative') {
    next_move = { action: 'offer_appointment', confidence: 70 + appointmentScore * 10, reason: 'Prospect open to next steps — offer appointment' }
  } else if (objectionScore >= 2) {
    next_move = { action: 'send_info', confidence: 60, reason: 'Multiple objections — offer to send targeted info and follow up' }
  } else if (durationSec > 120 && momentum === 'rising') {
    next_move = { action: 'offer_appointment', confidence: 65, reason: 'Good duration with rising momentum — time to close' }
  } else if (durationSec > 300 && momentum !== 'rising') {
    next_move = { action: 'wrap_up', confidence: 55, reason: 'Call running long without clear progression' }
  } else {
    next_move = { action: 'continue', confidence: 50, reason: 'Keep building rapport and uncovering needs' }
  }

  // Select suggested questions based on context
  const suggested_questions: string[] = []
  if (detectedCompetitors.size > 0) {
    suggested_questions.push(...(QUESTION_BANK.competitor_mentioned || []).slice(0, 2))
  }
  if (objectionScore > 0) {
    suggested_questions.push(...(QUESTION_BANK.pricing_objection || []).slice(0, 2))
  }
  if (next_move.action === 'transfer' || momentum === 'rising') {
    suggested_questions.push(...(QUESTION_BANK.high_engagement || []).slice(0, 1))
  }
  if (suggested_questions.length === 0) {
    suggested_questions.push(...(QUESTION_BANK.general_interest || []).slice(0, 2))
  }

  return {
    next_move,
    battle_cards,
    suggested_questions: suggested_questions.slice(0, 3),
    momentum,
    talk_ratio_warning,
  }
}

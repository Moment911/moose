// ── Post-call transcript analysis ─────────────────────────────────────────────

interface BuyingSignal {
  type: string
  quote: string
  timestamp_approx: number
}

interface RedFlag {
  type: string
  quote: string
}

export interface ConversationIntelligence {
  buying_signals: BuyingSignal[]
  red_flags: RedFlag[]
  competitor_mentioned: boolean
  competitor_name: string | null
  topics_discussed: string[]
  prospect_questions: string[]
  talk_listen_ratio: number
  engagement_level: 'high' | 'medium' | 'low'
  dnc_requested: boolean
}

// ── Pattern definitions ──────────────────────────────────────────────────────

const BUYING_SIGNALS: { pattern: RegExp; type: string }[] = [
  { pattern: /sounds? interesting|tell me more/i, type: 'curiosity' },
  { pattern: /how (?:much|does it) cost/i, type: 'price_inquiry' },
  { pattern: /when can we (?:start|begin)|ready to/i, type: 'urgency' },
  { pattern: /send me (?:more )?info/i, type: 'mild_interest' },
  { pattern: /who else (?:do you|have you) work/i, type: 'social_proof_seeking' },
  { pattern: /what.*guarantee|money back/i, type: 'risk_assessment' },
]

const RED_FLAGS: { pattern: RegExp; type: string }[] = [
  { pattern: /already tried|didn't work/i, type: 'prior_bad_experience' },
  { pattern: /wife|husband|partner|boss decides/i, type: 'not_decision_maker' },
  { pattern: /don't have (?:the )?budget|can't afford/i, type: 'budget_constraint' },
  { pattern: /just email|send (?:it|info) over/i, type: 'brush_off' },
  { pattern: /take me off|stop calling|remove (?:me|my number)/i, type: 'dnc_request' },
]

const COMPETITOR_PATTERN =
  /using|working with|have .*(agency|company|vendor|someone)/i

const QUESTION_PATTERN = /^(?:prospect|lead|customer|caller)\s*:\s*(.*\?)\s*$/gim

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractLines(transcript: string): string[] {
  return transcript.split('\n').filter((l) => l.trim().length > 0)
}

function estimateTimestamp(lineIndex: number, totalLines: number, estimatedDurationSec = 300): number {
  return Math.round((lineIndex / Math.max(totalLines, 1)) * estimatedDurationSec)
}

function extractCompetitorName(line: string): string | null {
  // Try to grab a proper noun after common lead-in phrases
  const m = line.match(
    /(?:using|working with|have|switched from|compared to)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})/
  )
  return m ? m[1] : null
}

function extractTopics(transcript: string): string[] {
  const topics: Set<string> = new Set()
  const topicPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /pricing|price|cost|fee|budget|afford/i, label: 'pricing' },
    { pattern: /timeline|deadline|launch|when.*ready/i, label: 'timeline' },
    { pattern: /seo|search engine|rank|google/i, label: 'SEO' },
    { pattern: /website|site|page|landing/i, label: 'website' },
    { pattern: /social media|facebook|instagram|tiktok|linkedin/i, label: 'social_media' },
    { pattern: /review|reputation|rating/i, label: 'reviews' },
    { pattern: /ads|advertising|ppc|pay.per.click/i, label: 'advertising' },
    { pattern: /email|newsletter|drip/i, label: 'email_marketing' },
    { pattern: /brand|logo|design/i, label: 'branding' },
    { pattern: /competitor|competition/i, label: 'competitive_landscape' },
    { pattern: /contract|agreement|term|cancel/i, label: 'contract_terms' },
    { pattern: /roi|return|result|metric/i, label: 'results_roi' },
  ]
  for (const { pattern, label } of topicPatterns) {
    if (pattern.test(transcript)) topics.add(label)
  }
  return Array.from(topics)
}

function extractProspectQuestions(transcript: string): string[] {
  const questions: string[] = []
  let m: RegExpExecArray | null
  const re = /^(?:prospect|lead|customer|caller)\s*:\s*(.*\?)\s*$/gim
  while ((m = re.exec(transcript)) !== null) {
    questions.push(m[1].trim())
  }
  // Also catch any line ending with ? from non-agent speakers
  if (questions.length === 0) {
    const lines = extractLines(transcript)
    for (const line of lines) {
      if (line.trim().endsWith('?') && !/^(?:agent|rep|sales|you)\s*:/i.test(line)) {
        const cleaned = line.replace(/^[^:]+:\s*/, '').trim()
        if (cleaned.length > 5) questions.push(cleaned)
      }
    }
  }
  return questions
}

function computeTalkListenRatio(transcript: string): number {
  const lines = extractLines(transcript)
  let agentLines = 0
  let prospectLines = 0
  for (const line of lines) {
    if (/^(?:agent|rep|sales|you)\s*:/i.test(line)) agentLines++
    else prospectLines++
  }
  if (prospectLines === 0) return 1
  return Math.round((agentLines / prospectLines) * 100) / 100
}

function computeEngagement(
  buyingSignals: BuyingSignal[],
  redFlags: RedFlag[],
  prospectQuestions: string[],
): 'high' | 'medium' | 'low' {
  const positiveScore = buyingSignals.length * 2 + prospectQuestions.length
  const negativeScore = redFlags.length * 2
  const net = positiveScore - negativeScore
  if (net >= 4) return 'high'
  if (net >= 1) return 'medium'
  return 'low'
}

// ── Main analysis function ───────────────────────────────────────────────────

export async function analyzeConversation(
  transcript: string,
  outcome: string,
): Promise<ConversationIntelligence> {
  const lines = extractLines(transcript)
  const totalLines = lines.length

  // Buying signals
  const buying_signals: BuyingSignal[] = []
  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, type } of BUYING_SIGNALS) {
      if (pattern.test(lines[i])) {
        buying_signals.push({
          type,
          quote: lines[i].replace(/^[^:]+:\s*/, '').trim().substring(0, 200),
          timestamp_approx: estimateTimestamp(i, totalLines),
        })
      }
    }
  }

  // Red flags
  const red_flags: RedFlag[] = []
  let dnc_requested = false
  for (const line of lines) {
    for (const { pattern, type } of RED_FLAGS) {
      if (pattern.test(line)) {
        red_flags.push({
          type,
          quote: line.replace(/^[^:]+:\s*/, '').trim().substring(0, 200),
        })
        if (type === 'dnc_request') dnc_requested = true
      }
    }
  }

  // Competitor detection
  let competitor_mentioned = false
  let competitor_name: string | null = null
  for (const line of lines) {
    if (COMPETITOR_PATTERN.test(line)) {
      competitor_mentioned = true
      const name = extractCompetitorName(line)
      if (name) competitor_name = name
      break
    }
  }

  const topics_discussed = extractTopics(transcript)
  const prospect_questions = extractProspectQuestions(transcript)
  const talk_listen_ratio = computeTalkListenRatio(transcript)
  const engagement_level = computeEngagement(buying_signals, red_flags, prospect_questions)

  return {
    buying_signals,
    red_flags,
    competitor_mentioned,
    competitor_name,
    topics_discussed,
    prospect_questions,
    talk_listen_ratio,
    engagement_level,
    dnc_requested,
  }
}

// ── Coaching prompt generator ────────────────────────────────────────────────

export function generateCoachingPrompt(
  transcript: string,
  outcome: string,
  leadScore: number,
): string {
  return `You are an expert sales coach analyzing a cold call / sales conversation.

## Call Context
- Outcome: ${outcome}
- Lead Score: ${leadScore}/100

## Full Transcript
${transcript}

## Your Task
Analyze this conversation and provide actionable coaching feedback. Cover:

1. **Opening Assessment**: Did the rep establish rapport quickly? Was the hook compelling?
2. **Discovery Quality**: Did the rep ask enough open-ended questions? Did they uncover pain points?
3. **Objection Handling**: How well were objections addressed? Were there missed opportunities?
4. **Buying Signals**: Identify any buying signals the rep caught or missed.
5. **Red Flags**: Note any red flags (budget issues, wrong decision-maker, DNC requests).
6. **Talk-to-Listen Ratio**: Estimate how much the rep talked vs listened. Ideal is 40/60.
7. **Next Steps**: Were clear next steps established? Was there a strong close attempt?
8. **Top 3 Improvements**: Specific, actionable things this rep should do differently next time.

Be direct and specific. Reference exact quotes from the transcript when giving feedback.
Use a supportive but honest tone — the goal is improvement, not criticism.

Format your response with clear headers and bullet points for readability.`
}

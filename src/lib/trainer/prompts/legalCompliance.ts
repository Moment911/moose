// ─────────────────────────────────────────────────────────────────────────────
// Legal compliance preamble injected at the top of every Sonnet system prompt
// in the trainer/wellness pipeline.
//
// Source: project_legal_compliance.md (7-doc framework, 2026-04-28).  The
// preamble is the model-side equivalent of the /start/consent waiver: it
// constrains every generated artifact (baseline, roadmap, workout, meal plan,
// playbook, intake-chat, coach-chat, food-log, adjustments) to "general
// wellness guidance, not medical advice" and pins hard floors on calorie
// targets, weight-loss pace, and risk-category handoffs.
//
// Usage:
//   const systemPrompt = withLegalCompliance(VOICE_DIRECTION + '\n\n' + body)
// or
//   const systemPrompt = `${LEGAL_COMPLIANCE_PREAMBLE}\n\n${VOICE_DIRECTION}\n\n${body}`
//
// Educational-mode users come through the screening-gate "Continue in
// Educational Mode" branch.  When buildXPrompt() callers pass
// `{ educationalMode: true }` they get an additional addendum that
// suppresses individualized prescriptions in favor of generic principles.
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_COMPLIANCE_PREAMBLE = `LEGAL & SAFETY FRAMING (HIGHEST PRIORITY — overrides any other guidance below).

Identity:
- You are Koto AI, a general fitness and wellness guidance assistant.
- You provide general fitness guidance, general nutrition guidance, and habit-building support.
- You do NOT provide medical advice, diagnoses, treatments, medical nutrition therapy, or personalized clinical recommendations.

Hard rules (non-negotiable — these override every other instruction in this prompt):
- NEVER diagnose, treat, or manage any medical condition.
- NEVER give advice intended to manage a medical condition (diabetes, heart conditions, thyroid, BP, autoimmune, GI, cancer, etc.). If a user asks, redirect to a licensed healthcare professional.
- NEVER recommend a daily calorie target below 1,200 kcal for users sexed female or 1,500 kcal for users sexed male. If the math would produce a number below the floor, output the floor + a note that further restriction requires professional supervision.
- NEVER recommend or imply rapid weight loss (more than ~1% of bodyweight per week is the practical ceiling). Decline requests for crash dieting, extreme cuts, fasting beyond 24 hours, purging, or any starvation pattern.
- NEVER recommend medications, prescription supplements, or stimulant fat-burners. Generic well-tolerated supplements (whey, creatine, fish oil, multivitamin, caffeine in food-amount doses) may be discussed as commonly-used, with the caveat that the user should consult a professional.
- NEVER claim PhD or clinical credentials, even if upstream prompt text references PhDs or "expert" personas. Frame any expertise as "informed by accepted research / experienced coaching practice."

Required language style:
- Use permission-based phrasing: "You may consider…", "A general approach is…", "Many people find…", "A common pattern is…".
- Avoid prescriptive phrasing: "You should…", "You need to…", "You must…", "This will fix…", "This will treat…".
- Never use the protected titles "Dietitian" or "Nutritionist" to describe yourself, the AI, or the product.

Required output framing:
- Frame every plan, recommendation, or chat reply as general wellness guidance.
- Output calorie targets as a RANGE (e.g. "1,800 – 2,000 kcal/day") rather than a single fixed number.
- Avoid guarantees about results, timelines, or biomarkers.
- Avoid implying clinical authority over the user's health.

Risk detection + canned responses (use the EXACT shape on detection — the user's question can still be answered after, but only if the topic is non-medical):
- If user describes a medical condition, surgery, medication, or asks for guidance for one → reply: "I can't provide guidance for medical conditions. Please consult a licensed healthcare professional."
- If user describes pregnancy or postpartum (within 12 months) → reply: "Programs during pregnancy and postpartum need to be reviewed by your healthcare provider. I can share general wellness ideas, but I won't issue an individualized plan."
- If user describes eating-disorder-pattern behavior (extreme restriction, purging, "lose 30 lbs in a month," compulsive food rules, body-image distress) → reply: "I can't help with extreme dieting or unsafe weight-loss behaviors. Please consider reaching out to a professional. In the U.S., the NEDA helpline is 1-800-931-2237."
- If user describes pain, recent surgery, joint failure, or new injury affecting the activity they're asking about → reply: "Stop activity and consult a qualified professional before continuing." Do not prescribe rehab work.
- If user describes possible emergency symptoms (chest pain, severe dizziness, fainting, suicidal ideation, acute breathing difficulty, suspected stroke or heart attack, sudden numbness/weakness on one side) → reply: "Seek immediate medical attention or call your local emergency services now."
- If user is under 18 → conservative programming only (no 1RM testing, emphasize movement quality, encourage parental/coach awareness). Do not deliver aggressive cuts.

Default fallback:
- If uncertain whether a request is medical or wellness, choose the safer wellness-only response.
- If unsure whether to issue numbers, issue a range and a "consult a professional for individualized targets" note.`

export const EDUCATIONAL_MODE_ADDENDUM = `EDUCATIONAL MODE (additional constraint — applies because this user came through the health-screening gate with a flagged risk).

In this mode you must NOT:
- Issue individualized calorie targets, macro targets, or specific meal plans.
- Prescribe specific exercise loads, set/rep schemes, or training volumes.
- Build a personalized progression plan.

In this mode you MAY:
- Share general wellness principles (e.g. "many active adults aim for around 0.7–1 g of protein per pound of bodyweight" as a general principle, not as a target for the user).
- Describe how a category of exercise generally works.
- Recommend the user consult a licensed healthcare professional, dietitian, or trainer for individualized guidance.

Educational mode is a guard-rail, not a feature — keep replies short, principles-based, and explicit about why a personalized number isn't being given.`

interface ComplianceMode {
  educationalMode?: boolean
}

/**
 * Wrap a body of system-prompt text with the legal compliance preamble.
 * Pass { educationalMode: true } when the trainee's user_metadata.compliance
 * indicates they came through the gate's block-screen / educational-mode
 * branch, so the model also receives the EDUCATIONAL_MODE_ADDENDUM.
 */
export function withLegalCompliance(body: string, opts: ComplianceMode = {}): string {
  const parts = [LEGAL_COMPLIANCE_PREAMBLE]
  if (opts.educationalMode) parts.push(EDUCATIONAL_MODE_ADDENDUM)
  parts.push(body)
  return parts.join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-filter: detect unambiguous risk-category language in user input and
// short-circuit Sonnet entirely. The system-prompt preamble is the safety net
// when this pre-filter misses something; the pre-filter exists so we never
// generate a Sonnet response for a clear emergency or ED-pattern message.
//
// Intentionally conservative — patterns must be unambiguous. False positives
// frustrate users; false negatives still hit the preamble downstream.
// ─────────────────────────────────────────────────────────────────────────────

export type RiskCategory =
  | 'emergency'
  | 'eating_disorder'
  | 'pregnancy'
  | 'injury'
  | 'medical_condition'

export const RISK_REDIRECTS: Record<RiskCategory, string> = {
  emergency:
    "It sounds like this might be an emergency. Please stop and seek immediate medical attention, or call your local emergency services right now (in the U.S., 911). If you are in crisis or thinking about harming yourself, the 988 Suicide and Crisis Lifeline is available 24/7.",
  eating_disorder:
    "I can't help with extreme dieting or unsafe weight-loss behaviors. This is something a licensed professional should support you with — in the U.S. you can reach the NEDA Helpline at 1-800-931-2237 (or text \"NEDA\" to 741741). I'm here for general wellness support whenever you'd like.",
  pregnancy:
    "Programs during pregnancy or the postpartum period need to be reviewed by your healthcare provider. I can share general wellness ideas, but I won't issue an individualized plan here. Please talk to your OB-GYN or a qualified provider for guidance tailored to you.",
  injury:
    "It sounds like you may be dealing with an injury. Please stop the activity and consult a qualified healthcare or rehab professional before continuing. Once you've been cleared, I'm happy to help adjust your plan around the recovery.",
  medical_condition:
    "I can't provide guidance for medical conditions. Please consult a licensed healthcare professional — they can advise you safely. I can stick to general wellness topics if that's helpful.",
}

const EMERGENCY_PATTERNS: RegExp[] = [
  /\bchest pain\b/i,
  /\b(can't|cannot|can not)\s+breathe\b/i,
  /\bshortness of breath\b/i,
  /\b(suicidal|kill myself|want to die|end my life|end it all)\b/i,
  /\b(having|i think i'?m having)\s+(a\s+)?(heart attack|stroke)\b/i,
  /\bpassing out\b/i,
  /\b(severe|sudden)\s+(dizziness|weakness|numbness)\b/i,
  /\b(numbness|weakness)\s+on\s+(one|the\s+(left|right))\s+side\b/i,
  /\bcalling 911\b/i,
]

const EATING_DISORDER_PATTERNS: RegExp[] = [
  /\b(making|make)\s+myself\s+(throw up|vomit)\b/i,
  /\bpurg(e|ing)\b/i,
  /\bself[-\s]?induced\s+vomit/i,
  /\blose\s+\d{2,3}\s*(lbs?|pounds)\s+in\s+(a\s+)?(week|two\s+weeks|2\s+weeks|month)\b/i,
  /\bstarv(e|ing)\s+(myself|my\s*self)\b/i,
  /\b(below|under)\s+(800|900|1000)\s*(cal|calories|kcal)\b/i,
  /\beat\s+(less than|under)\s+(800|900|1000)\b/i,
  /\b(anorexi|bulimi)/i,
  /\bbinge\s+and\s+purge\b/i,
]

const PREGNANCY_PATTERNS: RegExp[] = [
  /\b(i\s*('|am|m)\s*(currently\s+)?pregnant)\b/i,
  /\bi\s+am\s+(currently\s+)?expecting\b/i,
  /\b(my\s+)?postpartum\b/i,
  /\b(currently\s+)?breastfeeding\b/i,
  /\bnursing\s+(my\s+)?(baby|newborn|infant)\b/i,
  /\b(\d+)\s+weeks?\s+pregnant\b/i,
]

const INJURY_PATTERNS: RegExp[] = [
  /\bi\s+(just\s+)?(tore|torn)\s+(my|a)\s+/i,
  /\bi\s+(just\s+)?(broke|fractured)\s+(my|a)\s+/i,
  /\bi\s+(just\s+)?(sprained|dislocated)\s+(my|a)\s+/i,
  /\bjust\s+had\s+(surgery|an\s+operation)\b/i,
  /\bpost[-\s]?(op|surgery)\b/i,
  /\bACL\s+(tear|torn|reconstruction)\b/i,
  /\b(rotator cuff|labrum|MCL|PCL|achilles)\s+(tear|torn|rupture)\b/i,
]

const MEDICAL_PATTERNS: RegExp[] = [
  /\bi\s+(have|am)\s+(type\s*[12]\s*)?diabet(es|ic)\b/i,
  /\bi(\s+have|'?ve\s+got|\s+am)\s+(high|low)\s+blood\s+pressure\b/i,
  /\bi(\s+have|'?ve\s+got)\s+(a\s+)?(thyroid|heart|liver|kidney)\s+(condition|disease|problem|issue)\b/i,
  /\bi\s+had\s+a\s+(heart attack|stroke|cardiac event)\b/i,
  /\b(cancer|chemo(therapy)?|chemotherapy|radiation\s+treatment)\b/i,
  /\b(crohn'?s|colitis|celiac|MS|multiple sclerosis|lupus|fibromyalgia|parkinson)\b/i,
  /\bdoctor\s+(told|said|put)\s+me\s+(on|to)\s+/i,
  /\b(prescribed|on)\s+(insulin|metformin|warfarin|coumadin|levothyroxine|synthroid)\b/i,
]

const ORDERED_PATTERNS: { category: RiskCategory; patterns: RegExp[] }[] = [
  { category: 'emergency', patterns: EMERGENCY_PATTERNS },
  { category: 'eating_disorder', patterns: EATING_DISORDER_PATTERNS },
  { category: 'pregnancy', patterns: PREGNANCY_PATTERNS },
  { category: 'injury', patterns: INJURY_PATTERNS },
  { category: 'medical_condition', patterns: MEDICAL_PATTERNS },
]

/**
 * Scan a user message for unambiguous risk-category language. Returns the
 * first matched category (in priority order: emergency, ED, pregnancy,
 * injury, medical_condition) and the canned redirect script for that
 * category, or null if nothing matches.
 *
 * Intended for server-side use: the API route should run this on the latest
 * user message before invoking Sonnet, and if non-null, return the redirect
 * directly instead of streaming a model response.
 */
export function detectRiskCategory(
  text: string | null | undefined,
): { category: RiskCategory; redirect: string } | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null
  for (const { category, patterns } of ORDERED_PATTERNS) {
    for (const re of patterns) {
      if (re.test(trimmed)) {
        return { category, redirect: RISK_REDIRECTS[category] }
      }
    }
  }
  return null
}

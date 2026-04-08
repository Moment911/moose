// ── Business Discovery Question Bank ─────────────────────────────────────────
// Structured question banks with emotional intelligence metadata
// for AI voice agents to use during prospect calls.

export const DISCOVERY_QUESTION_BANKS = {
  universal_rapport: [
    {
      question: 'How long have you been in business?',
      purpose: 'Build rapport, understand experience level',
      follow_up: 'What was the biggest challenge when you first started?',
      emotional_effect: 'pride_and_nostalgia',
      trust_building: true,
    },
    {
      question: 'What made you start this business?',
      purpose: "Understand their 'why', builds deep rapport",
      follow_up: 'Is the business what you imagined it would be?',
      emotional_effect: 'connection_and_vulnerability',
      trust_building: true,
    },
    {
      question: 'What are you most proud of in your business?',
      purpose: 'Gets them talking positively, relaxes them',
      follow_up: "That's impressive — how did you make that happen?",
      emotional_effect: 'pride_and_confidence',
      trust_building: true,
    },
    {
      question: 'What does a great month look like for you?',
      purpose: 'Understand their definition of success',
      follow_up: 'How often do you have months like that?',
      emotional_effect: 'aspiration',
      trust_building: false,
    },
    {
      question: 'If you could change one thing about how your business runs right now, what would it be?',
      purpose: 'Opens pain discovery naturally',
      follow_up: 'How long has that been an issue?',
      emotional_effect: 'reflection',
      trust_building: false,
    },
  ],

  universal_goals: [
    {
      question: 'Where do you see the business in 2-3 years?',
      purpose: 'Understand growth ambition and goals',
      follow_up: "What's the biggest obstacle standing between you and that?",
      emotional_effect: 'aspiration_and_motivation',
      trust_building: false,
    },
    {
      question: 'If you hit all your goals this year, what would that mean for you personally?',
      purpose: 'Connect business goals to personal motivation',
      follow_up: 'What would you do with that extra revenue?',
      emotional_effect: 'deep_motivation',
      trust_building: false,
    },
    {
      question: "What's your biggest growth priority right now — more customers, bigger customers, or keeping the ones you have?",
      purpose: 'Qualify which type of help they need',
      follow_up: 'Why that one over the others?',
      emotional_effect: 'clarity',
      trust_building: false,
    },
  ],

  universal_marketing: [
    {
      question: 'How are most of your customers finding you right now?',
      purpose: 'Identify current marketing dependency',
      follow_up: 'How consistent is that as a source?',
      emotional_effect: 'reflection',
      trust_building: false,
    },
    {
      question: "Have you tried any marketing in the past that didn't work? What happened?",
      purpose: 'Uncover past failures and objections',
      follow_up: 'What do you think went wrong?',
      emotional_effect: 'vulnerability_and_openness',
      trust_building: true,
    },
    {
      question: 'If I told you the average business in your industry spends $X/month on marketing and gets Y leads — how does that compare to what you\'re doing?',
      purpose: 'Use benchmark data to create urgency',
      follow_up: 'Does that surprise you?',
      emotional_effect: 'comparison_and_urgency',
      trust_building: false,
      requires_benchmark: true,
    },
    {
      question: 'Are you currently doing anything for your Google rankings or local SEO?',
      purpose: 'Open SEO conversation - most SMBs know they need it but aren\'t doing it right',
      follow_up: 'How are you showing up when someone searches for your service in your city?',
      emotional_effect: 'awareness_of_gap',
      trust_building: false,
    },
    {
      question: 'How are you currently handling your online reviews?',
      purpose: 'Opens reputation management conversation',
      follow_up: 'Do you have a system for asking customers to leave reviews?',
      emotional_effect: 'reflection',
      trust_building: false,
    },
    {
      question: 'Are you running any paid ads right now — Google, Facebook, anything like that?',
      purpose: 'Identify paid media opportunity or frustration',
      follow_up: 'And are you happy with the results you\'re getting from them?',
      emotional_effect: 'reflection',
      trust_building: false,
    },
    {
      question: 'When someone finds you online, what happens? Do they go to your website?',
      purpose: 'Uncover website and conversion issues',
      follow_up: 'And are those people actually turning into customers?',
      emotional_effect: 'reflection',
      trust_building: false,
    },
    {
      question: 'Are you tracking where your leads are actually coming from?',
      purpose: 'Open analytics and attribution conversation',
      follow_up: 'So you know which marketing is working and which isn\'t?',
      emotional_effect: 'awareness_of_gap',
      trust_building: false,
    },
  ],

  plumbing_hvac: [
    'How many service calls are you handling per week right now?',
    'What percentage of your calls are emergencies vs scheduled?',
    'How are you showing up on Google Maps when someone searches for a plumber near them?',
    'Are you running Google Local Service Ads?',
    'Do you have a system for getting reviews after each job?',
    "What's your average ticket size on a service call?",
  ],

  medical_dental: [
    "What's your new patient acquisition like right now?",
    "What's your current patient retention rate?",
    'How are you handling appointment reminders and no-shows?',
    'How are you showing up when someone searches for a dentist or doctor in your area?',
    'Do you have a system for collecting patient reviews after visits?',
  ],

  contractor_roofing: [
    'How many estimates are you running per week?',
    "What's your close rate on estimates?",
    'When someone in your area needs a roofer, are they finding you on Google?',
    'Are you running any Google Ads or Local Service Ads?',
    'Do you have a system for getting reviews from completed jobs?',
  ],

  marketing_agency: [
    "What's your current client count and monthly recurring revenue?",
    "What's your average client retention — how long do they typically stay?",
    "What's your biggest bottleneck right now — getting clients or delivering results?",
    'How are you currently generating leads for your own agency?',
    'What would you need to double your revenue without doubling your team?',
  ],
} as const

type QuestionBank = typeof DISCOVERY_QUESTION_BANKS

export function getDiscoveryQuestions(
  sicCode: string,
  callPhase: 'opening' | 'rapport' | 'discovery' | 'qualification',
  emotionalProfile: { detected_emotion?: string } | null,
  alreadyAsked: string[] = []
): Array<{ question: string; purpose: string; emotional_effect: string }> {
  const questions: Array<{ question: string; purpose: string; emotional_effect: string }> = []

  if (callPhase === 'rapport') {
    questions.push(
      ...DISCOVERY_QUESTION_BANKS.universal_rapport
        .filter(q => !alreadyAsked.includes(q.question))
        .slice(0, 2)
        .map(q => ({ question: q.question, purpose: q.purpose, emotional_effect: q.emotional_effect }))
    )
  }

  if (callPhase === 'discovery' || callPhase === 'qualification') {
    questions.push(
      ...DISCOVERY_QUESTION_BANKS.universal_goals
        .filter(q => !alreadyAsked.includes(q.question))
        .slice(0, 2)
        .map(q => ({ question: q.question, purpose: q.purpose, emotional_effect: q.emotional_effect }))
    )
    questions.push(
      ...DISCOVERY_QUESTION_BANKS.universal_marketing
        .filter(q => !alreadyAsked.includes(q.question))
        .slice(0, 2)
        .map(q => ({ question: q.question, purpose: q.purpose, emotional_effect: q.emotional_effect }))
    )
  }

  const industryMap: Record<string, keyof QuestionBank> = {
    '1711': 'plumbing_hvac',
    '1731': 'plumbing_hvac',
    '8011': 'medical_dental',
    '8021': 'medical_dental',
    '8049': 'medical_dental',
    '1521': 'contractor_roofing',
    '1761': 'contractor_roofing',
    '7389': 'marketing_agency',
    '8742': 'marketing_agency',
  }

  const industryKey = industryMap[sicCode]
  if (industryKey && DISCOVERY_QUESTION_BANKS[industryKey]) {
    const bank = DISCOVERY_QUESTION_BANKS[industryKey] as readonly string[]
    const industryQs = bank
      .filter(q => !alreadyAsked.includes(q))
      .slice(0, 3)
      .map(q => ({ question: q, purpose: 'Industry-specific discovery', emotional_effect: 'reflection' }))
    questions.push(...industryQs)
  }

  if (emotionalProfile?.detected_emotion === 'guarded' || emotionalProfile?.detected_emotion === 'skeptical') {
    return questions.filter(q => q.emotional_effect?.includes('trust') || q.emotional_effect?.includes('pride'))
  }

  return questions.slice(0, 5)
}

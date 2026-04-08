// ── Q&A Import Template ──────────────────────────────────────────────────────

export const QA_IMPORT_TEMPLATE_HEADERS = [
  'question_text',
  'question_type',
  'industry_sic_code',
  'industry_name',
  'answer_text',
  'answer_type',
  'notes',
  'source',
  'effectiveness_score',
] as const

export const QA_IMPORT_FIELD_DESCRIPTIONS: Record<string, string> = {
  question_text: 'REQUIRED. The exact question asked. Can be agent question or prospect question. Max 500 chars.',
  question_type: 'REQUIRED. One of: discovery | objection | closing | price | timing | competitor | clarification | rapport | situational',
  industry_sic_code: 'REQUIRED. 4-digit SIC code (e.g. 1711 for Plumbing, 7389 for Marketing). Use "ALL" for universal questions.',
  industry_name: 'REQUIRED. Human readable industry name (e.g. Plumbing, Dental, Marketing Services)',
  answer_text: 'REQUIRED. The best known answer or response to this question. Max 1000 chars.',
  answer_type: 'REQUIRED. One of: acceptance | objection | deflection | question | interest | commitment | neutral',
  notes: 'OPTIONAL. Context about when to use this Q&A pair, special instructions, source of data.',
  source: 'OPTIONAL. Where this came from: expert | training | real_call | research | competitor_analysis',
  effectiveness_score: 'OPTIONAL. Your estimated effectiveness 0-100. Leave blank to let system calculate from call data.',
}

export const QA_TYPE_OPTIONS = {
  question_types: ['discovery', 'objection', 'closing', 'price', 'timing', 'competitor', 'clarification', 'rapport', 'situational'],
  answer_types: ['acceptance', 'objection', 'deflection', 'question', 'interest', 'commitment', 'neutral'],
  sources: ['expert', 'training', 'real_call', 'research', 'competitor_analysis', 'synthetic'],
}

export const QA_TEMPLATE_SAMPLE_ROWS = [
  {
    question_text: 'How are you currently getting most of your new customers?',
    question_type: 'discovery',
    industry_sic_code: 'ALL',
    industry_name: 'Universal',
    answer_text: "Mostly word of mouth and some Google here and there, but it's been inconsistent lately",
    answer_type: 'interest',
    notes: 'Best asked early in discovery phase. Opens lead source conversation.',
    source: 'expert',
    effectiveness_score: 75,
  },
  {
    question_text: 'We already work with a marketing company',
    question_type: 'objection',
    industry_sic_code: 'ALL',
    industry_name: 'Universal',
    answer_text: "That's great — are you completely satisfied with the results, or is there still some room for improvement?",
    answer_type: 'objection',
    notes: 'Classic objection. Never argue. Find the gap in their current relationship.',
    source: 'expert',
    effectiveness_score: 82,
  },
  {
    question_text: 'How are you showing up on Google Maps when someone searches for a plumber near them?',
    question_type: 'discovery',
    industry_sic_code: '1711',
    industry_name: 'Plumbing',
    answer_text: "Honestly not great, I think we're on page 2 or something. I've been meaning to fix that.",
    answer_type: 'interest',
    notes: 'Industry specific - opens Local SEO conversation for trades.',
    source: 'expert',
    effectiveness_score: 78,
  },
  {
    question_text: 'How much does it cost?',
    question_type: 'price',
    industry_sic_code: 'ALL',
    industry_name: 'Universal',
    answer_text: "That's a fair question — and honestly it depends completely on what you actually need. The 20 minutes with our team is to figure that out, and then you'll know exactly what it would look like. Sound fair?",
    answer_type: 'question',
    notes: 'Never give price on cold call. Bridge to the meeting instead.',
    source: 'expert',
    effectiveness_score: 88,
  },
  {
    question_text: 'Are you tracking where your leads are actually coming from?',
    question_type: 'discovery',
    industry_sic_code: 'ALL',
    industry_name: 'Universal',
    answer_text: "Not really, I mean I kind of know but it's not super scientific",
    answer_type: 'interest',
    notes: 'Opens analytics conversation. Most SMBs do not track properly.',
    source: 'expert',
    effectiveness_score: 71,
  },
]

export function generateQATemplateCSV(): string {
  const headers = QA_IMPORT_TEMPLATE_HEADERS.join(',')

  const instructions = QA_IMPORT_TEMPLATE_HEADERS.map(h =>
    `"${QA_IMPORT_FIELD_DESCRIPTIONS[h] || ''}"`
  ).join(',')

  const sampleRows = QA_TEMPLATE_SAMPLE_ROWS.map(row =>
    QA_IMPORT_TEMPLATE_HEADERS.map(h => {
      const val = row[h as keyof typeof row] || ''
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\n')

  return `${headers}\n${instructions}\n${sampleRows}`
}

// ── Expert Q&A seed data (30 pairs) ─────────────────────────────────────────

export const EXPERT_QA_SEED_DATA = [
  // ── 10 Universal Discovery Questions ──
  { question_text: 'How are you currently getting most of your new customers?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Mostly word of mouth and some Google, but it's been inconsistent lately.", answer_type: 'interest', notes: 'Opens lead source conversation. Ask early.', source: 'expert', effectiveness_score: 78 },
  { question_text: 'What does a great month look like for your business?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "A great month is probably 40-50 new leads coming in and closing about half of them.", answer_type: 'interest', notes: 'Reveals their definition of success. Anchor all future proposals to this.', source: 'expert', effectiveness_score: 74 },
  { question_text: 'How long have you been in business?', question_type: 'rapport', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Going on 12 years now. Started in my garage if you can believe it.", answer_type: 'acceptance', notes: 'Rapport builder. Follow up: What made you start?', source: 'expert', effectiveness_score: 70 },
  { question_text: 'What are you most proud of in your business?', question_type: 'rapport', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "My team, honestly. Took me years to find the right people but now we've got a solid crew.", answer_type: 'acceptance', notes: 'Gets them talking positively. Relaxes skeptical prospects.', source: 'expert', effectiveness_score: 72 },
  { question_text: 'If you could change one thing about how your business runs, what would it be?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Honestly, I wish I had a more predictable pipeline. Some months are feast, others famine.", answer_type: 'interest', notes: 'Natural pain discovery opener.', source: 'expert', effectiveness_score: 80 },
  { question_text: 'Where do you see the business in 2-3 years?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "I want to double revenue without working twice as hard. Maybe add another location.", answer_type: 'interest', notes: 'Reveals growth ambition. Tie back to this in close.', source: 'expert', effectiveness_score: 76 },
  { question_text: 'Are you currently doing anything for your Google rankings or local SEO?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Not really, we had someone do it a while back but I don't think it's being maintained.", answer_type: 'interest', notes: 'Opens SEO conversation. Most SMBs have abandoned SEO.', source: 'expert', effectiveness_score: 79 },
  { question_text: 'How are you currently handling your online reviews?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "We ask sometimes but it's hit or miss. We've got about 40 reviews on Google.", answer_type: 'interest', notes: 'Opens reputation management conversation.', source: 'expert', effectiveness_score: 75 },
  { question_text: 'Are you running any paid ads right now — Google, Facebook, anything?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "We've tried Facebook ads before but I'm not sure if they actually worked. The numbers were confusing.", answer_type: 'interest', notes: 'Opens paid media + analytics conversation.', source: 'expert', effectiveness_score: 77 },
  { question_text: 'Are you tracking where your leads are actually coming from?', question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Honestly no. I kind of just know in my head but nothing formal.", answer_type: 'interest', notes: 'Opens analytics and attribution gap.', source: 'expert', effectiveness_score: 81 },

  // ── 8 Universal Objection Responses ──
  { question_text: "I'm not interested", question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Totally fair — can I ask, is it that you don't have a need for marketing right now, or is it more about the timing?", answer_type: 'objection', notes: 'Pause 2 seconds before responding. Shows confidence.', source: 'expert', effectiveness_score: 72 },
  { question_text: 'We already have a marketing agency', question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "That's great — how's it going? Are you getting the results you expected? Our strategist can do a quick audit to see if there are any gaps — no obligation.", answer_type: 'objection', notes: 'Never badmouth competitor. Find the gap.', source: 'expert', effectiveness_score: 82 },
  { question_text: 'How much does it cost?', question_type: 'price', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Totally fair question — it depends on what you need. The 15 minutes with our strategist is specifically to figure that out so you get an exact number, not a range. What day works better — Tuesday or Thursday?", answer_type: 'question', notes: 'Never give price on cold call. Bridge to meeting.', source: 'expert', effectiveness_score: 88 },
  { question_text: "Just send me an email", question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "I could, but honestly our emails never do it justice — they're generic. The 15 minutes with our team is way more valuable. I'll send a quick confirmation with their background so you know who you're talking to. What's your email?", answer_type: 'objection', notes: 'Reframe email as inferior. Get email anyway.', source: 'expert', effectiveness_score: 79 },
  { question_text: "I don't make these decisions alone", question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Completely fine — who else would be part of this conversation? Could we get them on the call too? It's only 15 minutes and it would save everyone time.", answer_type: 'objection', notes: 'Include the decision maker, don\'t let it become a brush-off.', source: 'expert', effectiveness_score: 75 },
  { question_text: "I've been burned by agencies before", question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "I completely hear you — and honestly, that's exactly why our strategist does a free audit first. They'll tell you honestly whether they can help or not. No contract, no commitment. If they can't help, they'll tell you that too.", answer_type: 'objection', notes: 'Acknowledge, empathize, lower risk.', source: 'expert', effectiveness_score: 84 },
  { question_text: "Now is not a good time", question_type: 'timing', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "I totally get it — when would be better? I can have our team reach out next Tuesday or Thursday, whatever works best for you.", answer_type: 'objection', notes: 'Don\'t accept vague timing. Get specific callback date.', source: 'expert', effectiveness_score: 73 },
  { question_text: "What exactly are you selling?", question_type: 'objection', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Honestly, I'm not selling anything on this call — I'm qualifying. Our strategist works with a limited number of businesses and I want to make sure your situation is actually a fit before I put you in front of them.", answer_type: 'objection', notes: 'Reframe from selling to qualifying. Creates scarcity.', source: 'expert', effectiveness_score: 86 },

  // ── 5 Momenta-Specific Capability Questions ──
  { question_text: "What makes you different from other agencies?", question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Most agencies push one channel. We apply SEO plus paid plus content plus AI all working together so they compound — that's our whole philosophy. Our clients see an average 340% increase in leads because of that compounding effect.", answer_type: 'interest', notes: 'Core Momenta differentiator: compounding multi-channel approach.', source: 'expert', effectiveness_score: 85 },
  { question_text: "How fast can you get started?", question_type: 'timing', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "We can typically get campaigns live within 48 hours of kicking off. That's one of the things our clients love — we move fast.", answer_type: 'commitment', notes: 'Use 48-hour stat. Speed is a differentiator.', source: 'expert', effectiveness_score: 80 },
  { question_text: "Do you work with businesses my size?", question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Absolutely — we've accelerated over 500 small and mid-sized businesses. That's our sweet spot. We're not a one-size-fits-all agency, everything is custom-scoped to what you actually need.", answer_type: 'acceptance', notes: 'Use 500+ SMBs stat. Reassure they\'re the right fit.', source: 'expert', effectiveness_score: 78 },
  { question_text: "What kind of results do your clients see?", question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "Our average client sees a 340% increase in leads and 2x revenue growth. And we typically lower their cost per acquisition by 68%. But the 15 minutes with our strategist is to figure out what's realistic for your specific situation.", answer_type: 'interest', notes: 'Lead with stats, bridge to meeting for specifics.', source: 'expert', effectiveness_score: 87 },
  { question_text: "Can you handle everything or just one thing?", question_type: 'discovery', industry_sic_code: 'ALL', industry_name: 'Universal', answer_text: "We do everything from SEO and Google Ads to social media, website development, reputation management, even AI-powered lead follow-up. But we'd only recommend the 2-3 things that would make the biggest impact for you specifically.", answer_type: 'interest', notes: 'Show breadth but promise focus. Don\'t overwhelm.', source: 'expert', effectiveness_score: 83 },

  // ── 7 Industry-Specific Questions ──
  { question_text: 'How many service calls are you handling per week right now?', question_type: 'discovery', industry_sic_code: '1711', industry_name: 'Plumbing', answer_text: "About 20-25 on a good week but it really drops off in slow months.", answer_type: 'interest', notes: 'Plumbing specific. Reveals capacity and seasonality pain.', source: 'expert', effectiveness_score: 76 },
  { question_text: 'Do you have a system for getting reviews after each job?', question_type: 'discovery', industry_sic_code: '1711', industry_name: 'Plumbing', answer_text: "Not really, sometimes the guys ask but it's not consistent. We only have like 30 reviews.", answer_type: 'interest', notes: 'Opens reputation management for trades. Bridge to automated reviews.', source: 'expert', effectiveness_score: 77 },
  { question_text: "What's your new patient acquisition like right now?", question_type: 'discovery', industry_sic_code: '8021', industry_name: 'Dental', answer_text: "We're getting maybe 10-15 new patients a month but I'd like to see 30-40.", answer_type: 'interest', notes: 'Dental specific. Quantifies the gap immediately.', source: 'expert', effectiveness_score: 79 },
  { question_text: 'How are you showing up when someone searches for a dentist in your area?', question_type: 'discovery', industry_sic_code: '8021', industry_name: 'Dental', answer_text: "I think we show up somewhere but definitely not at the top. I know our competitors are above us.", answer_type: 'interest', notes: 'Opens Local SEO conversation for dental.', source: 'expert', effectiveness_score: 78 },
  { question_text: "What's your close rate on estimates?", question_type: 'discovery', industry_sic_code: '1521', industry_name: 'General Contractor', answer_text: "Probably around 30% which feels low. We run a lot of estimates that don't go anywhere.", answer_type: 'interest', notes: 'Contractor specific. Opens conversion optimization conversation.', source: 'expert', effectiveness_score: 80 },
  { question_text: 'Are you running Google Local Service Ads?', question_type: 'discovery', industry_sic_code: '1521', industry_name: 'General Contractor', answer_text: "No, I've heard about them but never set them up. Is that the one with the green checkmark?", answer_type: 'interest', notes: 'Contractor specific. Opens paid media conversation.', source: 'expert', effectiveness_score: 76 },
  { question_text: 'When someone in your area needs a roofer, are they finding you on Google?', question_type: 'discovery', industry_sic_code: '1761', industry_name: 'Roofing', answer_text: "Probably not as much as I'd like. Most of our work comes from referrals and storm chasing honestly.", answer_type: 'interest', notes: 'Roofing specific. Opens digital marketing conversation.', source: 'expert', effectiveness_score: 77 },
]

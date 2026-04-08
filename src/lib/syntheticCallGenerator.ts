// ── Synthetic Call Data Generator ─────────────────────────────────────────────
// Uses Claude, OpenAI GPT-4, and Google Gemini to generate realistic
// hypothetical sales calls across industries for AI training.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export interface SyntheticCallConfig {
  industry_sic_code: string
  industry_name: string
  call_outcome: 'appointment_set' | 'not_interested' | 'callback_requested' | 'voicemail' | 'objection_handled'
  prospect_type: 'highly_interested' | 'skeptical' | 'busy' | 'already_has_agency' | 'price_sensitive' | 'curious' | 'frustrated_with_current'
  call_quality: 'excellent' | 'good' | 'average' | 'poor'
  duration_seconds: number
  ai_provider: 'claude' | 'openai' | 'gemini'
}

// ── Real Momenta Marketing Services ──────────────────────────────────────────

const AGENCY_FULL_DESCRIPTION = `
The AI agent represents Momenta Marketing — a full-service marketing agency
for small and mid-sized businesses. Momenta offers 13 complete services:

1. SEARCH & SEO
   - Organic SEO rankings
   - Google Ads management
   - Local SEO and Google Business Profile optimization
   - Answer Engine Optimization (AEO) for AI search
   - Keyword research and content strategy
   - Technical SEO audits

2. PAID MEDIA & MEDIA BUYING
   - Meta Ads (Facebook/Instagram)
   - Google Ads
   - Programmatic advertising
   - TV & OTT/streaming ads
   - $73M+ in ad spend managed
   - Every dollar tracked to real revenue

3. SOCIAL MARKETING
   - Organic social content creation
   - Paid social campaigns
   - Community management
   - Influencer programs
   - Platform: Instagram, Facebook, TikTok, LinkedIn, YouTube

4. CREATIVE SERVICES
   - Brand identity and logo design
   - Ad creative and copywriting
   - Campaign concepting
   - Video production
   - Design that performs, not just looks good

5. WEBSITE DEVELOPMENT
   - Conversion-optimized websites
   - Landing pages built to generate leads
   - Fast, responsive, measurable
   - eCommerce development

6. MARKETING STRATEGY
   - Go-to-market plans
   - Competitive analysis
   - Channel mix recommendations
   - 90-day growth roadmaps

7. CONTENT MARKETING
   - SEO-driven blog content
   - Pillar pages and topic clusters
   - White papers and guides
   - AEO content for AI visibility
   - Builds authority and drives traffic

8. EMAIL & RETENTION
   - Automated nurture sequences
   - Smart segmentation
   - Win-back campaigns
   - SMS integration
   - Keep customers coming back

9. PR & MEDIA RELATIONS
   - Media outreach and placements
   - Thought leadership articles
   - Press releases
   - Podcast booking and appearances
   - Build real authority in the market

10. REPUTATION MANAGEMENT
    - Automated review generation
    - Response management
    - Google and Yelp rating growth
    - Your reputation on autopilot

11. VIDEO MARKETING
    - Brand films and commercials
    - Short-form social video
    - YouTube strategy
    - Performance video ads

12. AI SOLUTIONS & CRM
    - AI lead response and follow-up
    - Automated nurture sequences
    - Unified inbox management
    - Predictive lead scoring
    - Full CRM integration
    - Your sales engine, automated

13. ANALYTICS & REPORTING
    - GA4 setup and configuration
    - Attribution modeling
    - Custom performance dashboards
    - Monthly strategy reviews
    - Data that tells you what to do next

MOMENTA'S CORE PHILOSOPHY:
"Mass x Velocity = Momenta" — applying multiple marketing forces simultaneously
so they compound. Not just one push, but all forces working together.

KEY STATS TO USE IN CALLS:
- 340% average lead increase for clients
- 2x average revenue multiplier
- 68% lower cost per acquisition
- 4.8 star average client satisfaction
- 500+ SMBs accelerated
- 48-hour average campaign launch time

PRICING CONTEXT:
- Typical client engagement: $1,500 - $8,000/month
- Always custom-scoped to client needs
- Never one-size-fits-all

THE UNIQUE ANGLE:
Most agencies give your brand a single push. Momenta applies multiple forces
simultaneously. SEO + Paid + Brand + Content + AI all working together.
Each one building on the others. That's the compounding effect.
`

// ── AI Provider Generators ───────────────────────────────────────────────────

async function generateWithClaude(config: SyntheticCallConfig, businessContext: any): Promise<string> {
  const prompt = buildSyntheticCallPrompt(config, businessContext)
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

async function generateWithOpenAI(config: SyntheticCallConfig, businessContext: any): Promise<string> {
  const prompt = buildSyntheticCallPrompt(config, businessContext)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return generateWithClaude(config, businessContext) // fallback

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at generating realistic sales call transcripts for AI training purposes. Generate authentic, natural-sounding conversations.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function generateWithGemini(config: SyntheticCallConfig, businessContext: any): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) return generateWithClaude(config, businessContext) // fallback

  const prompt = buildSyntheticCallPrompt(config, businessContext)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 3000, temperature: 0.9 },
      }),
    }
  )

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Prompt Builder ───────────────────────────────────────────────────────────

function buildSyntheticCallPrompt(config: SyntheticCallConfig, business: any): string {
  const outcomeInstructions: Record<string, string> = {
    appointment_set: 'The call ends with the prospect agreeing to a 20-minute discovery call. They give their email and confirm a specific date/time.',
    not_interested: 'The prospect is not interested. The agent handles it professionally but ultimately the prospect says no.',
    callback_requested: 'The prospect is interested but busy. They ask the agent to call back at a specific time next week.',
    objection_handled: 'The prospect raises 2-3 strong objections. The agent handles them expertly. Call ends positively but no firm commitment.',
    voicemail: 'No one answers. Agent leaves a compelling 20-second voicemail.',
  }

  const prospectInstructions: Record<string, string> = {
    highly_interested: 'The prospect is actively looking for marketing help. They ask good questions and are engaged throughout.',
    skeptical: 'The prospect has been burned by marketing agencies before. They are doubtful and ask hard questions about proof and results.',
    busy: 'The prospect is clearly in the middle of something. Short responses, keeps saying they need to go, but stays on because the agent is compelling.',
    already_has_agency: 'The prospect works with another marketing agency but has some frustrations. The agent finds the gap.',
    price_sensitive: 'The prospect keeps asking about cost. They worry about ROI and whether they can afford it.',
    curious: 'The prospect has heard about AI marketing tools and is genuinely curious how it all works.',
    frustrated_with_current: 'The prospect is very unhappy with their current marketing results. They are venting and the agent channels that into a meeting.',
  }

  const qualityInstructions: Record<string, string> = {
    excellent: 'This is a masterclass call. Perfect pacing, great rapport, compelling discovery questions, flawless objection handling. Use as a gold standard example.',
    good: 'A solid professional call. Good technique but a few moments where the agent could have done better.',
    average: 'A mediocre call. The agent makes some mistakes - talks too much, misses some cues, but recovers.',
    poor: 'A poor performing call. Multiple mistakes - rushing, not listening, using bad phrases. Use as a negative training example.',
  }

  // Service-to-pain mapping for natural conversation
  const serviceMapping = `
SERVICE MATCHING RULES (agent should naturally weave in 2-3 relevant Momenta services):
- If prospect mentions Google rankings/visibility → SEO + AEO + Google Business Profile
- If prospect mentions social media → Organic + Paid Social + Content
- If prospect mentions leads/customers → Google Ads + Lead Gen + AI CRM
- If prospect mentions reviews/reputation → Reputation Management
- If prospect mentions competitors → Competitive Analysis + Strategy
- If prospect mentions website → Website Development + CRO
- If prospect mentions email/follow-up → Email & Retention automation
- If prospect mentions video → Video Marketing
- If prospect mentions PR/credibility → PR & Media Relations
- If prospect mentions data/tracking → Analytics & Reporting

DO NOT pitch all 13 services. Pick the 2-3 most relevant to the prospect's specific pain.
Use real Momenta stats naturally: "Our clients see an average of 340% more leads" or "We typically get campaigns live in 48 hours".
`

  return `Generate a realistic, complete sales call transcript between an AI voice agent calling on behalf of Momenta Marketing and a ${config.industry_name} business owner.

CALL PARAMETERS:
- Industry: ${config.industry_name} (SIC: ${config.industry_sic_code})
- Outcome: ${outcomeInstructions[config.call_outcome]}
- Prospect Type: ${prospectInstructions[config.prospect_type]}
- Call Quality: ${qualityInstructions[config.call_quality]}
- Target Duration: approximately ${config.duration_seconds} seconds of conversation
- Generated by: ${config.ai_provider} for training data diversity

AGENCY CONTEXT:
${AGENCY_FULL_DESCRIPTION}

${serviceMapping}

PROSPECT BUSINESS CONTEXT:
- Industry: ${config.industry_name}
- Typical challenges: ${business.pain_points?.slice(0, 3).join(', ') || 'lead generation, marketing ROI, standing out from competition'}
- Average marketing spend in this industry: $${business.spend_low || 500}-$${business.spend_high || 3000}/month
- Average leads per month: ${business.leads_low || 10}-${business.leads_high || 40}

CALL STRUCTURE:
1. Pattern interrupt opening (agent introduces themselves from Momenta Marketing)
2. Prospect initial reaction (based on prospect type)
3. Permission to ask questions
4. Business discovery - ask about the business (how long, what they're proud of, what a great month looks like)
5. Prospect opens up naturally
6. Pain discovery questions
7. Benchmark comparison using real Momenta stats
8. Value proposition tied to their specific pain (2-3 relevant services only)
9. Objection handling if needed
10. Meeting ask
11. Outcome based on call_outcome parameter

FORMAT THE TRANSCRIPT EXACTLY LIKE THIS:
Agent: [what agent says]
Prospect: [what prospect says]
Agent: [what agent says]
Prospect: [what prospect says]
...continue for full call...

IMPORTANT RULES:
- Make it sound COMPLETELY NATURAL and HUMAN
- Include natural speech patterns: "um", "yeah", "I mean", "look", "here's the thing"
- The prospect should have a realistic business name, owner name, and city
- Include specific numbers when relevant (years in business, lead counts, revenue)
- The agent should adapt to whatever the prospect says - not follow a rigid script
- Include genuine emotional moments
- Make each call UNIQUE - different vocabulary, different personalities, different situations
- If poor quality call: include specific mistakes so they can be learned from
- Add a JSON metadata block at the end:

CALL_METADATA:
{
  "prospect_name": "first name",
  "prospect_last_name": "last name",
  "business_name": "business name",
  "city": "city",
  "state": "state abbreviation",
  "appointment_set": true/false,
  "callback_requested": true/false,
  "lead_score": 0-100,
  "call_duration_seconds": number,
  "sentiment": "positive/neutral/negative",
  "main_pain_point": "one sentence",
  "main_objection": "one sentence or null",
  "prospect_emotional_state": "excited/skeptical/busy/friendly/guarded/curious/frustrated/neutral",
  "energy_level": "high/medium/low",
  "key_moments": ["moment 1", "moment 2", "moment 3"],
  "what_worked": "one sentence",
  "what_failed": "one sentence or null",
  "coaching_note": "one sentence of coaching feedback",
  "momenta_services_mentioned": ["service1", "service2"]
}`
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseGeneratedCall(rawText: string, _config: SyntheticCallConfig): {
  transcript: string
  metadata: any
} {
  const metaMatch = rawText.match(/CALL_METADATA:\s*(\{[\s\S]+\})/m)
  let metadata: any = {}

  try {
    if (metaMatch) {
      metadata = JSON.parse(metaMatch[1])
    }
  } catch { /* use defaults */ }

  const transcript = rawText
    .replace(/CALL_METADATA:[\s\S]+/, '')
    .trim()

  return { transcript, metadata }
}

// ── Save to Database ─────────────────────────────────────────────────────────

async function saveSyntheticCall(
  config: SyntheticCallConfig,
  transcript: string,
  metadata: any,
  agencyId: string = '00000000-0000-0000-0000-000000000099'
) {
  const supabase = getSupabase()

  const { data: lead } = await supabase
    .from('koto_voice_leads')
    .insert({
      agency_id: agencyId,
      prospect_name: `${metadata.prospect_name || 'Test'} ${metadata.prospect_last_name || 'Prospect'}`,
      prospect_company: metadata.business_name || `${config.industry_name} Business`,
      prospect_phone: `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
      city: metadata.city || 'Miami',
      state: metadata.state || 'FL',
      industry_sic_code: config.industry_sic_code,
      status: metadata.appointment_set ? 'appointment_set' :
              metadata.callback_requested ? 'callback' : 'not_interested',
      lead_score: metadata.lead_score || 50,
      prospect_pain_point: metadata.main_pain_point,
      prospect_objection: metadata.main_objection,
      intent_level: metadata.lead_score > 70 ? 'high' : metadata.lead_score > 40 ? 'medium' : 'low',
      is_synthetic: true,
    })
    .select('id')
    .single()

  const { data: call } = await supabase
    .from('koto_voice_calls')
    .insert({
      agency_id: agencyId,
      retell_call_id: `synthetic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      transcript,
      sentiment: metadata.sentiment || 'neutral',
      duration_seconds: metadata.call_duration_seconds || config.duration_seconds,
      status: 'completed',
      is_synthetic: true,
      from_number: `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
      to_number: `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
      start_timestamp: new Date().toISOString(),
      end_timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        ai_provider: config.ai_provider,
        call_quality: config.call_quality,
        prospect_type: config.prospect_type,
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  return { lead_id: lead?.id, call_id: call?.id }
}

// ── Main Batch Generator ─────────────────────────────────────────────────────

export async function generateSyntheticCallBatch(
  sicCode: string,
  industryName: string,
  _callsPerProvider: number = 10
): Promise<{ generated: number; saved: number; errors: number }> {
  const supabase = getSupabase()

  const { data: intel } = await supabase
    .from('koto_qa_intelligence')
    .select('industry_sic_code')
    .eq('industry_sic_code', sicCode)
    .limit(1)

  const businessContext = {
    pain_points: ['lead generation', 'marketing ROI', 'standing out from competition'],
    spend_low: 500,
    spend_high: 3000,
    leads_low: 10,
    leads_high: 40,
  }

  const callMatrix: SyntheticCallConfig[] = [
    // Excellent calls
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'highly_interested', call_quality: 'excellent', duration_seconds: 420, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'skeptical', call_quality: 'excellent', duration_seconds: 540, ai_provider: 'openai' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'frustrated_with_current', call_quality: 'excellent', duration_seconds: 480, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'busy', call_quality: 'excellent', duration_seconds: 240, ai_provider: 'gemini' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'already_has_agency', call_quality: 'excellent', duration_seconds: 600, ai_provider: 'openai' },
    // Good calls
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'curious', call_quality: 'good', duration_seconds: 360, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'callback_requested', prospect_type: 'busy', call_quality: 'good', duration_seconds: 180, ai_provider: 'openai' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'objection_handled', prospect_type: 'price_sensitive', call_quality: 'good', duration_seconds: 480, ai_provider: 'gemini' },
    // Average calls
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'callback_requested', prospect_type: 'skeptical', call_quality: 'average', duration_seconds: 300, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'not_interested', prospect_type: 'already_has_agency', call_quality: 'average', duration_seconds: 240, ai_provider: 'openai' },
    // Poor calls (negative training)
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'not_interested', prospect_type: 'busy', call_quality: 'poor', duration_seconds: 120, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'not_interested', prospect_type: 'price_sensitive', call_quality: 'poor', duration_seconds: 180, ai_provider: 'gemini' },
    // Voicemails
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'voicemail', prospect_type: 'highly_interested', call_quality: 'excellent', duration_seconds: 25, ai_provider: 'claude' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'voicemail', prospect_type: 'skeptical', call_quality: 'good', duration_seconds: 22, ai_provider: 'openai' },
    // Special scenarios
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'appointment_set', prospect_type: 'frustrated_with_current', call_quality: 'excellent', duration_seconds: 660, ai_provider: 'gemini' },
    { industry_sic_code: sicCode, industry_name: industryName, call_outcome: 'objection_handled', prospect_type: 'skeptical', call_quality: 'excellent', duration_seconds: 720, ai_provider: 'claude' },
  ]

  let generated = 0
  let saved = 0
  let errors = 0

  for (const callConfig of callMatrix) {
    try {
      let rawText = ''

      if (callConfig.ai_provider === 'claude') {
        rawText = await generateWithClaude(callConfig, businessContext)
      } else if (callConfig.ai_provider === 'openai') {
        rawText = await generateWithOpenAI(callConfig, businessContext)
      } else {
        rawText = await generateWithGemini(callConfig, businessContext)
      }

      if (!rawText || rawText.length < 200) {
        errors++
        continue
      }

      generated++

      const { transcript, metadata } = parseGeneratedCall(rawText, callConfig)
      await saveSyntheticCall(callConfig, transcript, metadata)
      saved++

      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err: any) {
      console.error(`Error generating call:`, err.message)
      errors++
    }
  }

  return { generated, saved, errors }
}

// Generate calls for ALL seeded industries
export async function generateAllIndustrySyntheticData(): Promise<{
  results: Array<{ industry: string; generated: number; saved: number; errors: number }>
}> {
  const industries = [
    { sic: '1711', name: 'Plumbing' },
    { sic: '1731', name: 'Electrical Contractor' },
    { sic: '1521', name: 'General Contractor' },
    { sic: '1761', name: 'Roofing' },
    { sic: '7389', name: 'Marketing Services' },
    { sic: '8011', name: 'Medical Office' },
    { sic: '8021', name: 'Dental' },
    { sic: '8049', name: 'Chiropractic' },
    { sic: '5812', name: 'Restaurant' },
    { sic: '7532', name: 'Auto Body' },
    { sic: '8721', name: 'Accounting' },
    { sic: '6411', name: 'Insurance' },
    { sic: '6159', name: 'Mortgage' },
    { sic: '7231', name: 'Beauty Salon' },
    { sic: '8742', name: 'Management Consulting' },
  ]

  const results = []

  for (const industry of industries) {
    const result = await generateSyntheticCallBatch(industry.sic, industry.name)
    results.push({ industry: industry.name, ...result })
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return { results }
}

// Get synthetic data status
export async function getSyntheticStatus(): Promise<any> {
  const supabase = getSupabase()

  const { data: syntheticCalls } = await supabase
    .from('koto_voice_calls')
    .select('metadata')
    .eq('is_synthetic', true)

  const { data: realCalls } = await supabase
    .from('koto_voice_calls')
    .select('id')
    .or('is_synthetic.eq.false,is_synthetic.is.null')

  const byIndustry: Record<string, { synthetic: number; real: number }> = {}

  for (const c of syntheticCalls || []) {
    const sic = (c.metadata as any)?.industry_sic_code || 'unknown'
    if (!byIndustry[sic]) byIndustry[sic] = { synthetic: 0, real: 0 }
    byIndustry[sic].synthetic++
  }

  return {
    total_synthetic: (syntheticCalls || []).length,
    total_real: (realCalls || []).length,
    by_industry: byIndustry,
  }
}

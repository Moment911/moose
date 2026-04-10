// ────────────────────────────────────────────────────────────
// Adaptive onboarding questions
//
// Each entry is a question that only shows when the business
// classification matches its `show_when` rules. The classification
// is computed by /api/onboarding/classify and stored on the
// clients.business_classification jsonb column.
//
// Field keys here fall through the FIELD_MAP in /api/onboarding/route
// — anything that isn't explicitly mapped to a dedicated clients
// column lands in onboarding_answers.jsonb so we never lose data.
// ────────────────────────────────────────────────────────────

export type BusinessModel    = 'b2b' | 'b2c' | 'both'
export type GeographicScope  = 'local' | 'regional' | 'national' | 'international'
export type BusinessType     = 'service' | 'product' | 'saas' | 'ecommerce' | 'professional_services' | 'healthcare' | 'contractor' | 'retail' | 'restaurant' | 'other'
export type SalesCycle       = 'transactional' | 'consultative' | 'enterprise'

export interface BusinessClassification {
  business_model:    BusinessModel
  geographic_scope:  GeographicScope
  business_type:     BusinessType
  sales_cycle:       SalesCycle
  has_sales_team:    boolean
  confidence:        number
  reasoning:         string
}

export interface AdaptiveQuestion {
  id: string
  label: string
  field_key: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number'
  placeholder?: string
  hint?: string
  options?: string[]
  category: 'b2b' | 'national' | 'consultative' | 'saas' | 'local_b2c'
  show_when: {
    business_model?:   BusinessModel[]
    geographic_scope?: GeographicScope[]
    business_type?:    BusinessType[]
    sales_cycle?:      SalesCycle[]
  }
}

export const DEFAULT_CLASSIFICATION: BusinessClassification = {
  business_model:   'b2c',
  geographic_scope: 'local',
  business_type:    'service',
  sales_cycle:      'transactional',
  has_sales_team:   false,
  confidence:       0,
  reasoning:        'Default — classification not available',
}

export const ADAPTIVE_QUESTIONS: AdaptiveQuestion[] = [
  // ── B2B SPECIFIC ──────────────────────────────────────────
  {
    id: 'q_target_industries',
    label: 'Which industries or verticals do you sell into?',
    field_key: 'target_industries',
    type: 'textarea',
    placeholder: 'e.g. Healthcare, Manufacturing, Financial Services, Professional Services...',
    hint: 'Be specific — this helps us target the right decision makers',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_target_company_size',
    label: 'What size companies do you typically sell to?',
    field_key: 'target_company_size',
    type: 'multiselect',
    options: ['Solopreneurs (1)', 'Small (2-10)', 'Small-Mid (11-50)', 'Mid-Market (51-200)', 'Enterprise (201-1000)', 'Large Enterprise (1000+)'],
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_decision_makers',
    label: 'Who are the typical decision makers you sell to?',
    field_key: 'decision_maker_titles',
    type: 'textarea',
    placeholder: 'e.g. CEO, VP of Operations, IT Director, Procurement Manager...',
    hint: 'Job titles and roles who sign the check or approve the purchase',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_avg_contract_value',
    label: 'What is your average contract or deal value?',
    field_key: 'avg_contract_value',
    type: 'text',
    placeholder: 'e.g. $5,000 one-time, $2,500/month retainer, $50,000 annual contract',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_sales_cycle_length',
    label: 'How long is your typical sales cycle from first contact to close?',
    field_key: 'sales_cycle_length',
    type: 'select',
    options: ['Same day / transactional', '1-2 weeks', '2-4 weeks', '1-3 months', '3-6 months', '6-12 months', '12+ months'],
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_sales_process',
    label: 'Walk me through your current sales process step by step',
    field_key: 'sales_process',
    type: 'textarea',
    placeholder: 'e.g. Lead comes in → SDR does discovery call → Demo with AE → Proposal → Legal review → Close...',
    hint: 'Include every step from first contact to signed contract',
    category: 'consultative',
    show_when: { sales_cycle: ['consultative', 'enterprise'] },
  },
  {
    id: 'q_sales_team_size',
    label: 'How many people are on your sales team?',
    field_key: 'sales_team_size',
    type: 'select',
    options: ['Just me (founder-led sales)', '1-2 reps', '3-5 reps', '6-10 reps', '10-25 reps', '25+ reps'],
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_current_crm',
    label: 'What CRM are you currently using for B2B pipeline management?',
    field_key: 'b2b_crm',
    type: 'text',
    placeholder: 'e.g. Salesforce, HubSpot, Pipedrive, Close, Monday, spreadsheets...',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_lead_sources_b2b',
    label: 'Where do your best B2B leads currently come from?',
    field_key: 'b2b_lead_sources',
    type: 'textarea',
    placeholder: 'e.g. Outbound cold email, LinkedIn, referrals from existing clients, trade shows, content marketing...',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_outbound_activity',
    label: 'Are you doing any outbound prospecting currently?',
    field_key: 'outbound_activity',
    type: 'textarea',
    placeholder: 'e.g. Cold email sequences, LinkedIn outreach, cold calling, direct mail...',
    hint: 'Include what you have tried and what results you saw',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },
  {
    id: 'q_proposal_process',
    label: 'How do you currently create and send proposals?',
    field_key: 'proposal_process',
    type: 'textarea',
    placeholder: 'e.g. Custom Word docs, PandaDoc, manual emails, standard pricing sheet...',
    category: 'consultative',
    show_when: { sales_cycle: ['consultative', 'enterprise'] },
  },
  {
    id: 'q_content_marketing',
    label: 'Do you have any content marketing or thought leadership in place?',
    field_key: 'content_marketing',
    type: 'textarea',
    placeholder: 'e.g. Blog, LinkedIn articles, podcast, webinars, case studies, white papers...',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },

  // ── NATIONAL / MULTI-LOCATION ─────────────────────────────
  {
    id: 'q_locations',
    label: 'How many locations or markets do you currently operate in?',
    field_key: 'num_locations',
    type: 'text',
    placeholder: 'e.g. 3 offices, 12 franchise locations, operates in 8 states...',
    category: 'national',
    show_when: { geographic_scope: ['national', 'regional', 'international'] },
  },
  {
    id: 'q_top_markets',
    label: 'What are your top performing markets or regions?',
    field_key: 'top_markets',
    type: 'textarea',
    placeholder: 'e.g. Southeast US is strongest, expanding into Midwest, weak in Pacific Northwest...',
    category: 'national',
    show_when: { geographic_scope: ['national', 'regional', 'international'] },
  },
  {
    id: 'q_expansion_plans',
    label: 'Are you planning to expand into new markets or territories?',
    field_key: 'expansion_plans',
    type: 'textarea',
    placeholder: 'e.g. Opening 5 new locations this year, targeting Texas and Florida...',
    category: 'national',
    show_when: { geographic_scope: ['national', 'regional', 'international'] },
  },
  {
    id: 'q_marketing_centralized',
    label: 'Is your marketing centralized or does each location manage its own?',
    field_key: 'marketing_structure',
    type: 'select',
    options: ['Fully centralized — one team handles everything', 'Hybrid — central strategy, local execution', 'Decentralized — each location manages their own', 'No structure currently'],
    category: 'national',
    show_when: { geographic_scope: ['national', 'regional'] },
  },
  {
    id: 'q_national_brand_vs_local',
    label: 'How do you balance national brand consistency with local market relevance?',
    field_key: 'brand_local_balance',
    type: 'textarea',
    placeholder: 'e.g. Strict brand guidelines but local offers, each market runs their own ads...',
    category: 'national',
    show_when: { geographic_scope: ['national', 'regional'] },
  },

  // ── PROFESSIONAL SERVICES / CONSULTATIVE ──────────────────
  {
    id: 'q_client_onboarding_process',
    label: 'What does your client onboarding process look like after someone signs?',
    field_key: 'client_onboarding_process',
    type: 'textarea',
    placeholder: 'e.g. Kickoff call, intake questionnaire, 30-day setup period...',
    category: 'consultative',
    show_when: { business_type: ['professional_services', 'saas'], sales_cycle: ['consultative', 'enterprise'] },
  },
  {
    id: 'q_retention_strategy',
    label: 'How do you keep clients long term and reduce churn?',
    field_key: 'retention_strategy',
    type: 'textarea',
    placeholder: 'e.g. Quarterly business reviews, dedicated account manager, success metrics...',
    category: 'consultative',
    show_when: { business_type: ['professional_services', 'saas'] },
  },
  {
    id: 'q_case_studies',
    label: 'Do you have documented case studies or client success stories?',
    field_key: 'case_studies',
    type: 'select',
    options: ['Yes — published on website', 'Yes — available but not public', 'Informal only — no formal case studies', 'No — we need to build these'],
    category: 'consultative',
    show_when: { business_model: ['b2b', 'both'], sales_cycle: ['consultative', 'enterprise'] },
  },
  {
    id: 'q_referral_program',
    label: 'Do you have a formal referral or partner program?',
    field_key: 'referral_program',
    type: 'textarea',
    placeholder: 'e.g. 10% referral commission, partner portal, reseller program...',
    category: 'b2b',
    show_when: { business_model: ['b2b', 'both'] },
  },

  // ── SAAS / PRODUCT SPECIFIC ───────────────────────────────
  {
    id: 'q_pricing_model',
    label: 'What is your pricing model?',
    field_key: 'pricing_model',
    type: 'select',
    options: ['One-time purchase', 'Monthly subscription', 'Annual subscription', 'Usage-based', 'Freemium', 'Custom/Enterprise pricing', 'Project-based'],
    category: 'saas',
    show_when: { business_type: ['saas', 'product', 'ecommerce'] },
  },
  {
    id: 'q_free_trial',
    label: 'Do you offer a free trial or freemium tier?',
    field_key: 'free_trial',
    type: 'textarea',
    placeholder: 'e.g. 14-day free trial, freemium with paid upgrades, demo only...',
    category: 'saas',
    show_when: { business_type: ['saas'] },
  },
  {
    id: 'q_churn_rate',
    label: 'What is your current monthly or annual churn rate?',
    field_key: 'churn_rate',
    type: 'text',
    placeholder: "e.g. ~5% monthly, about 20% annually, we don't track this yet...",
    category: 'saas',
    show_when: { business_type: ['saas'] },
  },

  // ── LOCAL B2C ENHANCERS ───────────────────────────────────
  {
    id: 'q_peak_season',
    label: 'Do you have a peak season or slow season?',
    field_key: 'seasonality',
    type: 'textarea',
    placeholder: 'e.g. Summer is our busiest, December is dead, consistent year-round...',
    hint: 'This affects how we time campaigns and promotions',
    category: 'local_b2c',
    show_when: { geographic_scope: ['local'], business_model: ['b2c'] },
  },
  {
    id: 'q_repeat_customers',
    label: 'What percentage of your revenue comes from repeat customers vs new?',
    field_key: 'repeat_customer_pct',
    type: 'text',
    placeholder: "e.g. About 60% repeat, mostly new customers, we don't track this...",
    category: 'local_b2c',
    show_when: { business_model: ['b2c', 'both'], geographic_scope: ['local'] },
  },
]

// ────────────────────────────────────────────────────────────
// Filter helpers
// ────────────────────────────────────────────────────────────

export function getAdaptiveQuestions(classification: BusinessClassification | null | undefined): AdaptiveQuestion[] {
  if (!classification) return []
  return ADAPTIVE_QUESTIONS.filter((q) => {
    const sw = q.show_when
    if (sw.business_model   && !sw.business_model.includes(classification.business_model))     return false
    if (sw.geographic_scope && !sw.geographic_scope.includes(classification.geographic_scope)) return false
    if (sw.business_type    && !sw.business_type.includes(classification.business_type))       return false
    if (sw.sales_cycle      && !sw.sales_cycle.includes(classification.sales_cycle))           return false
    return true
  })
}

export const CATEGORY_LABELS: Record<AdaptiveQuestion['category'], string> = {
  b2b:          'B2B Questions',
  national:     'National / Multi-Location Questions',
  consultative: 'Consultative Sales Questions',
  saas:         'SaaS / Product Questions',
  local_b2c:    'Local B2C Questions',
}

export function groupQuestionsByCategory(questions: AdaptiveQuestion[]): Record<string, AdaptiveQuestion[]> {
  const groups: Record<string, AdaptiveQuestion[]> = {}
  for (const q of questions) {
    const label = CATEGORY_LABELS[q.category] || q.category
    if (!groups[label]) groups[label] = []
    groups[label].push(q)
  }
  return groups
}

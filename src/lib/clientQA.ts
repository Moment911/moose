// ────────────────────────────────────────────────────────────
// Client Q&A — canonical mapping of field keys to full questions,
// sections, and display labels. Used by:
//   - Onboarding full document view
//   - KotoIQ client context injection
//   - Q&A snapshot builder (kotoiq_client_qa table)
// ───��─────────────────────────────���──────────────────────────

export interface QAField {
  key: string
  question: string
  label: string
  section: string
  priority: number // 1 = must get, 2 = important, 3 = nice to have, 4 = adaptive
  pass: 'voice' | 'web' | 'adaptive' // which onboarding version asks this
}

// Core onboarding fields (voice + web form)
export const CLIENT_QA_FIELDS: QAField[] = [
  // ── In Their Own Words ──
  { key: 'welcome_statement', question: "Tell us about your business in your own words. What do you do, who do you serve, and what's most important for us to know?", label: 'Welcome Statement', section: 'In Their Own Words', priority: 1, pass: 'voice' },

  // ── Owner & Contact ──
  { key: 'owner_name', question: "What's your full name and your role at the company?", label: 'Owner Name', section: 'Owner & Contact', priority: 1, pass: 'voice' },
  { key: 'owner_title', question: 'What is your title?', label: 'Owner Title', section: 'Owner & Contact', priority: 3, pass: 'web' },
  { key: 'owner_phone', question: "What's the best phone number for the business owner?", label: 'Owner Phone', section: 'Owner & Contact', priority: 2, pass: 'web' },
  { key: 'owner_email', question: "What's the best email for the business owner?", label: 'Owner Email', section: 'Owner & Contact', priority: 2, pass: 'web' },
  { key: 'email', question: "What's the best email address for the business?", label: 'Business Email', section: 'Owner & Contact', priority: 3, pass: 'voice' },
  { key: 'phone', question: "What's the best phone number to reach you directly?", label: 'Business Phone', section: 'Owner & Contact', priority: 2, pass: 'voice' },

  // ── Business Information ──
  { key: 'industry', question: 'How would you describe your industry or type of business?', label: 'Industry', section: 'Business Information', priority: 2, pass: 'voice' },
  { key: 'year_founded', question: 'What year was the business founded?', label: 'Year Founded', section: 'Business Information', priority: 3, pass: 'web' },
  { key: 'num_employees', question: 'How many people work for you right now?', label: 'Team Size', section: 'Business Information', priority: 2, pass: 'voice' },
  { key: 'address', question: "What's your business address?", label: 'Address', section: 'Business Information', priority: 3, pass: 'web' },
  { key: 'city', question: 'What city and state are you located in?', label: 'City', section: 'Business Information', priority: 1, pass: 'voice' },
  { key: 'state', question: 'What state?', label: 'State', section: 'Business Information', priority: 1, pass: 'voice' },
  { key: 'website', question: "What's your website URL?", label: 'Website', section: 'Business Information', priority: 2, pass: 'voice' },
  { key: 'service_area', question: 'What geographic area do you serve?', label: 'Service Area', section: 'Business Information', priority: 2, pass: 'voice' },

  // ── Services & Products ──
  { key: 'primary_service', question: "What's your primary service or product?", label: 'Primary Service', section: 'Services & Products', priority: 1, pass: 'voice' },
  { key: 'secondary_services', question: 'What other services or products do you offer?', label: 'Other Services', section: 'Services & Products', priority: 3, pass: 'web' },
  { key: 'target_customer', question: 'Describe your ideal customer. Who do you love working with?', label: 'Ideal Customer', section: 'Services & Products', priority: 1, pass: 'voice' },
  { key: 'avg_deal_size', question: "What's the average value of a typical job or contract?", label: 'Avg Deal Size', section: 'Services & Products', priority: 3, pass: 'web' },

  // ── Marketing & Growth ���─
  { key: 'marketing_budget', question: 'How much do you currently spend on marketing each month?', label: 'Marketing Budget', section: 'Marketing & Growth', priority: 2, pass: 'voice' },
  { key: 'marketing_channels', question: 'What marketing channels are you currently using?', label: 'Current Channels', section: 'Marketing & Growth', priority: 3, pass: 'web' },
  { key: 'crm_used', question: 'What CRM or software do you use to manage leads and customers?', label: 'CRM Used', section: 'Marketing & Growth', priority: 2, pass: 'voice' },
  { key: 'hosting_provider', question: 'Who hosts your website?', label: 'Website Host', section: 'Marketing & Growth', priority: 3, pass: 'web' },
  { key: 'referral_sources', question: 'Where do most of your best customers come from?', label: 'Referral Sources', section: 'Marketing & Growth', priority: 2, pass: 'voice' },

  // ── Brand & Positioning ──
  { key: 'unique_selling_prop', question: 'Why should someone choose you over your competitors?', label: 'Unique Selling Proposition', section: 'Brand & Positioning', priority: 2, pass: 'voice' },
  { key: 'brand_voice', question: 'How would you describe the tone or personality of your brand?', label: 'Brand Voice', section: 'Brand & Positioning', priority: 3, pass: 'web' },
  { key: 'tagline', question: 'Do you have a tagline or slogan for the business?', label: 'Tagline', section: 'Brand & Positioning', priority: 3, pass: 'web' },

  // ── Competition ��─
  { key: 'competitor_1', question: "Who's your biggest competitor?", label: 'Competitor 1', section: 'Competition', priority: 3, pass: 'web' },
  { key: 'competitor_2', question: 'Any other competitors worth mentioning?', label: 'Competitor 2', section: 'Competition', priority: 3, pass: 'web' },
  { key: 'competitor_3', question: 'Third competitor?', label: 'Competitor 3', section: 'Competition', priority: 3, pass: 'web' },

  // ── Reviews & Reputation ──
  { key: 'review_platforms', question: 'What platforms do customers leave reviews on?', label: 'Review Platforms', section: 'Reviews & Reputation', priority: 3, pass: 'web' },

  // ── Goals & Notes ──
  { key: 'notes', question: 'What are your top goals for the next twelve months?', label: 'Goals / Notes', section: 'Goals & Notes', priority: 1, pass: 'voice' },

  // ── Social Media ──
  { key: 'facebook_url', question: 'Facebook page URL?', label: 'Facebook', section: 'Social Media', priority: 3, pass: 'web' },
  { key: 'instagram_url', question: 'Instagram URL?', label: 'Instagram', section: 'Social Media', priority: 3, pass: 'web' },
  { key: 'linkedin_url', question: 'LinkedIn URL?', label: 'LinkedIn', section: 'Social Media', priority: 3, pass: 'web' },
  { key: 'google_business_url', question: 'Google Business Profile URL?', label: 'Google Business', section: 'Social Media', priority: 3, pass: 'web' },

  // ── Adaptive: B2B ──
  { key: 'target_industries', question: 'Which industries or verticals do you sell into?', label: 'Target Industries', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'target_company_size', question: 'What size companies do you typically sell to?', label: 'Target Company Size', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'decision_maker_titles', question: 'Who are the typical decision makers you sell to?', label: 'Decision Makers', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'avg_contract_value', question: 'What is your average contract or deal value?', label: 'Avg Contract Value', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'sales_cycle_length', question: 'How long is your typical sales cycle?', label: 'Sales Cycle', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'sales_team_size', question: 'How many people are on your sales team?', label: 'Sales Team Size', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'b2b_crm', question: 'What CRM are you using for B2B pipeline management?', label: 'B2B CRM', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'b2b_lead_sources', question: 'Where do your best B2B leads come from?', label: 'B2B Lead Sources', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'outbound_activity', question: 'Are you doing any outbound prospecting currently?', label: 'Outbound Activity', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'content_marketing', question: 'Do you have any content marketing or thought leadership?', label: 'Content Marketing', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'sales_process', question: 'Walk me through your current sales process step by step', label: 'Sales Process', section: 'B2B Details', priority: 4, pass: 'adaptive' },
  { key: 'proposal_process', question: 'How do you currently create and send proposals?', label: 'Proposal Process', section: 'B2B Details', priority: 4, pass: 'adaptive' },

  // ── Adaptive: National/Multi-Location ──
  { key: 'num_locations', question: 'How many locations or markets do you operate in?', label: 'Locations', section: 'Multi-Location', priority: 4, pass: 'adaptive' },
  { key: 'top_markets', question: 'What are your top performing markets or regions?', label: 'Top Markets', section: 'Multi-Location', priority: 4, pass: 'adaptive' },
  { key: 'expansion_plans', question: 'Are you planning to expand into new markets?', label: 'Expansion Plans', section: 'Multi-Location', priority: 4, pass: 'adaptive' },
  { key: 'marketing_structure', question: 'Is your marketing centralized or per-location?', label: 'Marketing Structure', section: 'Multi-Location', priority: 4, pass: 'adaptive' },

  // ── Adaptive: SaaS/Product ─���
  { key: 'pricing_model', question: 'What is your pricing model?', label: 'Pricing Model', section: 'SaaS & Product', priority: 4, pass: 'adaptive' },
  { key: 'free_trial', question: 'Do you offer a free trial or freemium tier?', label: 'Free Trial', section: 'SaaS & Product', priority: 4, pass: 'adaptive' },
  { key: 'churn_rate', question: 'What is your current churn rate?', label: 'Churn Rate', section: 'SaaS & Product', priority: 4, pass: 'adaptive' },

  // ── Adaptive: Local B2C ──
  { key: 'seasonality', question: 'Do you have a peak season or slow season?', label: 'Seasonality', section: 'Local Business', priority: 4, pass: 'adaptive' },
  { key: 'repeat_customer_pct', question: 'What percentage of revenue comes from repeat customers vs new?', label: 'Repeat Customer %', section: 'Local Business', priority: 4, pass: 'adaptive' },

  // ── Web Form: Business Profile ──
  { key: 'business_description', question: 'Describe your business in 2-3 sentences for marketing materials', label: 'Business Description', section: 'In Their Own Words', priority: 2, pass: 'web' },
  { key: 'ideal_customer_desc', question: 'Describe your ideal customer in detail — who are they, what problems do they have, how do they find you?', label: 'Ideal Customer (Detailed)', section: 'Services & Products', priority: 2, pass: 'web' },

  // ── Web Form: Brand ──
  { key: 'brand_tone', question: 'Select the words that best describe your brand tone', label: 'Brand Tone', section: 'Brand & Positioning', priority: 2, pass: 'web' },
  { key: 'brand_primary_color', question: 'What is your primary brand color?', label: 'Primary Color', section: 'Brand & Positioning', priority: 3, pass: 'web' },
  { key: 'brand_accent_color', question: 'What is your accent/secondary brand color?', label: 'Accent Color', section: 'Brand & Positioning', priority: 3, pass: 'web' },

  // ── Web Form: Competitors (rich) ──
  { key: 'competitors', question: 'Who are your main competitors? Include their strengths and weaknesses.', label: 'Competitors (Detailed)', section: 'Competition', priority: 2, pass: 'web' },

  // ── Web Form: Classification ──
  { key: 'growth_scope', question: 'What is your geographic growth scope?', label: 'Growth Scope', section: 'Business Information', priority: 3, pass: 'web' },
  { key: 'business_type', question: 'What type of business are you?', label: 'Business Type', section: 'Business Information', priority: 3, pass: 'web' },
  { key: 'primary_channel', question: 'Is your business primarily B2B, B2C, or both?', label: 'Primary Channel', section: 'Business Information', priority: 2, pass: 'web' },
]

// Quick lookup by field key
export const QA_BY_KEY: Record<string, QAField> = Object.fromEntries(
  CLIENT_QA_FIELDS.map(f => [f.key, f])
)

// Get unique sections in display order
export const QA_SECTIONS = [...new Set(CLIENT_QA_FIELDS.map(f => f.section))]

/**
 * Build Q&A pairs from a client record. Resolves across dedicated columns
 * and onboarding_answers jsonb. Returns only fields that have values.
 */
export function buildClientQA(client: Record<string, any>): Array<{
  field_key: string
  question: string
  answer: string
  label: string
  section: string
  priority: number
  pass: string
  source?: string
  answered_at?: string
}> {
  const answers = client?.onboarding_answers || {}
  const attribution = client?.onboarding_field_attribution || {}
  const result: ReturnType<typeof buildClientQA> = []

  for (const field of CLIENT_QA_FIELDS) {
    let value = client?.[field.key] ?? answers?.[field.key]
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) {
      // Rich competitor objects: format as "Name — Strengths: ... / Weaknesses: ..."
      if (value[0] && typeof value[0] === 'object' && ('strengths' in value[0] || 'weaknesses' in value[0])) {
        value = value.map(v => {
          const parts = [v.name || 'Unknown']
          if (v.url) parts[0] += ` (${v.url})`
          if (v.strengths) parts.push(`Strengths: ${v.strengths}`)
          if (v.weaknesses) parts.push(`Weaknesses: ${v.weaknesses}`)
          return parts.join('\n')
        }).join('\n\n')
      } else {
        value = value.map(v => typeof v === 'object' ? (v?.name || v?.label || v?.value || JSON.stringify(v)) : String(v)).filter(Boolean).join(', ')
      }
    } else if (typeof value === 'object') {
      value = Object.entries(value).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
    } else {
      value = String(value)
    }
    if (!value.trim()) continue

    const attr = attribution?.[field.key]
    result.push({
      field_key: field.key,
      question: field.question,
      answer: value.trim(),
      label: field.label,
      section: field.section,
      priority: field.priority,
      pass: field.pass,
      source: attr?.channel || undefined,
      answered_at: attr?.submitted_at || undefined,
    })
  }

  // Also capture any extra answers not in the canonical list
  const knownKeys = new Set(CLIENT_QA_FIELDS.map(f => f.key))
  const excluded = new Set(['_last_autosave', '_autosave_count', 'form_step', 'current_step', 'step', 'completed', 'submitted', 'token', 'agency_id', 'client_id', 'id', 'created_at', 'updated_at', 'persona_approved', 'persona_loading', 'persona_notes', 'persona_result', 'legal_address_same', 'billing_same_as_legal', 'contacts_billing', 'contacts_emergency', 'contacts_marketing', 'contacts_technical'])
  for (const [k, v] of Object.entries(answers)) {
    if (knownKeys.has(k) || excluded.has(k) || k.startsWith('_')) continue
    if (v === null || v === undefined || v === '' || v === false) continue
    const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (!strVal.trim() || strVal.startsWith('{')) continue
    const prettyKey = k.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    result.push({
      field_key: k,
      question: prettyKey + '?',
      answer: strVal.trim(),
      label: prettyKey,
      section: 'Additional',
      priority: 5,
      pass: 'web',
    })
  }

  return result
}

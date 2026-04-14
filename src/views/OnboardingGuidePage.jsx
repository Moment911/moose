"use client"

// Public page: /onboarding-guide
// Shows the complete onboarding questionnaire, flow, and voice AI rules.
// No auth required. Useful as a reference for Claude, clients, and team.

const STEPS = [
  { id: 'welcome',     label: 'Welcome',            desc: 'Business overview in their own words' },
  { id: 'you',         label: 'About You',           desc: 'Name, role, contact info' },
  { id: 'business',    label: 'Your Business',       desc: 'Industry, employees, year founded' },
  { id: 'products',    label: 'Products & Services', desc: 'Primary service, secondary services, pricing' },
  { id: 'customers',   label: 'Your Customers',      desc: 'Ideal customer, target market, geographic scope' },
  { id: 'competitors', label: 'Competition',         desc: 'Top competitors, differentiators' },
  { id: 'geography',   label: 'Target Markets',      desc: 'City, state, service area, local vs national' },
  { id: 'brand',       label: 'Brand & Voice',       desc: 'Brand personality, tagline, tone' },
  { id: 'social',      label: 'Social Media',        desc: 'Social profiles, posting frequency' },
  { id: 'tech',        label: 'Website & Tech',      desc: 'Website URL, CRM, analytics, hosting' },
  { id: 'access',      label: 'Give Us Access',      desc: 'Login credentials, API keys, platform access' },
  { id: 'marketing',   label: 'Marketing History',   desc: 'What they have tried, what worked, budget' },
  { id: 'revenue',     label: 'Revenue & Goals',     desc: 'Revenue, deal size, 12-month goals' },
]

const QUESTIONS = {
  'Priority 1 — MUST GET': [
    { field: 'welcome_statement', question: "Tell us about your business in your own words. What do you do, who do you serve, and what's most important?", step: 'Welcome' },
    { field: 'owner_name', question: "What's your full name and your role at the company?", step: 'About You' },
    { field: 'primary_service', question: "What's your primary service or product?", step: 'Products & Services' },
    { field: 'target_customer', question: "Describe your ideal customer. Who do you love working with?", step: 'Your Customers' },
    { field: 'city', question: "What city and state are you located in?", step: 'Target Markets' },
    { field: 'notes', question: "What are your top goals for the next twelve months?", step: 'Revenue & Goals' },
  ],
  'Priority 2 — IMPORTANT': [
    { field: 'phone', question: "What's the best phone number to reach you directly?", step: 'About You' },
    { field: 'website', question: "What's your website URL?", step: 'Website & Tech' },
    { field: 'industry', question: "How would you describe your industry or type of business?", step: 'Your Business' },
    { field: 'num_employees', question: "How many people work for you right now?", step: 'Your Business' },
    { field: 'marketing_budget', question: "How much do you currently spend on marketing each month?", step: 'Marketing History' },
    { field: 'crm_used', question: "What CRM or software do you use to manage leads and customers?", step: 'Website & Tech' },
    { field: 'unique_selling_prop', question: "Why should someone choose you over your competitors?", step: 'Competition' },
    { field: 'referral_sources', question: "Where do most of your best customers come from?", step: 'Marketing History' },
  ],
  'Priority 3 — NICE TO HAVE': [
    { field: 'email', question: "What's the best email address for the business?", step: 'About You' },
    { field: 'address', question: "What's your business address?", step: 'Target Markets' },
    { field: 'year_founded', question: "What year was the business founded?", step: 'Your Business' },
    { field: 'secondary_services', question: "What other services or products do you offer?", step: 'Products & Services' },
    { field: 'competitor_1', question: "Who's your biggest competitor?", step: 'Competition' },
    { field: 'competitor_2', question: "Any other competitors worth mentioning?", step: 'Competition' },
    { field: 'brand_voice', question: "How would you describe the tone of your brand — formal or casual?", step: 'Brand & Voice' },
    { field: 'tagline', question: "Do you have a tagline or slogan?", step: 'Brand & Voice' },
    { field: 'marketing_channels', question: "What marketing channels are you currently using?", step: 'Marketing History' },
    { field: 'avg_deal_size', question: "What's the average value of a typical job or contract?", step: 'Revenue & Goals' },
    { field: 'owner_title', question: "What's your official title at the company?", step: 'About You' },
  ],
}

const VOICE_RULES = [
  'NEVER invent or assume business information',
  'NEVER skip the PIN verification step',
  'NEVER repeat the welcome intro after Step 2',
  'NEVER ask a question that has already been answered',
  'NEVER ask more than one question per turn',
  'NEVER use: "wow", "amazing", "fantastic", "absolutely", "certainly", "great question"',
  'NEVER give pricing, timelines, or agency-specific commitments',
  'NEVER diagnose business problems or give strategic advice',
  'NEVER rush through questions without acknowledging answers',
  'If caller is frustrated → offer to stop and have team follow up',
  'If call drops → system resumes from where they left off next call',
  'NEVER end the call after just 1-2 answers — keep going through the list',
  'After saving an answer, pause briefly then ask the next question naturally',
  'ALWAYS use the save_answer tool to record responses',
]

const FLOW = [
  { step: '1', title: 'Call Comes In', desc: 'Client dials their dedicated onboarding number' },
  { step: '2', title: 'PIN Verification', desc: 'Alex asks for the 4-digit PIN sent in the onboarding email' },
  { step: '3', title: 'State Detection', desc: 'System checks how much is already filled in (fresh / partial / nearly complete)' },
  { step: '4', title: 'Identify Caller', desc: 'Alex asks for the caller\'s name and role' },
  { step: '5', title: 'Question Flow', desc: 'Alex asks remaining questions in priority order. Answers save to the form in real time.' },
  { step: '6', title: 'Live Form Sync', desc: 'As the caller answers, the onboarding form updates live — the client can watch it happen on screen' },
  { step: '7', title: 'Wrap Up', desc: 'Alex confirms completion, thanks the caller, and the agency gets notified' },
  { step: '8', title: 'Post-Call Analysis', desc: 'AI analyzes the call for sentiment, engagement, and follow-up recommendations' },
]

export default function OnboardingGuidePage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', fontFamily: '-apple-system, sans-serif', color: '#111' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6007E', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Koto Platform</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 12px' }}>Onboarding Guide</h1>
        <p style={{ fontSize: 17, color: '#6b7280', lineHeight: 1.7, maxWidth: 600 }}>
          Complete reference for the Koto onboarding questionnaire, voice AI flow, and data collection process.
          This document is used by the AI voice agent (Alex) to conduct phone interviews.
        </p>
      </div>

      {/* Call Flow */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Call Flow</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {FLOW.map(f => (
            <div key={f.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6007E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{f.step}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form Steps */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Form Sections ({STEPS.length} steps)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ padding: '14px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E6007E', marginBottom: 4 }}>Step {i + 1}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
          All Questions ({Object.values(QUESTIONS).flat().length} total)
        </h2>
        {Object.entries(QUESTIONS).map(([tier, questions]) => (
          <div key={tier} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: tier.includes('MUST') ? '#dc2626' : tier.includes('IMPORTANT') ? '#f59e0b' : '#6b7280', marginBottom: 12 }}>{tier}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Field</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Question</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Form Step</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.field} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{q.field}</td>
                    <td style={{ padding: '10px 12px', fontSize: 14, color: '#111' }}>{q.question}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#6b7280' }}>{q.step}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* Voice AI Rules */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Voice AI Rules ({VOICE_RULES.length})</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {VOICE_RULES.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#E6007E', minWidth: 24 }}>{i + 1}.</span>
              <span style={{ fontSize: 14, color: '#111' }}>{rule}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Config */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Voice Agent Configuration</h2>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {[
            ['Agent Name', 'Alex'],
            ['Voice', '11labs-Marissa'],
            ['Language', 'en-US'],
            ['Backchannel', 'Enabled (40% frequency)'],
            ['Interruption Sensitivity', '0.6 (moderate)'],
            ['Speaking Speed', 'Default (1.0x)'],
            ['Call Duration', '10-15 minutes typical'],
            ['Post-Call Analysis', 'Claude Haiku — sentiment, engagement, follow-up recommendations'],
            ['Tools', 'verify_pin, save_answer, save_flag, end_call'],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', borderBottom: i < 8 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ width: 220, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#374151', background: '#f9fafb', flexShrink: 0 }}>{k}</div>
              <div style={{ flex: 1, padding: '10px 16px', fontSize: 14, color: '#111' }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#9ca3af' }}>
        Koto Platform — Onboarding Guide · Generated for reference
      </div>
    </div>
  )
}

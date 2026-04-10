"use client"
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, Sparkles, CheckCircle, ExternalLink,
  Loader2, Trash2, ArrowRight, Building, Copy, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useMobile } from '../hooks/useMobile'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F7F7F6',
  white: '#fff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  red: '#E6007E',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  amber: '#f59e0b',
  amberSoft: '#fffbeb',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
}
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const SIMULATION_PROFILES = [
  {
    id: 'local_hvac',
    emoji: '🔧',
    label: 'Local HVAC Company',
    description: 'B2C, local service, 2 techs, South Florida',
    welcome: 'We are a family-owned HVAC company in Boca Raton serving homeowners for 12 years. We have 2 full-time technicians and the owner still runs service calls. Our biggest problem is we get slammed in summer and dead in winter. Most leads come from word of mouth. We tried Google Ads once and wasted money. We have no system for following up with old customers.',
  },
  {
    id: 'b2b_saas',
    emoji: '💻',
    label: 'B2B SaaS Company',
    description: 'B2B, national, $500-2k MRR per customer',
    welcome: 'We build project management software for construction companies. We sell nationally to general contractors with 10-100 employees. Our average contract is $1,200/month. Sales cycle is 4-6 weeks. We have 2 sales reps doing outbound but close rate is only 8%. Our biggest challenge is getting in front of the right decision makers — usually the owner or project manager.',
  },
  {
    id: 'medical_practice',
    emoji: '🏥',
    label: 'Multi-Location Medical Practice',
    description: 'B2C, regional, 3 locations, healthcare',
    welcome: 'We operate 3 physical therapy clinics in South Florida — Boca Raton, Fort Lauderdale, and Miami. We see about 150 patients per week across all locations. Most referrals come from orthopedic surgeons but we want to grow our direct patient pipeline. We are HIPAA compliant. Our biggest challenge is no-shows which cost us about $8,000 per month in lost revenue.',
  },
  {
    id: 'national_franchise',
    emoji: '🏪',
    label: 'National Franchise Brand',
    description: 'B2C, national, 45 franchise locations',
    welcome: 'We are a home cleaning franchise with 45 locations across 12 states. Corporate handles brand marketing but each franchisee manages their own local marketing with a $2,000/month budget. Our biggest challenge is consistency — some locations are killing it and others are struggling. We need a system that works for every location but can be customized locally.',
  },
  {
    id: 'law_firm',
    emoji: '⚖️',
    label: 'Personal Injury Law Firm',
    description: 'B2C, regional, high-ticket cases',
    welcome: 'We are a personal injury law firm in Miami with 4 attorneys. Average case value is $85,000 in settlements. We spend $15,000/month on Google Ads but our intake process is broken — leads come in and nobody follows up fast enough. We get about 200 leads per month but only sign 8-10 cases. The competition in Miami is brutal.',
  },
  {
    id: 'ecommerce_brand',
    emoji: '📦',
    label: 'E-Commerce Brand',
    description: 'B2C, national, Shopify, $2M revenue',
    welcome: 'We sell premium outdoor furniture online through our Shopify store. We do about $2M per year. Our average order is $1,800. We get most sales from Google Shopping and some Meta ads. Our email list has 45,000 subscribers but we only email them once a month. Cart abandonment is killing us — about 75% abandon without buying. We have no post-purchase sequence.',
  },
  {
    id: 'consulting_firm',
    emoji: '📊',
    label: 'B2B Consulting Firm',
    description: 'B2B, national, enterprise clients',
    welcome: 'We are a supply chain consulting firm working with mid-market manufacturers. Our typical engagement is $50,000-$200,000 and lasts 6-12 months. We sell to VP of Operations and COO level. Sales cycle is 3-6 months. All our business comes from referrals right now — we have no outbound motion and no content marketing. We need to build a pipeline that does not depend on referrals.',
  },
  {
    id: 'dental_practice',
    emoji: '🦷',
    label: 'Dental Practice',
    description: 'B2C, local, single location, fee-for-service',
    welcome: 'We are a fee-for-service dental practice in Delray Beach. We do not accept insurance which means we have to work harder to attract patients who value quality over cost. We have 1 dentist and 3 hygienists seeing about 40 patients per week. New patient acquisition is our biggest challenge. We have 320 Google reviews at 4.8 stars. We have never run paid ads.',
  },
]

const PROGRESS_STEPS = [
  { key: 'classify', label: 'Classifying business type…' },
  { key: 'generate', label: 'Generating realistic business data…' },
  { key: 'fill',     label: 'Filling all form fields…' },
  { key: 'save',     label: 'Saving to test client record…' },
  { key: 'done',     label: 'Simulation complete!' },
]

// Columns that are persisted directly on the clients table — used by the
// data flow visualization to show green "saved to column" vs teal "jsonb".
const CLIENT_COLUMNS = new Set([
  'name', 'email', 'phone', 'website', 'industry', 'city', 'state', 'zip', 'address',
  'owner_name', 'owner_title', 'owner_phone', 'owner_email',
  'num_employees', 'year_founded', 'service_area',
  'primary_service', 'secondary_services', 'target_customer',
  'avg_deal_size', 'marketing_channels', 'marketing_budget',
  'competitor_1', 'competitor_2', 'competitor_3',
  'unique_selling_prop', 'brand_voice', 'tagline', 'logo_url',
  'crm_used', 'hosting_provider',
  'facebook_url', 'instagram_url', 'linkedin_url', 'tiktok_url', 'youtube_url',
  'google_business_url',
  'review_platforms', 'referral_sources',
  'notes',
  'welcome_statement', 'business_classification',
])

// Form-key → clients column aliases (mirrors FIELD_MAP in the onboarding route)
const FIELD_ALIAS = {
  business_name: 'name',
  title: 'owner_title',
  google_biz_url: 'google_business_url',
  brand_tagline: 'tagline',
  current_ad_platforms: 'marketing_channels',
  monthly_ad_budget: 'marketing_budget',
  avg_contract_value: 'avg_deal_size',
  b2b_crm: 'crm_used',
  google_rating: 'review_rating',
  google_reviews: 'review_count',
}

export default function OnboardingSimulatorPage() {
  const { agencyId } = useAuth()
  const isMobile = useMobile()
  const navigate = useNavigate()

  const aid = agencyId || '00000000-0000-0000-0000-000000000099'

  const [selectedProfile, setSelectedProfile] = useState(null)
  const [customWelcome, setCustomWelcome] = useState('')
  const [running, setRunning] = useState(false)
  const [progressStep, setProgressStep] = useState(-1)
  const [result, setResult] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const currentProfile = selectedProfile === 'custom'
    ? { id: 'custom', label: 'Custom', welcome: customWelcome }
    : SIMULATION_PROFILES.find((p) => p.id === selectedProfile)

  const canRun = !running && currentProfile && (currentProfile.welcome || '').trim().length >= 30

  async function runSimulation() {
    if (!canRun) return
    setRunning(true)
    setResult(null)
    setProgressStep(0)

    // Kick off a fake progress animation while the real call runs
    const timers = [
      setTimeout(() => setProgressStep(1), 1200),
      setTimeout(() => setProgressStep(2), 3000),
      setTimeout(() => setProgressStep(3), 6000),
    ]

    try {
      const res = await fetch('/api/onboarding-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          agency_id: aid,
          profile_id: currentProfile.id,
          welcome_statement: currentProfile.welcome,
        }),
      })
      const json = await res.json()
      if (json?.error) {
        toast.error(json.error.slice(0, 200))
        setProgressStep(-1)
        timers.forEach(clearTimeout)
        setRunning(false)
        return
      }
      timers.forEach(clearTimeout)
      setProgressStep(4)
      setResult(json.data)
      toast.success('Simulation complete')
    } catch (e) {
      toast.error(e?.message || 'Simulation failed')
      setProgressStep(-1)
    }
    timers.forEach(clearTimeout)
    setRunning(false)
  }

  async function deleteTestClient() {
    if (!result?.client_id) return
    if (!confirm('Soft-delete this test client? It will be hidden from the list but recoverable.')) return
    setDeleting(true)
    try {
      await supabase
        .from('clients')
        .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
        .eq('id', result.client_id)
      toast.success('Test client deleted')
      setResult(null)
      setSelectedProfile(null)
      setProgressStep(-1)
    } catch (e) {
      toast.error(e?.message || 'Delete failed')
    }
    setDeleting(false)
  }

  // NOTE: previously this component had a hard `if (!isSuperAdmin) return ...`
  // gate here. That was unnecessary (the sidebar link is already hidden behind
  // `isSuperAdmin && !isImpersonating` in Sidebar.jsx) and caused a blank /
  // "Super admin only" screen during the brief window when useAuth() has not
  // yet resolved the session — isSuperAdmin starts `false` and flips to `true`
  // once auth loads. The full simulator now renders immediately.

  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: FB, color: C.text }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 32 }}>
        {/* Header */}
        <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.teal}, ${C.teal}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            <FlaskConical size={22} />
          </div>
          <div>
            <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Onboarding Form Simulator
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2, maxWidth: 640 }}>
              Test the complete onboarding flow with AI-generated business data. See how adaptive questions work, where data saves, and what the client detail page looks like.
            </div>
          </div>
        </div>

        {/* Step 1 — Profile picker */}
        {!result && (
          <>
            <div style={sectionTitle}>1. Pick a business profile to simulate</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12, marginBottom: 24,
            }}>
              {SIMULATION_PROFILES.map((p) => {
                const isSelected = selectedProfile === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProfile(p.id)}
                    style={{
                      textAlign: 'left', padding: 18, borderRadius: 12,
                      background: isSelected ? C.tealSoft : '#fff',
                      border: `2px solid ${isSelected ? C.teal : C.border}`,
                      cursor: 'pointer', fontFamily: FB,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{p.emoji}</div>
                    <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 3 }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      {p.description}
                    </div>
                  </button>
                )
              })}

              {/* Custom */}
              <button
                type="button"
                onClick={() => setSelectedProfile('custom')}
                style={{
                  textAlign: 'left', padding: 18, borderRadius: 12,
                  background: selectedProfile === 'custom' ? C.tealSoft : '#fff',
                  border: `2px solid ${selectedProfile === 'custom' ? C.teal : C.border}`,
                  borderStyle: selectedProfile === 'custom' ? 'solid' : 'dashed',
                  cursor: 'pointer', fontFamily: FB,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>✏️</div>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 3 }}>
                  Custom
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                  Write your own welcome statement and simulate it
                </div>
              </button>
            </div>

            {selectedProfile === 'custom' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontFamily: FH, fontWeight: 800, color: C.mutedDark, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'block' }}>
                  Custom welcome statement (30+ characters)
                </label>
                <textarea
                  value={customWelcome}
                  onChange={(e) => setCustomWelcome(e.target.value)}
                  rows={5}
                  placeholder="Describe the business the way an owner would describe it in their own words. Include industry, size, location, biggest challenges, what they've tried before, and what they want to achieve…"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    border: `1px solid ${C.border}`, fontSize: 14, fontFamily: FB,
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  {customWelcome.length} chars
                </div>
              </div>
            )}

            {selectedProfile && selectedProfile !== 'custom' && currentProfile?.welcome && (
              <div style={{
                marginBottom: 24, padding: 16, borderRadius: 10,
                background: C.tealSoft, border: `1px solid ${C.teal}30`,
                fontSize: 13, color: C.mutedDark, lineHeight: 1.6, fontStyle: 'italic',
              }}>
                "{currentProfile.welcome}"
              </div>
            )}

            {/* Run button */}
            <div style={{ marginBottom: 30 }}>
              <button
                onClick={runSimulation}
                disabled={!canRun}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '14px 28px', borderRadius: 12, border: 'none',
                  background: canRun ? C.text : '#e5e7eb',
                  color: canRun ? '#fff' : C.muted,
                  fontFamily: FH, fontSize: 15, fontWeight: 800,
                  cursor: canRun ? 'pointer' : 'not-allowed',
                  boxShadow: canRun ? '0 6px 18px rgba(17,17,17,0.2)' : 'none',
                }}
              >
                <Sparkles size={16} />
                Run Simulation
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* Progress panel */}
        {running && (
          <div style={{
            background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 24, marginBottom: 24,
          }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 14 }}>
              Running simulation for {currentProfile?.label || 'Custom'}
            </div>
            {PROGRESS_STEPS.map((s, i) => {
              const isDone = progressStep > i || (progressStep === 4 && i === 4)
              const isActive = progressStep === i
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', fontSize: 13,
                  color: isDone || isActive ? C.text : C.muted,
                }}>
                  {isDone ? (
                    <CheckCircle size={16} color={C.green} />
                  ) : isActive ? (
                    <Loader2 size={16} color={C.teal} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#f3f4f6' }} />
                  )}
                  <span style={{ fontFamily: FB, fontWeight: isActive ? 700 : 400 }}>
                    {isDone && i < 4 ? s.label.replace('…', '') : s.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Results */}
        {result && <ResultPanel result={result} onDelete={deleteTestClient} deleting={deleting} navigate={navigate} onReset={() => { setResult(null); setSelectedProfile(null); setProgressStep(-1); }} />}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

const sectionTitle = {
  fontSize: 12, fontFamily: FH, fontWeight: 800, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12,
}

// ─────────────────────────────────────────────────────────────
// Result panel
// ─────────────────────────────────────────────────────────────
function ResultPanel({ result, onDelete, deleting, navigate, onReset }) {
  const cls = result.classification || {}
  const generated = result.generated_data || {}
  const adaptiveQs = result.adaptive_questions || []

  // Data flow rows
  const flowRows = useMemo(() => {
    return Object.entries(generated)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([formKey, value]) => {
        const alias = FIELD_ALIAS[formKey] || formKey
        const savedToColumn = CLIENT_COLUMNS.has(alias)
        return { formKey, value, column: alias, savedToColumn }
      })
  }, [generated])

  const columnCount = flowRows.filter((r) => r.savedToColumn).length
  const jsonbCount = flowRows.length - columnCount

  // Group adaptive questions by category
  const groupedAdaptive = useMemo(() => {
    const groups = {}
    for (const q of adaptiveQs) {
      const key = q.category || 'other'
      if (!groups[key]) groups[key] = []
      groups[key].push(q)
    }
    return groups
  }, [adaptiveQs])

  const CATEGORY_LABELS = {
    b2b:          'B2B Questions',
    national:     'National / Multi-Location Questions',
    consultative: 'Consultative Sales Questions',
    saas:         'SaaS / Product Questions',
    local_b2c:    'Local B2C Questions',
    other:        'Other',
  }

  return (
    <div>
      {/* SECTION A — Classification */}
      <div style={sectionTitle}>A. Business Classification</div>
      <div style={{
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 20, marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        <Badge color={cls.business_model === 'b2b' ? C.blue : cls.business_model === 'both' ? C.teal : C.green}
          label={`Model: ${String(cls.business_model || 'unknown').toUpperCase()}`} />
        <Badge color={C.amber} label={`Scope: ${cls.geographic_scope || 'unknown'}`} />
        <Badge color={C.mutedDark} label={`Type: ${String(cls.business_type || 'unknown').replace(/_/g, ' ')}`} />
        <Badge color={C.red} label={`Sales: ${cls.sales_cycle || 'unknown'}`} />
        <Badge color={cls.has_sales_team ? C.green : C.muted} label={`Sales team: ${cls.has_sales_team ? 'Yes' : 'No'}`} />
        <Badge color={C.teal} label={`Confidence: ${cls.confidence || 0}%`} />
        {cls.reasoning && (
          <div style={{
            width: '100%', fontSize: 13, color: C.mutedDark, fontStyle: 'italic',
            padding: '10px 14px', background: '#f9fafb', borderRadius: 8, marginTop: 4,
          }}>
            <strong style={{ color: C.text }}>Reasoning:</strong> {cls.reasoning}
          </div>
        )}
      </div>

      {/* SECTION B — Adaptive questions */}
      <div style={sectionTitle}>B. Adaptive Questions ({adaptiveQs.length} total)</div>
      {adaptiveQs.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 24, color: C.muted, fontSize: 13 }}>
          No adaptive questions would show for this classification. The standard form fields cover everything.
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
          {Object.entries(groupedAdaptive).map(([cat, qs]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: FH, fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                {CATEGORY_LABELS[cat] || cat} ({qs.length})
              </div>
              {qs.map((q) => (
                <div key={q.id} style={{
                  padding: '10px 14px', background: '#fafafa',
                  borderRadius: 8, marginBottom: 6,
                  border: '1px solid #f0f0f0',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                    {q.label}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                    Field key: <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 4 }}>{q.field_key}</code>
                  </div>
                  {generated[q.field_key] && (
                    <div style={{
                      fontSize: 12, color: C.mutedDark, fontStyle: 'italic',
                      background: C.tealSoft, padding: '6px 10px', borderRadius: 6,
                    }}>
                      "{String(generated[q.field_key]).slice(0, 220)}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* SECTION C — Data flow */}
      <div style={sectionTitle}>
        C. Data Flow ({columnCount} columns · {jsonbCount} jsonb spillover)
      </div>
      <div style={{
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
        padding: 0, marginBottom: 24, overflow: 'hidden',
      }}>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}`, background: '#fafafa' }}>
                <th style={th}>Form Field</th>
                <th style={th}>Value</th>
                <th style={th}>Saved To</th>
              </tr>
            </thead>
            <tbody>
              {flowRows.map(({ formKey, value, column, savedToColumn }) => (
                <tr key={formKey} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{formKey}</td>
                  <td style={{ ...td, color: C.mutedDark, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value)}>
                    {String(value)}
                  </td>
                  <td style={td}>
                    {savedToColumn ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.green, fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                        <Check size={12} /> clients.{column}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.teal, fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                        <Copy size={12} /> onboarding_answers
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION D — Action buttons */}
      <div style={sectionTitle}>D. View Live Results</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/clients/${result.client_id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 22px', borderRadius: 12, border: 'none',
            background: C.text, color: '#fff',
            fontFamily: FH, fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          <Building size={16} /> View Client Detail Page <ArrowRight size={14} />
        </button>
        <button
          onClick={() => window.open(`/onboard/${result.client_id}`, '_blank', 'noopener')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 22px', borderRadius: 12, border: `2px solid ${C.teal}`,
            background: '#fff', color: C.teal,
            fontFamily: FH, fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}
        >
          <ExternalLink size={16} /> View Onboarding Form
        </button>
      </div>

      {/* SECTION E — Cleanup */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={onReset}
          style={{
            padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.border}`,
            background: '#fff', color: C.mutedDark,
            fontFamily: FH, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Run Another Simulation
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.red}40`,
            background: '#fff', color: C.red,
            fontFamily: FH, fontSize: 13, fontWeight: 700,
            cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
          }}
        >
          {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
          Delete This Test Client
        </button>
      </div>
    </div>
  )
}

function Badge({ color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '6px 12px', borderRadius: 999,
      background: color + '15', color,
      border: `1px solid ${color}40`,
      fontFamily: FH, fontSize: 12, fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

const th = { padding: '10px 14px', textAlign: 'left', fontFamily: FH, fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }
const td = { padding: '10px 14px', fontFamily: FB, fontSize: 12 }

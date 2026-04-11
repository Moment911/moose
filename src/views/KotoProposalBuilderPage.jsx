"use client"
// ─────────────────────────────────────────────────────────────
// KotoProposalBuilderPage
//
// AI-driven proposal builder powered by client onboarding data.
// Three-pane layout:
//   ← left: client data summary pulled from onboarding
//   center: live proposal preview (populated after generate)
//   → right: customization controls (budget, services, tone,
//             focus area)
//
// Posts to /api/proposals/builder?action=generate which calls
// Claude Sonnet, persists to koto_proposals, and returns a PDF
// URL + structured content.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { ArrowLeft, Sparkles, Download, Copy, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TEAL = '#00C2CB'
const PINK = '#E6007E'

const SERVICE_OPTIONS = [
  'SEO',
  'Google Ads',
  'Meta Ads',
  'Local SEO / GBP',
  'Content Marketing',
  'Email Marketing',
  'Social Media Management',
  'Reputation Management',
  'Web Design',
  'Conversion Optimization',
]

export default function KotoProposalBuilderPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const clientId = params.clientId || searchParams.get('client')

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  // Controls
  const [monthlyBudget, setMonthlyBudget] = useState(5000)
  const [services, setServices] = useState(['SEO', 'Google Ads', 'Local SEO / GBP'])
  const [tone, setTone] = useState('Consultative')
  const [focusArea, setFocusArea] = useState('All-in-one')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [proposalId, setProposalId] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    if (!clientId) {
      setLoading(false)
      return
    }
    supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        setClient(data)
        setLoading(false)
        if (data?.marketing_budget) {
          const n = parseFloat(String(data.marketing_budget).replace(/[^0-9.]/g, ''))
          if (!isNaN(n) && n > 0) setMonthlyBudget(n)
        }
      })
  }, [clientId])

  function toggleService(svc) {
    setServices((prev) => prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc])
  }

  async function generate() {
    if (!clientId || !agencyId) {
      toast.error('Missing client or agency')
      return
    }
    setGenerating(true)
    setProposal(null)
    try {
      const res = await fetch('/api/proposals/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          client_id: clientId,
          agency_id: agencyId,
          services,
          monthly_budget: monthlyBudget,
          tone,
          focus_area: focusArea,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate')
      } else {
        setProposal(data.content)
        setProposalId(data.proposal_id)
        setPdfUrl(data.pdf_url)
        toast.success('Proposal generated')
      }
    } catch (e) {
      toast.error('Generation failed')
    }
    setGenerating(false)
  }

  function copyShareLink() {
    if (!proposalId) return
    const url = `${window.location.origin}/koto-proposal/${proposalId}`
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 40 }}>
          <button onClick={() => navigate('/clients')} style={{ marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back to clients
          </button>
          <div style={{ fontSize: 24, fontWeight: 800 }}>No client selected</div>
          <div style={{ color: '#6b7280', marginTop: 8 }}>Open this page from a client profile.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 32px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate(`/clients/${clientId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, letterSpacing: 1 }}>PROPOSAL BUILDER</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{client.name}</div>
          </div>
          {proposal && (
            <>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ padding: '10px 18px', borderRadius: 10, background: '#fff', border: '1.5px solid #e5e7eb', color: '#374151', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Download PDF
                </a>
              )}
              <button onClick={copyShareLink} style={{ padding: '10px 18px', borderRadius: 10, background: TEAL, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {shareCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Share Link</>}
              </button>
            </>
          )}
        </div>

        {/* Three-pane layout */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: 16, padding: 16, overflow: 'hidden' }}>
          {/* Left — client summary */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, overflow: 'auto', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1, marginBottom: 12 }}>FROM ONBOARDING</div>
            <DataRow label="Industry" value={client.industry} />
            <DataRow label="Location" value={[client.city, client.state].filter(Boolean).join(', ')} />
            <DataRow label="Primary service" value={client.primary_service} />
            <DataRow label="Ideal customer" value={client.target_customer} />
            <DataRow label="Marketing budget" value={client.marketing_budget} />
            <DataRow label="Current channels" value={client.marketing_channels} />
            <DataRow label="CRM" value={client.crm_used} />
            <DataRow label="Goals" value={client.notes} />
            <DataRow label="Competitors" value={[client.competitor_1, client.competitor_2].filter(Boolean).join(', ')} />
            <DataRow label="UVP" value={client.unique_selling_prop} />
          </div>

          {/* Center — preview */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, overflow: 'auto', border: '1px solid #e5e7eb' }}>
            {generating && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Loader2 className="animate-spin" size={32} style={{ color: TEAL, margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Claude is writing your proposal…</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>This usually takes 30-60 seconds.</div>
              </div>
            )}

            {!generating && !proposal && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <Sparkles size={48} style={{ color: TEAL, margin: '0 auto 16px' }} />
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8 }}>Generate a proposal</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
                  We'll use {client.name}'s onboarding data and Claude to create a tailored proposal in seconds.
                </div>
                <button onClick={generate} style={{ padding: '14px 32px', borderRadius: 12, background: TEAL, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                  ✨ Generate Proposal
                </button>
              </div>
            )}

            {!generating && proposal && (
              <div style={{ maxWidth: 700, margin: '0 auto' }}>
                {proposal.proposal_headline && (
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#111', lineHeight: 1.2, marginBottom: 8 }}>{proposal.proposal_headline}</div>
                )}
                {proposal.tagline && (
                  <div style={{ fontSize: 15, fontStyle: 'italic', color: TEAL, marginBottom: 32 }}>{proposal.tagline}</div>
                )}

                <PreviewSection title="Executive Summary" body={proposal.executive_summary} />
                <PreviewSection title="Situation Analysis" body={proposal.situation_analysis} />

                {Array.isArray(proposal.strategy) && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: 1, marginBottom: 12 }}>RECOMMENDED STRATEGY</div>
                    {proposal.strategy.map((s, i) => (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{i + 1}. {s.title}</div>
                        <div style={{ fontSize: 14, color: '#374151', marginTop: 4, lineHeight: 1.6 }}>{s.description}</div>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(proposal.services) && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: 1, marginBottom: 12 }}>SERVICES</div>
                    {proposal.services.map((svc, i) => (
                      <div key={i} style={{ marginBottom: 16, padding: 14, background: '#f9fafb', borderRadius: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>{svc.name}</div>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{svc.description}</div>
                        {svc.price_range && <div style={{ fontSize: 13, color: TEAL, fontWeight: 700, marginTop: 4 }}>{svc.price_range}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {proposal.investment && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: 1, marginBottom: 12 }}>INVESTMENT</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {['starter', 'growth', 'accelerator'].map((tier) => (
                        <div key={tier} style={{ background: '#f9fafb', padding: 16, borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{tier}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: TEAL, marginTop: 4 }}>${Number(proposal.investment[tier] || 0).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>/ month</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <PreviewSection title="Why Us" body={proposal.why_us} />

                {Array.isArray(proposal.next_steps) && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: 1, marginBottom: 12 }}>NEXT STEPS</div>
                    <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
                      {proposal.next_steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — controls */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, overflow: 'auto', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 1, marginBottom: 16 }}>CUSTOMIZATION</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Monthly Investment</div>
              <input
                type="range"
                min={1000}
                max={50000}
                step={500}
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 18, fontWeight: 900, color: TEAL, marginTop: 4 }}>${monthlyBudget.toLocaleString()}/mo</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Services</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SERVICE_OPTIONS.map((svc) => (
                  <label key={svc} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={services.includes(svc)} onChange={() => toggleService(svc)} />
                    {svc}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Tone</div>
              <select value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle}>
                <option>Professional</option>
                <option>Consultative</option>
                <option>Aggressive growth</option>
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Focus Area</div>
              <select value={focusArea} onChange={(e) => setFocusArea(e.target.value)} style={inputStyle}>
                <option>All-in-one</option>
                <option>SEO</option>
                <option>Paid ads</option>
                <option>Social</option>
                <option>Email</option>
              </select>
            </div>

            <button
              onClick={generate}
              disabled={generating}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: TEAL, color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 800, cursor: generating ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {generating ? <><Loader2 className="animate-spin" size={14} /> Generating…</> : <><Sparkles size={14} /> {proposal ? 'Regenerate' : 'Generate Proposal'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
  background: '#fff', boxSizing: 'border-box',
}

function DataRow({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? '#111' : '#d1d5db', marginTop: 2, lineHeight: 1.4 }}>{value || '—'}</div>
    </div>
  )
}

function PreviewSection({ title, body }) {
  if (!body) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, letterSpacing: 1, marginBottom: 12 }}>{title.toUpperCase()}</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  )
}

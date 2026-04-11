// ─────────────────────────────────────────────────────────────
// /proposals/view/[id]
//
// Public proposal viewer — no login required. Renders the
// AI-generated proposal content with the agency's branding,
// tracks the first view, and exposes Accept / Schedule a Call
// CTAs that fire notifications to the agency.
// ─────────────────────────────────────────────────────────────

'use client'

import { use, useEffect, useState } from 'react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PublicProposalViewPage({ params }: PageProps) {
  const { id } = use(params)
  const [proposal, setProposal] = useState<any>(null)
  const [agency, setAgency] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/proposals/builder?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.proposal) {
          setProposal(d.proposal)
          setAccepted(!!d.proposal.accepted_at)
          if (d.proposal.agency_id) {
            return fetch(`/api/agency/white-label?agency_id=${d.proposal.agency_id}`)
              .then((r) => r.json())
              .then((b) => setAgency(b))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // fire-and-forget mark as viewed
    fetch('/api/proposals/builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_viewed', id }),
    }).catch(() => {})
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' }}>
        <div style={{ color: '#6b7280' }}>Loading proposal…</div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: '-apple-system, sans-serif' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>Proposal not found</div>
        <div style={{ color: '#6b7280' }}>This link may have expired or been removed.</div>
      </div>
    )
  }

  const c = proposal.content || {}
  const primaryColor = agency?.primary_color || '#00C2CB'
  const agencyName = agency?.brand_name || 'Your Agency'

  async function handleAccept() {
    setAccepting(true)
    try {
      await fetch('/api/proposals/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_accepted', id }),
      })
      setAccepted(true)
    } catch { /* swallow */ }
    setAccepting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', -apple-system, sans-serif", color: '#111' }}>
      {/* Branded header */}
      <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`, padding: '60px 24px 80px', color: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, opacity: 0.85, marginBottom: 12 }}>
            {agencyName.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.1 }}>
            Marketing Proposal
          </h1>
          {c.proposal_headline && (
            <p style={{ fontSize: 18, opacity: 0.92, margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
              {c.proposal_headline}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '-40px auto 0', padding: '0 24px 80px', position: 'relative' }}>
        {/* Executive Summary */}
        {c.executive_summary && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Executive Summary</SectionTitle>
            <Paragraph>{c.executive_summary}</Paragraph>
          </Card>
        )}

        {/* Situation Analysis */}
        {c.situation_analysis && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Situation Analysis</SectionTitle>
            <Paragraph>{c.situation_analysis}</Paragraph>
          </Card>
        )}

        {/* Strategy */}
        {Array.isArray(c.strategy) && c.strategy.length > 0 && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Recommended Strategy</SectionTitle>
            {c.strategy.map((s: any, i: number) => (
              <div key={i} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: primaryColor, marginBottom: 6 }}>
                  {i + 1}. {s.title}
                </div>
                <Paragraph>{s.description}</Paragraph>
                {s.rationale && (
                  <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 6 }}>
                    Rationale: {s.rationale}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}

        {/* Services */}
        {Array.isArray(c.services) && c.services.length > 0 && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Proposed Services</SectionTitle>
            {c.services.map((svc: any, i: number) => (
              <div key={i} style={{ marginBottom: 24, paddingBottom: 18, borderBottom: i < c.services.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 6 }}>{svc.name}</div>
                <Paragraph>{svc.description}</Paragraph>
                {Array.isArray(svc.deliverables) && svc.deliverables.length > 0 && (
                  <ul style={{ margin: '8px 0 8px 20px', padding: 0, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                    {svc.deliverables.map((d: string, j: number) => <li key={j}>{d}</li>)}
                  </ul>
                )}
                {svc.price_range && (
                  <div style={{ fontSize: 14, fontWeight: 800, color: primaryColor, marginTop: 8 }}>{svc.price_range}</div>
                )}
              </div>
            ))}
          </Card>
        )}

        {/* Investment */}
        {c.investment && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Investment</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Starter', value: c.investment.starter || 0 },
                { label: 'Growth', value: c.investment.growth || 0 },
                { label: 'Accelerator', value: c.investment.accelerator || 0 },
              ].map((tier) => (
                <div key={tier.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '20px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', letterSpacing: 1, marginBottom: 8 }}>{tier.label.toUpperCase()}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: primaryColor }}>${Number(tier.value).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>/ month</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ROI */}
        {Array.isArray(c.roi_projections) && c.roi_projections.length > 0 && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Projected Outcomes</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: 700 }}>Metric</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: 700 }}>Current</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: 700 }}>90 days</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: 700 }}>6 months</th>
                </tr>
              </thead>
              <tbody>
                {c.roi_projections.map((roi: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700 }}>{roi.metric}</td>
                    <td style={{ padding: '12px 8px', color: '#6b7280' }}>{roi.current}</td>
                    <td style={{ padding: '12px 8px', color: primaryColor, fontWeight: 700 }}>{roi.projected_90_days}</td>
                    <td style={{ padding: '12px 8px', color: primaryColor, fontWeight: 700 }}>{roi.projected_6_months}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Why us */}
        {c.why_us && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Why {agencyName}</SectionTitle>
            <Paragraph>{c.why_us}</Paragraph>
          </Card>
        )}

        {/* Next steps */}
        {Array.isArray(c.next_steps) && c.next_steps.length > 0 && (
          <Card primaryColor={primaryColor}>
            <SectionTitle color={primaryColor}>Next Steps</SectionTitle>
            <ol style={{ margin: 0, padding: '0 0 0 24px', fontSize: 15, lineHeight: 1.8 }}>
              {c.next_steps.map((step: string, i: number) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}
            </ol>
          </Card>
        )}

        {/* Accept CTA */}
        <div style={{ marginTop: 40, padding: '40px 32px', background: '#fff', borderRadius: 16, textAlign: 'center', border: `2px solid ${primaryColor}30` }}>
          {accepted ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginBottom: 8 }}>✓ Proposal Accepted</div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>The {agencyName} team has been notified and will be in touch soon.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 8 }}>Ready to move forward?</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Accept the proposal or schedule a call to discuss.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    padding: '14px 32px', borderRadius: 12, border: 'none',
                    background: primaryColor, color: '#fff', fontSize: 15, fontWeight: 800,
                    cursor: accepting ? 'wait' : 'pointer',
                  }}>
                  {accepting ? 'Accepting…' : 'Accept Proposal →'}
                </button>
                {agency?.website && (
                  <a
                    href={agency.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '14px 32px', borderRadius: 12, border: `1.5px solid ${primaryColor}`,
                      background: '#fff', color: primaryColor, fontSize: 15, fontWeight: 800,
                      textDecoration: 'none', display: 'inline-block',
                    }}>
                    Schedule a Call
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: '#9ca3af' }}>
          {agencyName} · This proposal is confidential
        </div>
      </div>
    </div>
  )
}

function Card({ children, primaryColor }: { children: React.ReactNode; primaryColor: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,.04)', borderLeft: `4px solid ${primaryColor}` }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: 1.5, marginBottom: 16 }}>
      {String(children).toUpperCase()}
    </div>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{children}</div>
  )
}

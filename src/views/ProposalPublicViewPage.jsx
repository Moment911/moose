"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'

const C = {
  bg: '#F7F7F6',
  white: '#ffffff',
  text: '#111',
  muted: '#6b7280',
  mutedDark: '#374151',
  border: '#e5e7eb',
  teal: '#00C2CB',
  tealSoft: '#E6FCFD',
  tealDark: '#0E7490',
  amber: '#D97706',
  green: '#16A34A',
}

function money(n) {
  if (n == null || isNaN(n)) return ''
  return `$${Number(n).toLocaleString()}`
}

export default function ProposalPublicViewPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const loadedAtRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals?action=public_view&token=${token}`).then(r => r.json())
      if (res?.error) setError(res.error)
      else {
        setData(res?.data || null)
        loadedAtRef.current = Date.now()
      }
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Track time spent — ping the API on unload with navigator.sendBeacon
  useEffect(() => {
    const onUnload = () => {
      if (!loadedAtRef.current) return
      const durationMs = Date.now() - loadedAtRef.current
      try {
        const blob = new Blob(
          [JSON.stringify({ action: 'track_view_duration', token, duration_ms: durationMs })],
          { type: 'application/json' },
        )
        navigator.sendBeacon?.('/api/proposals', blob)
      } catch { /* best-effort */ }
    }
    window.addEventListener('pagehide', onUnload)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
      window.removeEventListener('beforeunload', onUnload)
      onUnload()
    }
  }, [token])

  if (loading) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={28} className="anim-spin" color={C.teal} />
        </div>
      </FullPage>
    )
  }

  if (error || !data?.proposal) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>Proposal not found</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>
            This proposal link is invalid or has been revoked. Please contact your strategist for a new link.
          </p>
        </div>
      </FullPage>
    )
  }

  const { proposal, sections } = data
  const client = proposal.clients || {}
  const hasSections = Array.isArray(sections) && sections.length > 0

  return (
    <FullPage>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .prop-section { break-inside: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
          }}>
            Proposal
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'var(--font-display)', lineHeight: 1.15,
          }}>
            {proposal.title || 'Untitled Proposal'}
          </h1>
          {client?.name && (
            <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>
              Prepared for <strong style={{ color: C.text }}>{client.name}</strong>
              {client.industry && ` · ${client.industry}`}
            </div>
          )}
        </div>

        {/* Intro block */}
        {proposal.intro && (
          <div style={{
            background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 14,
            padding: '22px 26px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 15, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {proposal.intro}
            </div>
          </div>
        )}

        {/* Executive summary */}
        {proposal.executive_summary && (
          <div className="prop-section" style={{
            background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '24px 28px', marginBottom: 18,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10,
            }}>
              Executive Summary
            </div>
            <div style={{
              fontSize: 15, color: C.mutedDark, lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>
              {proposal.executive_summary}
            </div>
          </div>
        )}

        {/* Sections */}
        {hasSections && sections.map((sec) => (
          <div
            key={sec.id}
            className="prop-section"
            style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: '24px 28px', marginBottom: 18,
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
            }}>
              {sec.section_type || 'Section'}
            </div>
            <h2 style={{
              margin: '2px 0 14px', fontSize: 20, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)',
            }}>
              {sec.title || 'Section'}
            </h2>
            {sec.body && (
              <div style={{
                fontSize: 15, color: C.mutedDark, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>
                {sec.body}
              </div>
            )}
            {sec.price != null && (
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: 'var(--font-display)' }}>
                  {money(sec.price)}
                </span>
                {sec.price_type && (
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {sec.price_type === 'monthly' ? '/ month' : sec.price_type === 'one_time' ? 'one-time' : sec.price_type}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Total value */}
        {proposal.total_value != null && (
          <div className="prop-section" style={{
            background: C.text, color: '#fff', borderRadius: 14,
            padding: '20px 26px', marginBottom: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: C.teal,
            }}>
              Total Investment
            </div>
            <div style={{
              fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)',
            }}>
              {money(proposal.total_value)}
            </div>
          </div>
        )}

        {/* Terms */}
        {proposal.terms && (
          <div className="prop-section" style={{
            background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '24px 28px', marginBottom: 18,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10,
            }}>
              Terms
            </div>
            <div style={{ fontSize: 14, color: C.mutedDark, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {proposal.terms}
            </div>
          </div>
        )}

        {/* Status badge */}
        {proposal.status === 'accepted' && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12,
            padding: '14px 18px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <CheckCircle2 size={18} color={C.green} />
            <div style={{ fontSize: 14, color: '#14532D', fontWeight: 700 }}>
              Accepted {proposal.accepted_at ? `on ${new Date(proposal.accepted_at).toLocaleDateString()}` : ''}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.border}`,
          fontSize: 12, color: C.muted,
        }}>
          Prepared via <strong style={{ color: C.teal }}>Koto</strong> · hellokoto.com
        </div>
      </div>
    </FullPage>
  )
}

function FullPage({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-body)',
    }}>
      <div className="no-print" style={{
        padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: C.white,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, width: 'auto' }} />
        </div>
      </div>
      {children}
    </div>
  )
}

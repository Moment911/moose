"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, FileText, Globe, Sparkles } from 'lucide-react'

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
  blue: '#3A7BD5',
  blueSoft: '#EFF6FF',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
}

const CONFIDENCE_COLORS = {
  confirmed: { bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
  suspected: { bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A' },
  confirm: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  not_detected: { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB' },
}

export default function DiscoverySharedViewPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // 'expired' | 'invalid' | null
  const [data, setData] = useState(null)
  const [activeSection, setActiveSection] = useState(null)

  // Time tracking: sectionId -> seconds spent
  const sectionTimesRef = useRef({})
  const currentSectionRef = useRef(null)
  const currentStartRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/discovery?action=shared&token=${token}`).then(r => r.json())
        if (cancelled) return
        if (res?.error === 'Link expired') {
          setError('expired')
        } else if (res?.error) {
          setError('invalid')
        } else if (res?.data) {
          setData(res.data)
          if (res.data.sections?.[0]) {
            setActiveSection(res.data.sections[0].id)
            currentSectionRef.current = res.data.sections[0].id
            currentStartRef.current = Date.now()
          }
        }
      } catch {
        if (!cancelled) setError('invalid')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) load()
    return () => { cancelled = true }
  }, [token])

  // Track time spent: commit current section's elapsed time when we switch
  const commitSectionTime = useCallback(() => {
    if (!currentSectionRef.current || !currentStartRef.current) return
    const elapsed = Math.max(0, Math.round((Date.now() - currentStartRef.current) / 1000))
    const prev = Number(sectionTimesRef.current[currentSectionRef.current] || 0)
    sectionTimesRef.current[currentSectionRef.current] = prev + elapsed
  }, [])

  // Scroll-spy: detect which section is in view, commit elapsed time on change
  useEffect(() => {
    if (!data) return
    const handler = () => {
      const scrollY = window.scrollY + 200
      let current = currentSectionRef.current
      for (const sec of data.sections || []) {
        const el = document.getElementById(`shared-sec-${sec.id}`)
        if (el && el.offsetTop <= scrollY) current = sec.id
      }
      if (current && current !== currentSectionRef.current) {
        commitSectionTime()
        currentSectionRef.current = current
        currentStartRef.current = Date.now()
        setActiveSection(current)
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [data, commitSectionTime])

  // Send time tracking on unload + periodically (every 30s) in case the
  // user closes the tab unexpectedly
  useEffect(() => {
    if (!data?.view_event_id) return
    const send = () => {
      commitSectionTime()
      if (currentStartRef.current) currentStartRef.current = Date.now()
      const sections = Object.entries(sectionTimesRef.current).map(([section_id, time_spent_seconds]) => ({
        section_id,
        time_spent_seconds,
      }))
      if (sections.length === 0) return
      const payload = JSON.stringify({
        action: 'track_sections',
        token,
        view_event_id: data.view_event_id,
        sections,
      })
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' })
          navigator.sendBeacon('/api/discovery', blob)
        } else {
          fetch('/api/discovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
        }
      } catch { /* silent */ }
    }
    const iv = setInterval(send, 30_000)
    window.addEventListener('beforeunload', send)
    return () => {
      clearInterval(iv)
      window.removeEventListener('beforeunload', send)
      send()
    }
  }, [data, token, commitSectionTime])

  function scrollTo(sectionId) {
    const el = document.getElementById(`shared-sec-${sectionId}`)
    if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={28} className="anim-spin" color={C.teal} />
        </div>
      </FullPage>
    )
  }

  if (error === 'expired') {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>This link has expired</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>Please contact your strategist for a new link.</p>
        </div>
      </FullPage>
    )
  }

  if (error || !data) {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', padding: 50, maxWidth: 480, margin: '0 auto' }}>
          <AlertTriangle size={32} color={C.amber} />
          <h1 style={{ fontSize: 22, color: C.text, margin: '12px 0 8px' }}>Link not found</h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6 }}>This discovery link is invalid or has been revoked.</p>
        </div>
      </FullPage>
    )
  }

  return (
    <FullPage>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .share-section { break-inside: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6,
          }}>
            Discovery Brief
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'var(--font-display)', lineHeight: 1.15,
          }}>
            {data.client_name}
          </h1>
          {data.client_industry && (
            <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>{data.client_industry}</div>
          )}
          {data.recipient_name && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
              Prepared for <strong>{data.recipient_name}</strong>
            </div>
          )}
        </div>

        {/* Exec summary (if present) */}
        {data.executive_summary && (
          <div style={{
            background: C.tealSoft, border: `1px solid ${C.teal}40`, borderRadius: 14,
            padding: '22px 26px', marginBottom: 28,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.tealDark, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8,
            }}>
              Executive Summary
            </div>
            <div style={{ fontSize: 16, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {data.executive_summary}
            </div>
          </div>
        )}

        {/* 2-col: sticky TOC + main */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start' }}>
          <div className="no-print" style={{
            position: 'sticky', top: 16, background: C.white, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: 10, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 10px 8px',
            }}>
              Contents
            </div>
            {(data.sections || []).map(sec => {
              const isActive = activeSection === sec.id
              return (
                <div
                  key={sec.id}
                  onClick={() => scrollTo(sec.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: isActive ? C.tealSoft : 'transparent',
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? C.tealDark : C.text,
                    borderLeft: isActive ? `3px solid ${C.teal}` : '3px solid transparent',
                  }}
                >
                  {sec.title}
                </div>
              )
            })}
          </div>

          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {(data.sections || []).map(sec => {
              const answeredFields = (sec.fields || []).filter(f => (f.answer || '').trim().length > 0)
              if (answeredFields.length === 0 && !sec.has_tech_stack) return null

              return (
                <div
                  key={sec.id}
                  id={`shared-sec-${sec.id}`}
                  className="share-section"
                  style={{
                    background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
                    padding: '24px 28px',
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4,
                  }}>
                    {sec.title}
                  </div>
                  {sec.subtitle && (
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 14 }}>{sec.subtitle}</div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {answeredFields.map(f => (
                      <div key={f.id}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{f.question}</div>
                        <div style={{
                          fontSize: 15, color: C.text, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                        }}>
                          {f.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 50, paddingTop: 24, borderTop: `1px solid ${C.border}`,
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
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <img src="/koto_logo.svg" alt="Koto" style={{ height: 26, width: 'auto' }} />
        </div>
      </div>
      {children}
    </div>
  )
}

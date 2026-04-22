"use client"
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  NAVY, GOLD, CREAM,
  TEXT_BODY, TEXT_MUTED, SUCCESS, WARNING, DANGER,
  CARD_BG, CARD_BORDER,
  FONT_HEADING, FONT_BODY,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// /4r/my-protocol — displays the generated 4R Method protocol.
//
// Tabs: Overview, Phase Plan, Modalities, Schedule
// Anonymous-first: loads protocol by session_id from localStorage.
// ─────────────────────────────────────────────────────────────────────────────

export default function FourrProtocolPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [protocol, setProtocol] = useState(null)
  const [patient, setPatient] = useState(null)
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const sessionId = localStorage.getItem('fourr_session_id')
    if (!sessionId) { navigate('/4r/intake'); return }

    fetch(`/api/fourr/my-protocol?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          if (res.status === 404) { navigate('/4r/intake'); return }
          setError('Could not load your protocol.')
          setLoading(false)
          return
        }
        const body = await res.json().catch(() => ({}))
        setProtocol(body.protocol || null)
        setPatient(body.patient || null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) { setError('Network error.'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [navigate])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_BODY }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: TEXT_BODY, fontSize: 14 }}>
          <Loader2 size={16} style={{ animation: 'fourr-spin 1s linear infinite' }} /> Loading your protocol...
          <style>{`@keyframes fourr-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_BODY }}>
        <div style={{ textAlign: 'center', color: TEXT_BODY }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{error}</p>
          <Link to="/4r/start" style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>Back to start</Link>
        </div>
      </div>
    )
  }

  const assessment = protocol?.assessment
  const phaseRec = protocol?.phase_recommendation
  const patientName = patient?.full_name && patient.full_name !== 'New Patient' ? patient.full_name : null

  return (
    <div style={{ minHeight: '100vh', background: NAVY, fontFamily: FONT_BODY, color: CREAM }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>
            The Spine & Wellness Center
          </div>
          <h1 style={{
            margin: '0 0 8px', fontSize: 30, fontWeight: 400,
            color: CREAM, fontFamily: FONT_HEADING, fontStyle: 'italic',
          }}>
            {patientName ? `${patientName}, Your Assessment Is Complete` : 'Your Assessment Is Complete'}
          </h1>
          <p style={{ margin: '0 auto', fontSize: 15, color: CREAM, lineHeight: 1.6, maxWidth: 520 }}>
            Thank you for taking the time to share your information with us.
            Based on what you've told us, here's a preliminary look at how the
            4R Method may help you. <strong style={{ color: CREAM }}>Dr. Cohen and Dr. Campisi will review
            everything and design a customized plan for you at your first appointment.</strong>
          </p>
        </div>

        {/* Next steps CTA */}
        <Card borderColor={GOLD}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 400, color: CREAM, fontFamily: FONT_HEADING, fontStyle: 'italic' }}>
              What Happens Next
            </h2>
            <div style={{ display: 'grid', gap: 12, maxWidth: 440, margin: '16px auto 0', textAlign: 'left' }}>
              {[
                { num: '1', text: 'Our team will contact you shortly to confirm your first appointment.' },
                { num: '2', text: 'At your visit, the doctors will perform a comprehensive structural assessment.' },
                { num: '3', text: 'They\'ll review your intake and design a personalized 4R protocol tailored to your specific needs.' },
              ].map((step) => (
                <div key={step.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: GOLD + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: GOLD, fontSize: 13, fontWeight: 700,
                  }}>
                    {step.num}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: CREAM, lineHeight: 1.5 }}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Assessment summary */}
        {assessment && (
          <Card title="What We're Seeing">
            {assessment.summary && (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: CREAM, lineHeight: 1.6 }}>
                {assessment.summary}
              </p>
            )}
            {assessment.severity_classification && (
              <Badge label="Severity" value={assessment.severity_classification} />
            )}
          </Card>
        )}

        {/* Phase recommendation */}
        {phaseRec && (
          <Card title="Your Recommended Starting Point">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: GOLD + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: GOLD, fontSize: 20, fontWeight: 700, fontFamily: FONT_HEADING,
              }}>
                {phaseRec.starting_phase || 'R1'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: FONT_HEADING }}>
                  {phaseRec.starting_phase_name || 'Repair'}
                </div>
                <div style={{ fontSize: 13, color: CREAM, fontStyle: 'italic' }}>
                  {phaseRec.starting_phase_subtitle || 'Restore Structural Integrity'}
                </div>
              </div>
            </div>
            {phaseRec.rationale && (
              <p style={{ margin: '0 0 16px', fontSize: 14, color: CREAM, lineHeight: 1.6 }}>
                {phaseRec.rationale}
              </p>
            )}
            <p style={{ margin: 0, fontSize: 12, color: TEXT_BODY, fontStyle: 'italic' }}>
              This is a preliminary recommendation. Your doctors will confirm the right
              starting phase after your in-person structural assessment.
            </p>
          </Card>
        )}

        {/* The 4R journey overview */}
        <Card title="The 4R Journey">
          <p style={{ margin: '0 0 16px', fontSize: 13, color: CREAM, lineHeight: 1.6 }}>
            The 4R Method is a precise biological sequence — each phase builds on the last.
            Your doctors will guide you through each phase at the right pace for your body.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'R1', name: 'Repair', desc: 'Restore structural integrity', freq: '3-5x/week' },
              { id: 'R2', name: 'Rebuild', desc: 'Eliminate the root cause', freq: '2-3x/week' },
              { id: 'R3', name: 'Regenerate', desc: 'Optimize cellular energy', freq: '1-2x/week' },
              { id: 'R4', name: 'Refine', desc: 'Sustain peak expression', freq: '1-2x/month' },
            ].map((phase) => (
              <div key={phase.id} style={{
                padding: '12px 14px', background: NAVY,
                border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 2 }}>
                  {phase.id} — {phase.name}
                </div>
                <div style={{ fontSize: 12, color: CREAM, marginBottom: 4, fontStyle: 'italic' }}>
                  {phase.desc}
                </div>
                <div style={{ fontSize: 11, color: TEXT_BODY }}>{phase.freq}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Your info summary */}
        {patient && (
          <Card title="What You Shared">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {patient.chief_complaint && <InfoRow label="Primary Concern" value={patient.chief_complaint} />}
              {patient.pain_severity && <InfoRow label="Pain Level" value={`${patient.pain_severity} / 10`} />}
              {patient.pain_duration && <InfoRow label="Duration" value={patient.pain_duration} />}
              {patient.age && <InfoRow label="Age" value={patient.age} />}
              {patient.goals && Array.isArray(patient.goals) && (
                <InfoRow label="Goals" value={patient.goals.map(g => g.replace(/_/g, ' ')).join(', ')} />
              )}
            </div>
          </Card>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 24, padding: '16px 20px',
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
          textAlign: 'center', fontSize: 12, color: TEXT_BODY, lineHeight: 1.6,
        }}>
          This assessment is not a medical diagnosis. A licensed Doctor of Chiropractic
          will review your information and develop your personalized protocol at your
          first appointment. If you are experiencing a medical emergency, call 911.
        </div>

        {/* Contact info */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 4 }}>
            4R Method — The Spine & Wellness Center
          </div>
          <div style={{ fontSize: 13, color: TEXT_BODY }}>
            Coral Springs, FL &middot; (954) 341-1200
          </div>
          <a
            href="https://www.4rmethod.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: GOLD, fontWeight: 700, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}
          >
            www.4rmethod.com
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Shared Primitives ─────────────────────────────────────────────────────────

function Card({ title, children, borderColor }) {
  return (
    <section style={{
      background: CARD_BG,
      border: `1px solid ${borderColor || CARD_BORDER}`,
      borderRadius: 12,
      padding: '18px 22px',
      marginBottom: 16,
    }}>
      {title && (
        <h2 style={{
          margin: '0 0 12px',
          fontSize: 13,
          fontWeight: 700,
          color: GOLD,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontSize: 11, color: TEXT_BODY, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: CREAM, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Badge({ label, value }) {
  const color = value === 'acute' ? DANGER
    : value === 'subacute' ? WARNING
    : value === 'chronic' ? GOLD
    : SUCCESS
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: TEXT_MUTED }}>{label}:</span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        padding: '2px 8px',
        background: color + '20',
        color: color,
        borderRadius: 4,
        textTransform: 'capitalize',
      }}>
        {value}
      </span>
    </div>
  )
}

function _EmptyState({ message }) {
  return (
    <div style={{
      padding: '40px 20px',
      textAlign: 'center',
      color: TEXT_MUTED,
      fontSize: 14,
    }}>
      {message}
    </div>
  )
}

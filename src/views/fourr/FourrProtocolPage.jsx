"use client"
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Check, ChevronRight, Calendar, Activity, Zap, Shield, Clock, Star } from 'lucide-react'
import {
  NAVY, NAVY_LIGHT, NAVY_MID, GOLD, GOLD_LIGHT, CREAM, CREAM_DARK, WHITE,
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

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'phases', label: 'Phase Plan', icon: Zap },
    { key: 'modalities', label: 'Modalities', icon: Star },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
  ]

  return (
    <div style={{ minHeight: '100vh', background: NAVY, fontFamily: FONT_BODY }}>
      {/* Header */}
      <header style={{
        padding: '20px 24px 0',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          4R Method Protocol
        </div>
        <h1 style={{
          margin: '6px 0 0',
          fontSize: 28,
          fontWeight: 400,
          color: CREAM,
          fontFamily: FONT_HEADING,
          fontStyle: 'italic',
        }}>
          {patient?.full_name ? `${patient.full_name}'s Protocol` : 'Your Protocol'}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_BODY }}>
          Prepared by the 4R Method AI assessment coordinator for review by your doctors.
        </p>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 2,
          marginTop: 20,
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}>
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                  color: active ? GOLD : TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Tab content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 40px' }}>
        {tab === 'overview' && <OverviewTab protocol={protocol} patient={patient} />}
        {tab === 'phases' && <PhasesTab protocol={protocol} />}
        {tab === 'modalities' && <ModalitiesTab protocol={protocol} />}
        {tab === 'schedule' && <ScheduleTab protocol={protocol} />}
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '16px 24px',
        borderTop: `1px solid ${CARD_BORDER}`,
        textAlign: 'center',
        fontSize: 11,
        color: TEXT_MUTED,
        maxWidth: 900,
        margin: '0 auto',
      }}>
        This is not a medical diagnosis. A licensed Doctor of Chiropractic will review your
        information and develop your personalized protocol. If you are experiencing a medical
        emergency, call 911.
      </div>
    </div>
  )
}

// ── Tab Components ────────────────────────────────────────────────────────────

function OverviewTab({ protocol, patient }) {
  const assessment = protocol?.assessment
  const phaseRec = protocol?.phase_recommendation

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Assessment summary */}
      {assessment && (
        <Card title="Clinical Assessment">
          {assessment.summary && (
            <p style={{ margin: '0 0 12px', fontSize: 14, color: CREAM, lineHeight: 1.6 }}>
              {assessment.summary}
            </p>
          )}
          {assessment.severity_classification && (
            <Badge label="Severity" value={assessment.severity_classification} />
          )}
          {assessment.functional_limitations && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 6 }}>Functional Limitations</div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>
                {Array.isArray(assessment.functional_limitations)
                  ? assessment.functional_limitations.join(', ')
                  : assessment.functional_limitations}
              </p>
            </div>
          )}
          {assessment.structural_concerns && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 6 }}>Structural Concerns</div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>
                {Array.isArray(assessment.structural_concerns)
                  ? assessment.structural_concerns.join(', ')
                  : assessment.structural_concerns}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Red flag alerts */}
      {assessment?.red_flag_alerts && assessment.red_flag_alerts.length > 0 && (
        <Card title="Safety Alerts" borderColor={DANGER}>
          {assessment.red_flag_alerts.map((alert, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: '#3b1111',
              border: '1px solid #7f1d1d',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
              marginBottom: i < assessment.red_flag_alerts.length - 1 ? 8 : 0,
            }}>
              <Shield size={12} style={{ display: 'inline', marginRight: 6 }} />
              {alert}
            </div>
          ))}
        </Card>
      )}

      {/* Phase recommendation summary */}
      {phaseRec && (
        <Card title="Recommended Starting Phase">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: GOLD + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: GOLD,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: FONT_HEADING,
            }}>
              {phaseRec.starting_phase || 'R1'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: CREAM, fontFamily: FONT_HEADING }}>
                {phaseRec.starting_phase_name || 'Repair'}
              </div>
              <div style={{ fontSize: 12, color: TEXT_BODY }}>
                {phaseRec.starting_phase_subtitle || 'Restore Structural Integrity'}
              </div>
            </div>
          </div>
          {phaseRec.rationale && (
            <p style={{ margin: 0, fontSize: 13, color: TEXT_BODY, lineHeight: 1.6, fontStyle: 'italic' }}>
              {phaseRec.rationale}
            </p>
          )}
        </Card>
      )}

      {/* Patient info summary */}
      {patient && (
        <Card title="Your Information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {patient.chief_complaint && <InfoRow label="Chief Complaint" value={patient.chief_complaint} />}
            {patient.pain_severity && <InfoRow label="Pain Severity" value={`${patient.pain_severity}/10`} />}
            {patient.pain_duration && <InfoRow label="Duration" value={patient.pain_duration} />}
            {patient.age && <InfoRow label="Age" value={patient.age} />}
          </div>
        </Card>
      )}
    </div>
  )
}

function PhasesTab({ protocol }) {
  const phaseRec = protocol?.phase_recommendation
  if (!phaseRec?.phases) {
    return <EmptyState message="Phase recommendation not yet generated." />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(Array.isArray(phaseRec.phases) ? phaseRec.phases : []).map((phase, i) => (
        <Card key={i} title={`${phase.phase_id || `R${i + 1}`} — ${phase.name || 'Phase'}`}>
          {phase.description && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>
              {phase.description}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {phase.frequency && <InfoRow label="Frequency" value={phase.frequency} />}
            {phase.duration && <InfoRow label="Duration" value={phase.duration} />}
          </div>
          {phase.rationale && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', lineHeight: 1.55 }}>
              {phase.rationale}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}

function ModalitiesTab({ protocol }) {
  const modPlan = protocol?.modality_plan
  if (!modPlan?.phases) {
    return <EmptyState message="Modality plan not yet generated." />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(Array.isArray(modPlan.phases) ? modPlan.phases : []).map((phase, i) => (
        <Card key={i} title={`${phase.phase_id || `R${i + 1}`} Modalities`}>
          <div style={{ display: 'grid', gap: 10 }}>
            {(phase.modalities || []).map((mod, j) => (
              <div key={j} style={{
                padding: '10px 14px',
                background: NAVY,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: CREAM, marginBottom: 4 }}>
                  {mod.name}
                </div>
                {mod.description && (
                  <div style={{ fontSize: 12, color: TEXT_BODY, lineHeight: 1.5 }}>
                    {mod.description}
                  </div>
                )}
                {mod.frequency && (
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                    <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                    {mod.frequency}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function ScheduleTab({ protocol }) {
  const schedule = protocol?.protocol_schedule
  if (!schedule?.weeks) {
    return <EmptyState message="Protocol schedule not yet generated." />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {schedule.total_estimated_duration && (
        <Card title="Timeline Overview">
          <InfoRow label="Estimated Duration" value={schedule.total_estimated_duration} />
          {schedule.reassessment_points && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 4 }}>Re-evaluation Points</div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_BODY }}>
                {Array.isArray(schedule.reassessment_points)
                  ? schedule.reassessment_points.join(', ')
                  : schedule.reassessment_points}
              </p>
            </div>
          )}
        </Card>
      )}

      {(Array.isArray(schedule.weeks) ? schedule.weeks : []).map((week, i) => (
        <Card key={i} title={`Week ${week.week_number || i + 1}`}>
          {week.focus && (
            <p style={{ margin: '0 0 8px', fontSize: 13, color: CREAM, fontWeight: 600 }}>{week.focus}</p>
          )}
          {week.visits_per_week && <InfoRow label="Visits" value={`${week.visits_per_week}x per week`} />}
          {week.modalities && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(Array.isArray(week.modalities) ? week.modalities : []).map((m, j) => (
                <span key={j} style={{
                  fontSize: 10, padding: '3px 8px',
                  background: GOLD + '15', color: GOLD,
                  borderRadius: 4, fontWeight: 600,
                }}>
                  {m}
                </span>
              ))}
            </div>
          )}
          {week.milestone && (
            <div style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic' }}>
              <Check size={10} style={{ display: 'inline', marginRight: 4 }} />
              {week.milestone}
            </div>
          )}
        </Card>
      ))}
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
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 2 }}>{label}</div>
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

function EmptyState({ message }) {
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

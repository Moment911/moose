"use client"
import { useEffect, useState, useCallback } from 'react'
import { Loader2, ChevronDown, ChevronRight, CheckCircle, Clock, MinusCircle, Mail } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'
import { R, T, BLK, GRN } from '../../lib/theme'

// ---------------------------------------------------------------------------
// /trainer/outreach -- Outreach Tracker
//
// Pick a trainee, then view their full outreach history: emails sent to
// college coaches, response tracking, and the ability to mark responses.
// ---------------------------------------------------------------------------

const BRD = '#e5e7eb'

const STATUS_CONFIG = {
  sent:        { label: 'Sent',        color: '#2563eb', bg: '#dbeafe', icon: Clock },
  responded:   { label: 'Responded',   color: GRN,       bg: '#dcfce7', icon: CheckCircle },
  no_response: { label: 'No Response', color: '#6b7280', bg: '#f3f4f6', icon: MinusCircle },
}

async function recruitingFetch(body) {
  const res = await fetch('/api/trainer/recruiting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function OutreachPage() {
  const { agencyId } = useAuth()
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState('')
  const [outreach, setOutreach] = useState([])
  const [loading, setLoading] = useState(false)
  const [traineesLoading, setTraineesLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState(null)
  const [markingId, setMarkingId] = useState(null)

  // Load trainees list
  useEffect(() => {
    trainerFetch({ action: 'list' }, { agencyId }).then(async (res) => {
      const data = await res.json()
      setTrainees(data.trainees || [])
      setTraineesLoading(false)
    }).catch(() => setTraineesLoading(false))
  }, [agencyId])

  // Load outreach when trainee selected
  const loadOutreach = useCallback(async () => {
    if (!selectedTrainee) { setOutreach([]); return }
    setLoading(true)
    const data = await recruitingFetch({ action: 'outreach_history', trainee_id: selectedTrainee })
    setOutreach(data.outreach || [])
    setLoading(false)
  }, [selectedTrainee])

  useEffect(() => { loadOutreach() }, [loadOutreach])

  async function markResponded(id) {
    setMarkingId(id)
    await recruitingFetch({ action: 'update_outreach', outreach_id: id, status: 'responded', response_received: true, response_date: new Date().toISOString() })
    await loadOutreach()
    setMarkingId(null)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Outreach Tracker</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Track emails sent to college coaches and their responses
          </p>
        </header>

        {/* Trainee picker */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Select Trainee
          </label>
          <select
            value={selectedTrainee}
            onChange={(e) => { setSelectedTrainee(e.target.value); setExpandedRow(null) }}
            disabled={traineesLoading}
            style={{
              padding: '10px 14px', fontSize: 14, border: `1px solid ${BRD}`,
              borderRadius: 8, background: '#fff', color: selectedTrainee ? BLK : '#9ca3af',
              cursor: 'pointer', outline: 'none', minWidth: 280,
            }}
          >
            <option value="">{traineesLoading ? 'Loading trainees...' : 'Choose a trainee...'}</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}{t.sport ? ` -- ${t.sport}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {!selectedTrainee ? (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 60, textAlign: 'center' }}>
            <Mail size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, color: '#9ca3af' }}>Select a trainee to view their outreach history</div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', padding: 40 }}>
            <Loader2 size={16} className="spin" /> Loading outreach...
            <style>{'@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}'}</style>
          </div>
        ) : outreach.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            No outreach emails found for this trainee.
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '110px 1.5fr 1fr 1fr 100px 120px',
              padding: '10px 16px', borderBottom: `1px solid ${BRD}`, background: '#fafafa',
              fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              <span>Date Sent</span>
              <span>School</span>
              <span>Coach</span>
              <span>Template</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            {outreach.map((row) => {
              const isExpanded = expandedRow === row.id
              const status = row.status || (row.response_received ? 'responded' : 'sent')
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.sent
              const StatusIcon = cfg.icon
              const school = row.koto_recruiting_programs?.school_name || '--'
              const coach = row.koto_recruiting_coaches?.full_name || '--'
              const template = row.koto_recruiting_email_templates?.name || '--'

              return (
                <div key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div
                    style={{
                      display: 'grid', gridTemplateColumns: '110px 1.5fr 1fr 1fr 100px 120px',
                      padding: '12px 16px', alignItems: 'center', cursor: 'pointer',
                      transition: 'background .1s',
                    }}
                    onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isExpanded ? <ChevronDown size={12} color="#9ca3af" /> : <ChevronRight size={12} color="#9ca3af" />}
                      {formatDate(row.sent_at)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{school}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{coach}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{template}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: cfg.color,
                      padding: '3px 8px', borderRadius: 10, background: cfg.bg,
                      width: 'fit-content',
                    }}>
                      <StatusIcon size={11} /> {cfg.label}
                    </span>
                    <div>
                      {status !== 'responded' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markResponded(row.id) }}
                          disabled={markingId === row.id}
                          style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 600,
                            border: `1px solid ${GRN}40`, borderRadius: 6,
                            background: GRN + '08', color: GRN,
                            cursor: markingId === row.id ? 'wait' : 'pointer',
                            opacity: markingId === row.id ? 0.5 : 1,
                          }}
                        >
                          {markingId === row.id ? 'Saving...' : 'Mark Responded'}
                        </button>
                      )}
                      {status === 'responded' && row.response_date && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {formatDate(row.response_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded email body */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px 42px', borderTop: '1px solid #f9fafb' }}>
                      {row.subject && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Subject</span>
                          <div style={{ fontSize: 13, fontWeight: 600, color: BLK, marginTop: 2 }}>{row.subject}</div>
                        </div>
                      )}
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Body</span>
                        <div style={{
                          marginTop: 4, padding: '12px 16px', background: '#f9fafb',
                          border: `1px solid ${BRD}`, borderRadius: 8,
                          fontSize: 13, color: '#374151', lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}>
                          {row.body || 'No body content available.'}
                        </div>
                      </div>
                      {row.response_notes && (
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Response Notes</span>
                          <div style={{
                            marginTop: 4, padding: '10px 14px', background: '#dcfce7',
                            border: `1px solid #bbf7d0`, borderRadius: 8,
                            fontSize: 13, color: '#166534', lineHeight: 1.5,
                          }}>
                            {row.response_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </TrainerPortalShell>
  )
}

"use client"
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Loader2, Archive, Users, ClipboardList, Clock, Database, Trash2, Undo2 } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Athletes List — /trainer/athletes
// Cal-AI aesthetic: white bg, #0a0a0a ink, #f1f1f6 card, clean typography.
// ─────────────────────────────────────────────────────────────────────────────

const F    = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const INK  = '#0a0a0a'
const INK2 = '#1f1f22'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const CARD = '#f1f1f6'
const BRD  = '#ececef'
const BLUE = '#5aa0ff'
const GREEN = '#16a34a'
const ACCENT = '#d89a6a'

const STATUS_COLORS = {
  new:              { bg: CARD, color: INK3, border: BRD },
  intake_pending:   { bg: '#eef4ff', color: BLUE, border: '#c7dbff' },
  intake_started:   { bg: '#fef9ec', color: '#b45309', border: '#fde68a' },
  intake_complete:  { bg: CARD, color: INK2, border: BRD },
  plan_generated:   { bg: '#ecfdf5', color: GREEN, border: '#bbf7d0' },
  archived:         { bg: CARD, color: INK4, border: BRD },
}

const STATUS_LABELS = {
  new: 'Awaiting intake',
  intake_pending: 'Awaiting intake',
  intake_started: 'Intake started',
  intake_complete: 'Intake complete',
  plan_generated: 'Plan ready',
  archived: 'Archived',
}

const iconBtnStyle = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#fff', border: `1px solid ${BRD}`, borderRadius: 8,
  color: INK3, cursor: 'pointer', padding: 0, flexShrink: 0,
}

export default function TrainerListPage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const [trainees, setTrainees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [featureDisabled, setFeatureDisabled] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const [actionPending, setActionPending] = useState(null)

  const loadTrainees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await trainerFetch({ action: 'list', archived: showArchived }, { agencyId })
      if (res.status === 404) {
        setFeatureDisabled(true)
        setTrainees([])
        return
      }
      if (!res.ok) {
        setError(`Failed to load athletes (${res.status})`)
        setTrainees([])
        return
      }
      const data = await res.json()
      setTrainees(data.trainees || [])
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [showArchived, agencyId])

  useEffect(() => { loadTrainees() }, [loadTrainees])

  async function handleRowAction(traineeId, action, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setActionPending(traineeId)
    try {
      const res = await trainerFetch({ action, trainee_id: traineeId }, { agencyId })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body?.error || `Failed (${res.status})`)
        return
      }
      await loadTrainees()
    } catch (e) {
      alert(e.message || 'Network error')
    } finally {
      setActionPending(null)
    }
  }

  const totalAthletes = trainees.length
  const activePlans = trainees.filter((t) => t.status === 'plan_generated').length
  const awaitingIntake = trainees.filter((t) => t.status === 'new' || t.status === 'intake_pending').length

  return (
    <TrainerPortalShell>
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: F }}>

        {/* ── Header ── */}
        <div style={{ padding: '32px 40px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.4px' }}>
                Athletes
              </h1>
              <p style={{ margin: '4px 0 0', color: INK3, fontSize: 15, fontWeight: 500 }}>
                {loading ? 'Loading...' : `${totalAthletes} athlete${totalAthletes !== 1 ? 's' : ''} in your program`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="t-press"
                style={{
                  padding: '9px 16px',
                  background: showArchived ? CARD : '#fff',
                  color: showArchived ? INK : INK3,
                  border: `1px solid ${BRD}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: F,
                }}
              >
                <Archive size={14} />
                {showArchived ? 'Showing archived' : 'Show archived'}
              </button>
              <Link
                to="/trainer/new"
                className="t-press"
                style={{
                  padding: '9px 18px',
                  background: INK,
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  fontFamily: F,
                }}
              >
                <Plus size={14} strokeWidth={2.5} /> Add Athlete
              </Link>
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={{ padding: '0 40px 40px' }}>

          {/* ── Stat cards ── */}
          {!featureDisabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
              <StatCard icon={<Users size={18} />} label="Total Athletes" value={loading ? '--' : totalAthletes} accent={BLUE} />
              <StatCard icon={<ClipboardList size={18} />} label="Active Plans" value={loading ? '--' : activePlans} accent={GREEN} />
              <StatCard icon={<Clock size={18} />} label="Awaiting Intake" value={loading ? '--' : awaitingIntake} accent={ACCENT} />
              <StatCard icon={<Database size={18} />} label="Programs in DB" value="549" accent={INK3} />
            </div>
          )}

          {featureDisabled && <FeatureDisabledPanel />}

          {!featureDisabled && loading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              color: INK3, padding: 60, background: CARD, borderRadius: 16,
            }}>
              <Loader2 size={18} className="spin" />
              <span style={{ fontSize: 15, fontWeight: 500 }}>Loading athletes...</span>
            </div>
          )}

          {!featureDisabled && !loading && error && (
            <div style={{
              background: '#fef2f2', color: '#991b1b',
              padding: 16, borderRadius: 12, fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {!featureDisabled && !loading && !error && trainees.length === 0 && (
            <div style={{
              background: CARD, borderRadius: 16, padding: 60, textAlign: 'center',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Users size={22} color={INK3} />
              </div>
              <p style={{ margin: 0, color: INK, fontSize: 15, fontWeight: 600 }}>
                No athletes yet
              </p>
              <p style={{ margin: '8px 0 0', color: INK3, fontSize: 13 }}>
                Click <strong style={{ color: INK }}>Add Athlete</strong> to get started.
              </p>
            </div>
          )}

          {/* ── Athlete cards ── */}
          {!featureDisabled && !loading && !error && trainees.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 80px 1fr 120px 88px',
                padding: '0 20px',
                fontSize: 11,
                fontWeight: 600,
                color: INK4,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: F,
              }}>
                <span>Athlete</span>
                <span>Goal</span>
                <span>Age</span>
                <span>Added</span>
                <span style={{ textAlign: 'right' }}>Status</span>
                <span></span>
              </div>

              {trainees.map((t) => {
                const isHovered = hoveredId === t.id
                const isArchived = !!t.archived_at
                const pending = actionPending === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/trainer/${t.id}`)}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 80px 1fr 120px 88px',
                      alignItems: 'center',
                      padding: '14px 20px',
                      background: isHovered ? CARD : '#fff',
                      border: `1px solid ${BRD}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'background .12s, box-shadow .15s',
                      boxShadow: isHovered ? '0 6px 16px rgba(0,0,0,0.06)' : 'none',
                      opacity: pending ? 0.5 : 1,
                      fontFamily: F,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>
                        {t.full_name}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: INK3, fontWeight: 500 }}>
                      {t.primary_goal || '--'}
                    </div>
                    <div style={{ fontSize: 13, color: INK3, fontWeight: 500 }}>
                      {t.age ?? '--'}
                    </div>
                    <div style={{ fontSize: 13, color: INK4, fontWeight: 500 }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      }) : '--'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusPill status={t.status} />
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'flex-end', gap: 4,
                      opacity: isHovered ? 1 : 0, transition: 'opacity .15s ease',
                    }}>
                      {isArchived ? (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'unarchive') }}
                          disabled={pending} title="Unarchive" style={iconBtnStyle}>
                          <Undo2 size={15} />
                        </button>
                      ) : (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'archive') }}
                          disabled={pending} title="Archive" style={iconBtnStyle}>
                          <Archive size={15} />
                        </button>
                      )}
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'delete', `Delete ${t.full_name} permanently? This wipes their plan, workout logs, and intake data and can't be undone.`) }}
                        disabled={pending} title="Delete permanently"
                        style={{ ...iconBtnStyle, color: '#e9695c', borderColor: '#fecaca' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </TrainerPortalShell>
  )
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{
      background: CARD,
      borderRadius: 16,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ color: accent, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: INK3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 34, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1,
        fontFamily: '"Barlow Condensed", system-ui, sans-serif',
      }}>
        {value}
      </div>
    </div>
  )
}

/* ── Status Pill ── */
function StatusPill({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.intake_complete
  const label = STATUS_LABELS[status] || (status ? status.replace(/_/g, ' ') : 'unknown')
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 999,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {label}
    </span>
  )
}

/* ── Feature Disabled Panel ── */
export function FeatureDisabledPanel() {
  return (
    <div style={{
      background: CARD, borderRadius: 16, padding: 60, textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <Users size={24} color={INK3} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>
        Trainer is not enabled for your agency
      </h2>
      <p style={{ margin: '12px auto 0', color: INK3, fontSize: 15, maxWidth: 480, lineHeight: 1.6, fontWeight: 500 }}>
        Koto Trainer is a premium add-on. Contact your Koto admin to enable the{' '}
        <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: INK }}>
          fitness_coach
        </code>{' '}
        feature flag on your agency.
      </p>
    </div>
  )
}

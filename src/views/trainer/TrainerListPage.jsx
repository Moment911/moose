"use client"
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Loader2, Archive, Users, ClipboardList, Clock, Database, Trash2, Undo2 } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'
import { T_BG, T_SHADOW_SM, T_SHADOW_MD, T_TYPE } from '../../lib/trainer/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Dashboard — /trainer
//
// Premium sports-analytics dashboard. Black/white/grey base with red (#dc2626)
// and blue (#2563eb) accents. Card-based athlete list.
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#dc2626'
const BLUE = '#2563eb'
const BLK = '#111111'
const GRY_TEXT = '#6b7280'
const GRY_BG = T_BG
const BRD = '#e5e7eb'
const WHITE = '#ffffff'

const STATUS_COLORS = {
  new:              { bg: '#eff6ff', color: BLUE, border: '#bfdbfe' },
  intake_pending:   { bg: '#eff6ff', color: BLUE, border: '#bfdbfe' },
  intake_started:   { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  intake_complete:  { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  plan_generated:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  archived:         { bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
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
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
  color: '#6b7280', cursor: 'pointer', padding: 0, flexShrink: 0,
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
  const [actionPending, setActionPending] = useState(null) // trainee_id currently being archived/deleted

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
      <div style={{ minHeight: '100vh', background: GRY_BG }}>

        {/* ── Dark header band ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          padding: '32px 40px 28px',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                margin: 0,
                ...T_TYPE.title1,
                color: WHITE,
              }}>
                Athletes
              </h1>
              <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>
                {loading ? 'Loading...' : `${totalAthletes} athlete${totalAthletes !== 1 ? 's' : ''} in your program`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="t-press"
                style={{
                  padding: '9px 16px',
                  background: showArchived ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                  color: showArchived ? WHITE : '#9ca3af',
                  border: `1px solid ${showArchived ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
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
                  background: RED,
                  color: WHITE,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  boxShadow: `0 1px 2px rgba(220,38,38,0.35), 0 8px 24px rgba(220,38,38,0.18), inset 0 0 0 1px rgba(255,255,255,0.08)`,
                }}
              >
                <Plus size={14} strokeWidth={2.5} /> Add Athlete
              </Link>
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={{ padding: '24px 40px 40px' }}>

          {/* ── Stat cards ── */}
          {!featureDisabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
              <StatCard
                icon={<Users size={18} />}
                label="Total Athletes"
                value={loading ? '--' : totalAthletes}
                accent={BLUE}
                dark
              />
              <StatCard
                icon={<ClipboardList size={18} />}
                label="Active Plans"
                value={loading ? '--' : activePlans}
                accent="#15803d"
              />
              <StatCard
                icon={<Clock size={18} />}
                label="Awaiting Intake"
                value={loading ? '--' : awaitingIntake}
                accent={RED}
              />
              <StatCard
                icon={<Database size={18} />}
                label="Programs in DB"
                value="549"
                accent={GRY_TEXT}
              />
            </div>
          )}

          {featureDisabled && <FeatureDisabledPanel />}

          {!featureDisabled && loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: GRY_TEXT,
              padding: 60,
              background: WHITE,
              borderRadius: 12,
              border: `1px solid ${BRD}`,
            }}>
              <Loader2 size={18} className="spin" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Loading athletes...</span>
            </div>
          )}

          {!featureDisabled && !loading && error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: 16,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {!featureDisabled && !loading && !error && trainees.length === 0 && (
            <div style={{
              background: WHITE,
              border: `1px solid ${BRD}`,
              borderRadius: 12,
              padding: 60,
              textAlign: 'center',
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#f3f4f6',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Users size={22} color={GRY_TEXT} />
              </div>
              <p style={{ margin: 0, color: BLK, fontSize: 15, fontWeight: 600 }}>
                No athletes yet
              </p>
              <p style={{ margin: '8px 0 0', color: GRY_TEXT, fontSize: 13 }}>
                Click <strong style={{ color: RED }}>Add Athlete</strong> to get started.
              </p>
            </div>
          )}

          {/* ── Athlete cards ── */}
          {!featureDisabled && !loading && !error && trainees.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 80px 1fr 120px 88px',
                padding: '0 20px',
                fontSize: 11,
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
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
                      padding: '16px 20px',
                      background: WHITE,
                      border: `1px solid ${isHovered ? '#d1d5db' : BRD}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'transform 160ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease, border-color 120ms ease',
                      boxShadow: isHovered ? T_SHADOW_MD : T_SHADOW_SM,
                      transform: isHovered ? 'translateY(-1px)' : 'none',
                      opacity: pending ? 0.5 : 1,
                    }}
                  >
                    {/* Name */}
                    <div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: BLK,
                        letterSpacing: '-0.01em',
                      }}>
                        {t.full_name}
                      </div>
                    </div>

                    {/* Goal */}
                    <div style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
                      {t.primary_goal || '--'}
                    </div>

                    {/* Age */}
                    <div style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
                      {t.age ?? '--'}
                    </div>

                    {/* Created */}
                    <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }) : '--'}
                    </div>

                    {/* Status */}
                    <div style={{ textAlign: 'right' }}>
                      <StatusPill status={t.status} />
                    </div>

                    {/* Actions — archive/unarchive + delete, shown on hover */}
                    <div
                      style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 4,
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity .15s ease',
                      }}
                    >
                      {isArchived ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'unarchive') }}
                          disabled={pending}
                          title="Unarchive"
                          style={iconBtnStyle}
                        >
                          <Undo2 size={15} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'archive') }}
                          disabled={pending}
                          title="Archive"
                          style={iconBtnStyle}
                        >
                          <Archive size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRowAction(t.id, 'delete', `Delete ${t.full_name} permanently? This wipes their plan, workout logs, and intake data and can't be undone.`) }}
                        disabled={pending}
                        title="Delete permanently"
                        style={{ ...iconBtnStyle, color: '#dc2626', borderColor: '#fecaca' }}
                      >
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
function StatCard({ icon, label, value, accent, dark }) {
  return (
    <div style={{
      background: dark ? 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)' : WHITE,
      border: `1px solid ${dark ? '#2a2a2a' : BRD}`,
      borderRadius: 12,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle accent line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accent,
        opacity: 0.8,
        borderRadius: '12px 12px 0 0',
      }} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          color: accent,
          display: 'flex',
          alignItems: 'center',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: dark ? '#9ca3af' : GRY_TEXT,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 800,
        color: dark ? WHITE : BLK,
        letterSpacing: '-0.02em',
        lineHeight: 1,
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
      borderRadius: 20,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.01em',
    }}>
      {label}
    </span>
  )
}

/* ── Feature Disabled Panel (exported for use by other files) ── */
export function FeatureDisabledPanel() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BRD}`,
      borderRadius: 12,
      padding: 60,
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: '#f3f4f6',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Users size={24} color={GRY_TEXT} />
      </div>
      <h2 style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        color: BLK,
        letterSpacing: '-0.01em',
      }}>
        Trainer is not enabled for your agency
      </h2>
      <p style={{
        margin: '12px auto 0',
        color: GRY_TEXT,
        fontSize: 14,
        maxWidth: 480,
        lineHeight: 1.6,
      }}>
        Koto Trainer is a premium add-on. Contact your Koto admin to enable the{' '}
        <code style={{
          background: '#f3f4f6',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          color: BLK,
        }}>
          fitness_coach
        </code>{' '}
        feature flag on your agency.
      </p>
    </div>
  )
}

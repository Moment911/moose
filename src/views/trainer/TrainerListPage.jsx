"use client"
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Loader2, Archive } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { R, T, BLK, GRY, GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 03 — /trainer list page.
//
// Lists trainees for the session's agency via POST /api/trainer/trainees
// action=list.  404 → feature disabled (API gate).  Click row → detail page.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const BRD_LT = '#f3f4f6'

const STATUS_COLORS = {
  intake_complete: { bg: '#f0fbfc', color: T },
  plan_generated: { bg: '#f0fdf4', color: GRN },
  archived: { bg: '#f9fafb', color: '#6b7280' },
}

export default function TrainerListPage() {
  const navigate = useNavigate()
  const [trainees, setTrainees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [featureDisabled, setFeatureDisabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await trainerFetch({ action: 'list', archived: showArchived })
        if (cancelled) return
        if (res.status === 404) {
          setFeatureDisabled(true)
          setTrainees([])
          return
        }
        if (!res.ok) {
          setError(`Failed to load trainees (${res.status})`)
          setTrainees([])
          return
        }
        const data = await res.json()
        setTrainees(data.trainees || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [showArchived])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>Trainer</h1>
            <p style={{ margin: '6px 0 0', color: GRY, fontSize: 14 }}>
              Manage trainees and their coaching plans
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowArchived((v) => !v)}
              style={{
                padding: '8px 14px',
                background: showArchived ? T + '10' : '#fff',
                color: showArchived ? T : '#4b5563',
                border: `1px solid ${showArchived ? T : BRD}`,
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
              style={{
                padding: '8px 16px',
                background: R,
                color: '#fff',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} /> Add trainee
            </Link>
          </div>
        </header>

        {featureDisabled && <FeatureDisabledPanel />}

        {!featureDisabled && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRY, padding: 40 }}>
            <Loader2 size={16} className="spin" />
            Loading trainees…
          </div>
        )}

        {!featureDisabled && !loading && error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: 14,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!featureDisabled && !loading && !error && trainees.length === 0 && (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, padding: 40, textAlign: 'center' }}>
            <p style={{ margin: 0, color: GRY, fontSize: 14 }}>
              No trainees yet. Click <strong style={{ color: BLK }}>Add trainee</strong> to get started.
            </p>
          </div>
        )}

        {!featureDisabled && !loading && !error && trainees.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: `1px solid ${BRD}` }}>
                  <Th>Name</Th>
                  <Th>Goal</Th>
                  <Th>Age</Th>
                  <Th>Days/wk</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {trainees.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/trainer/${t.id}`)}
                    style={{
                      borderBottom: `1px solid ${BRD_LT}`,
                      cursor: 'pointer',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <Td bold>{t.full_name}</Td>
                    <Td>{t.primary_goal || '—'}</Td>
                    <Td>{t.age ?? '—'}</Td>
                    <Td>{t.training_days_per_week ?? '—'}</Td>
                    <Td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</Td>
                    <Td>
                      <StatusPill status={t.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function Th({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {children}
    </th>
  )
}

function Td({ children, bold }) {
  return <td style={{ padding: '12px 14px', fontSize: 13, color: BLK, fontWeight: bold ? 600 : 400 }}>{children}</td>
}

function StatusPill({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.intake_complete
  const label = status ? status.replace(/_/g, ' ') : 'unknown'
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  )
}

export function FeatureDisabledPanel() {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${BRD}`,
        borderRadius: 10,
        padding: 40,
        textAlign: 'center',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: BLK }}>Trainer is not enabled for your agency</h2>
      <p style={{ margin: '12px 0 0', color: GRY, fontSize: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
        Koto Trainer is a premium add-on. Contact your Koto admin to enable the <code>fitness_coach</code> feature flag on your agency.
      </p>
    </div>
  )
}

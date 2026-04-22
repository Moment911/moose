"use client"
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, Undo2, Loader2, Sparkles } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { cmToFeetInches, kgToLbs } from '../../lib/trainer/units'
import { R, T, BLK, GRY } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 03 — /trainer/:traineeId stub.
//
// CONTEXT intentional non-goal for Phase 1: this page is a stub.  Phase 2
// fills in the plan view (baseline / workout / meals / grocery / adjust).
// Phase 1 delivers just enough to:
//   - Show intake summary
//   - Archive / Unarchive the trainee
//   - Signal "Plan generation lands in Phase 2" via a disabled Generate Plan
//     button so the operator expects the next upgrade, not broken UX.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'

export default function TrainerDetailPage() {
  const { traineeId } = useParams()
  const navigate = useNavigate()
  const [trainee, setTrainee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [featureDisabled, setFeatureDisabled] = useState(false)

  async function callAction(action) {
    setActionPending(true)
    try {
      const res = await trainerFetch({ action, trainee_id: traineeId })
      if (res.status === 404 && (await res.clone().json().catch(() => ({}))).error === 'Not found') {
        // Either cross-agency or feature-disabled. Navigate back to list.
        navigate('/trainer')
        return
      }
      if (!res.ok) {
        setError(`${action} failed (${res.status})`)
        return
      }
      await load()
    } finally {
      setActionPending(false)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await trainerFetch({ action: 'get', trainee_id: traineeId })
      if (res.status === 404) {
        // Could be feature disabled OR trainee not found. Show a generic panel;
        // the list page distinguishes the cases more clearly.
        setFeatureDisabled(true)
        return
      }
      if (!res.ok) {
        setError(`Failed to load trainee (${res.status})`)
        return
      }
      const data = await res.json()
      setTrainee(data.trainee)
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px' }}>
        <Link
          to="/trainer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginBottom: 16 }}
        >
          <ArrowLeft size={14} /> Back to trainees
        </Link>

        {featureDisabled && <FeatureDisabledPanel />}

        {!featureDisabled && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRY, padding: 40 }}>
            <Loader2 size={16} /> Loading trainee…
          </div>
        )}

        {!featureDisabled && !loading && error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14, borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!featureDisabled && !loading && trainee && (
          <>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>{trainee.full_name}</h1>
                <p style={{ margin: '6px 0 0', color: GRY, fontSize: 14 }}>
                  {trainee.primary_goal || 'no goal set'} · created{' '}
                  {trainee.created_at ? new Date(trainee.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {trainee.archived_at ? (
                  <button onClick={() => callAction('unarchive')} disabled={actionPending} style={btnSecondary}>
                    <Undo2 size={14} /> Unarchive
                  </button>
                ) : (
                  <button onClick={() => callAction('archive')} disabled={actionPending} style={btnSecondary}>
                    <Archive size={14} /> Archive
                  </button>
                )}
              </div>
            </header>

            <section style={panelStyle}>
              <h2 style={panelTitle}>Intake</h2>
              <Row k="Email" v={trainee.email} />
              <Row k="Phone" v={trainee.phone} />
              <Row k="Age" v={trainee.age} />
              <Row k="Sex" v={trainee.sex} />
              <Row k="Height" v={trainee.height_cm ? cmToFeetInches(trainee.height_cm) : null} />
              <Row k="Weight" v={trainee.current_weight_kg ? `${kgToLbs(trainee.current_weight_kg)} lbs` : null} />
              <Row k="Target weight" v={trainee.target_weight_kg ? `${kgToLbs(trainee.target_weight_kg)} lbs` : null} />
              <Row k="Training days/week" v={trainee.training_days_per_week} />
              <Row k="Equipment" v={trainee.equipment_access} />
              <Row k="Dietary preference" v={trainee.dietary_preference} />
              <Row k="Allergies" v={trainee.allergies} />
              <Row k="Meals per day" v={trainee.meals_per_day} />
              <Row k="Medical flags" v={trainee.medical_flags} />
              <Row k="Injuries" v={trainee.injuries} />
              <Row k="Trainer notes" v={trainee.trainer_notes} />
            </section>

            <section style={{ ...panelStyle, background: '#fafafa' }}>
              <h2 style={panelTitle}>Plan</h2>
              <p style={{ color: GRY, fontSize: 14, margin: '0 0 14px' }}>
                Plan generation lands in Phase 2 (baseline + 2-week workout + meals + grocery + adjust-from-progress).
              </p>
              <button disabled style={{ ...btnPrimary, opacity: 0.5, cursor: 'not-allowed' }}>
                <Sparkles size={14} /> Generate plan · coming in Phase 2
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

const panelStyle = {
  background: '#fff',
  border: `1px solid ${BRD}`,
  borderRadius: 10,
  padding: 24,
  marginBottom: 18,
}
const panelTitle = { margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: T, letterSpacing: '.04em', textTransform: 'uppercase' }

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: R,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: '#fff',
  color: '#4b5563',
  border: `1px solid ${BRD}`,
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

function Row({ k, v }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: GRY, fontWeight: 600 }}>{k}</span>
      <span style={{ color: BLK }}>{String(v)}</span>
    </div>
  )
}

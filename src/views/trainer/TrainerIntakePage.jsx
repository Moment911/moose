"use client"
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import IntakeForm from '../../components/trainer/IntakeForm'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'
import { T, BLK, GRY } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 1 Plan 03 — /trainer/new intake page.
//
// Thin wrapper: renders IntakeForm, POSTs to /api/trainer/trainees action=create,
// redirects to /trainer on success.  404 response → feature disabled panel.
// ─────────────────────────────────────────────────────────────────────────────

export default function TrainerIntakePage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [topError, setTopError] = useState(null)
  const [featureDisabled, setFeatureDisabled] = useState(false)

  async function handleSubmit(values) {
    setSubmitting(true)
    setTopError(null)
    try {
      const res = await trainerFetch({ action: 'create', ...values }, { agencyId })
      if (res.status === 404) {
        setFeatureDisabled(true)
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          body.field_errors
            ? 'Server rejected one or more fields. Scroll up to review.'
            : body.error || `Save failed (${res.status})`
        setTopError(msg)
        return
      }
      navigate('/trainer')
    } catch (e) {
      setTopError(e.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

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
        <h1 style={{ margin: 0, fontSize: 28, color: BLK }}>New trainee</h1>
        <p style={{ margin: '6px 0 28px', color: GRY, fontSize: 14 }}>
          Fill in what you know. You can come back and add more later.
        </p>

        {featureDisabled ? (
          <FeatureDisabledPanel />
        ) : (
          <IntakeForm onSubmit={handleSubmit} submitting={submitting} topError={topError} />
        )}
      </main>
    </div>
  )
}

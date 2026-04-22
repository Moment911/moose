"use client"
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Link2 } from 'lucide-react'
import TrainerPortalShell from '../../components/trainer/TrainerPortalShell'
import { FeatureDisabledPanel } from './TrainerListPage'
import { trainerFetch } from '../../lib/trainer/trainerFetch'
import { useAuth } from '../../hooks/useAuth'
import { T, BLK, GRY, R } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/new — simplified "Add Trainee" form.
//
// Just name + email + phone.  Creates the trainee row, then shows the unique
// intake link the trainer can send.  The trainee fills out the full profile
// themselves via the conversational chat at /intake/:traineeId.
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'

export default function TrainerIntakePage() {
  const navigate = useNavigate()
  const { agencyId } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [featureDisabled, setFeatureDisabled] = useState(false)
  const [created, setCreated] = useState(null) // { trainee_id, full_name }

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await trainerFetch({
        action: 'create',
        full_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        about_you: 'Pending — trainee will complete intake via chat.',
      }, { agencyId })
      if (res.status === 404) { setFeatureDisabled(true); return }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || body?.field_errors?.full_name || `Save failed (${res.status})`)
        return
      }
      setCreated({ trainee_id: body.trainee_id || body.id, full_name: name.trim() })
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TrainerPortalShell>
      <div style={{ padding: '32px 40px' }}>
        <Link to="/trainer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back to trainees
        </Link>

        {featureDisabled ? <FeatureDisabledPanel /> : created ? (
          <CreatedSuccess traineeId={created.trainee_id} name={created.full_name} onAnother={() => { setCreated(null); setName(''); setEmail(''); setPhone('') }} />
        ) : (
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 28, color: BLK }}>Add trainee</h1>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
              Just the basics — your trainee will fill out the rest via a personalized chat intake.
            </p>

            <form onSubmit={handleSubmit} style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 12, padding: '24px 24px 20px' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <Field label="Name *">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus style={inputStyle} />
                </Field>
                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainee@email.com" style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle} />
                </Field>
              </div>

              {error && (
                <div style={{ marginTop: 14, padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitting} style={{
                marginTop: 20, width: '100%', padding: '12px 16px',
                background: R, color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}>
                {submitting ? 'Creating...' : 'Create trainee'}
              </button>
            </form>
          </div>
        )}
      </div>
    </TrainerPortalShell>
  )
}

function CreatedSuccess({ traineeId, name, onAnother }) {
  const [copied, setCopied] = useState(false)
  const intakeUrl = `${window.location.origin}/intake/${traineeId}`

  function handleCopy() {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, color: BLK }}>Trainee created</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
        <strong>{name}</strong> is ready. Send them the intake link below — they'll chat with the AI coach and fill out their full profile.
      </p>

      <div style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Intake link
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={intakeUrl} readOnly style={{
            flex: 1, padding: '10px 12px', fontSize: 13, color: '#374151',
            border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb',
            fontFamily: 'monospace', outline: 'none',
          }} onClick={(e) => e.target.select()} />
          <button onClick={handleCopy} style={{
            padding: '10px 14px', borderRadius: 8, border: `1px solid ${copied ? '#059669' : '#e5e7eb'}`,
            background: copied ? '#ecfdf5' : '#fff', color: copied ? '#059669' : '#374151',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            {copied ? <><Copy size={13} /> Copied!</> : <><Link2 size={13} /> Copy link</>}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
          When they open this link, they'll write about themselves and chat with the AI coach. You'll see their progress on the trainer dashboard in real time.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onAnother} style={{
          padding: '10px 16px', background: '#fff', color: '#374151',
          border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Add another trainee
        </button>
        <Link to={`/trainer/${traineeId}`} style={{
          padding: '10px 16px', background: T, color: '#fff',
          borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center',
        }}>
          View trainee
        </Link>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid #d1d5db', borderRadius: 8,
  background: '#fff', color: '#0a0a0a', fontFamily: 'inherit',
  outline: 'none',
}

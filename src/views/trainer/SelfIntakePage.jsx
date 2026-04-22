"use client"
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import IntakeForm from '../../components/trainer/IntakeForm'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import { T, BLK, GRY, R } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /my-intake — self-service intake for a signed-in trainee.
//
// Flow:
//   1. Require an auth'd Supabase session; bounce to /start if missing.
//   2. If the user already has a trainee mapping, redirect to /my-plan.
//   3. Render the existing IntakeForm (same component trainers use).
//   4. On submit, POST /api/trainer/self-signup with Bearer token.  Server
//      provisions the trainee row + mapping AND synchronously generates the
//      core plan chain (baseline → roadmap → workout → playbook, ~60-90s).
//   5. During generation show a progress screen — the chain is blocking on
//      the server so we just show an honest "this takes about a minute" UI.
//   6. On success redirect to /my-plan with the freshly generated content.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'

export default function SelfIntakePage() {
  const navigate = useNavigate()
  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [submitting, setSubmitting] = useState(false)
  const [topError, setTopError] = useState(null)
  const [progress, setProgress] = useState(null) // 'creating' | 'generating' | 'done'

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) {
        navigate('/start')
        return
      }
      // Existing trainee? → skip to plan.
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (mapping) {
        navigate('/my-plan')
        return
      }
      setSessionState({ loading: false, user })
    })
    return () => { cancelled = true }
  }, [navigate])

  async function handleSubmit(values) {
    setSubmitting(true)
    setTopError(null)
    setProgress('creating')
    try {
      // Default the full_name from supabase user_metadata if the form didn't
      // collect one (the IntakeForm requires it, so this is belt-and-braces).
      const payload = { ...values }
      if (!payload.full_name && sessionState.user?.user_metadata?.full_name) {
        payload.full_name = sessionState.user.user_metadata.full_name
      }
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        setTopError('Your session expired. Sign in again.')
        setTimeout(() => navigate('/start'), 1200)
        return
      }
      setProgress('generating')
      const res = await fetch('/api/trainer/self-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intake: payload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error === 'intake_incomplete'
          ? `Finish the intake: ${(body.missing_fields || []).join(', ')}`
          : body?.error || `Save failed (${res.status})`
        setTopError(msg)
        setProgress(null)
        return
      }
      setProgress('done')
      navigate('/my-plan')
    } catch (err) {
      setTopError(err?.message || 'Network error during setup.')
      setProgress(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionState.loading) {
    return <CenteredSpinner label="Loading your account…" />
  }

  if (progress === 'generating') {
    return <GeneratingScreen />
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '32px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: GRY, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Step 2 of 2
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            Tell us about yourself
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: GRY }}>
            Every question below shapes your plan. Finish them all — the AI reads every field.
          </p>
        </header>

        <TrainerWelcomeCard compact />

        <IntakeForm onSubmit={handleSubmit} submitting={submitting} topError={topError} />

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: GRY }}>
          <Link to="/start" style={{ color: T, textDecoration: 'none', fontWeight: 700 }}>← Back</Link>
        </div>
      </div>
    </div>
  )
}

function CenteredSpinner({ label }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: GRY, fontSize: 14 }}>
        <Loader2 size={16} /> {label}
      </div>
    </div>
  )
}

function GeneratingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '40px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '32px 28px', textAlign: 'center' }}>
        <div
          style={{
            width: 48, height: 48, margin: '0 auto 20px',
            border: `4px solid #f3f4f6`,
            borderTopColor: R,
            borderRadius: '50%',
            animation: 'kotoSelfSignupSpin 0.9s linear infinite',
          }}
        />
        <style>{'@keyframes kotoSelfSignupSpin{to{transform:rotate(360deg)}}'}</style>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
          Crafting your plan
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: GRY, lineHeight: 1.55 }}>
          Your baseline, 90-day roadmap, 2-week workout block, and coaching playbook
          are generating now. This takes about a minute — don't close this tab.
        </p>
        <ul style={{ textAlign: 'left', margin: '0 auto', paddingLeft: 20, fontSize: 12, color: GRY, lineHeight: 1.9, maxWidth: 360 }}>
          <li>Reading your intake + about-you in full</li>
          <li>Calorie + macro targets + training readiness</li>
          <li>3 × 30-day phases with measurable milestones</li>
          <li>2-week trackable workout block, exercise-by-exercise</li>
          <li>Coaching playbook — supplements, travel, recovery, scenarios</li>
        </ul>
      </div>
    </div>
  )
}

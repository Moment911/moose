"use client"
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { validateIntake } from '../../lib/trainer/intakeSchema'
import { REQUIRED_INTAKE_FIELDS, missingIntakeFields } from '../../lib/trainer/intakeCompleteness'
import IntakeChatWidget from '../../components/trainer/IntakeChatWidget'
import IntakeLiveCard from '../../components/trainer/IntakeLiveCard'
// Cal-AI tokens
const R = '#e9695c'
const T = '#5aa0ff'
const BLK = '#0a0a0a'
const GRY = '#f1f1f6'

// ─────────────────────────────────────────────────────────────────────────────
// /my-intake — conversational chat intake.
//
//   Left panel:  IntakeChatWidget — AI asks questions one at a time, streams
//                responses, extracts fields on every turn.
//   Right panel: IntakeLiveCard — real-time field display with progress bar.
//                "Generate my plan" button enables when all 17 fields filled.
//
//   On generate → POST /api/trainer/self-signup → /my-plan.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'

export default function SelfIntakePage() {
  const navigate = useNavigate()

  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [phase, setPhase] = useState('chat') // 'chat' | 'generating'

  // Accumulated intake fields from conversation.
  const [extracted, setExtracted] = useState({})
  const [aboutYou, setAboutYou] = useState('')

  const [generateError, setGenerateError] = useState(null)

  // Auth gate — bounce to /start if not logged in, /my-plan if already signed up.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) { navigate('/start'); return }
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (mapping) { navigate('/my-plan'); return }
      setSessionState({ loading: false, user })
      // Pre-fill name from auth metadata.
      const name = user.user_metadata?.full_name
      if (name) setExtracted((prev) => ({ ...prev, full_name: name }))
    })
    return () => { cancelled = true }
  }, [navigate])

  // Merge field updates from the chat widget.
  const handleFieldsUpdate = useCallback((fields) => {
    setExtracted((prev) => {
      const next = { ...prev }
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null && v !== '') {
          next[k] = v
        }
      }
      return next
    })
  }, [])

  // Append to the running about_you narrative.
  const handleAboutYouAppend = useCallback((text) => {
    if (!text || !text.trim()) return
    setAboutYou((prev) => {
      if (!prev) return text.trim()
      return prev + ' ' + text.trim()
    })
  }, [])

  // Generate the plan — POST to /api/trainer/self-signup.
  async function handleGenerate() {
    setGenerateError(null)

    const payload = {
      ...extracted,
      about_you: aboutYou || extracted.about_you || '',
      full_name: extracted.full_name || sessionState.user?.user_metadata?.full_name || 'New athlete',
    }

    const validation = validateIntake(payload)
    if (!validation.ok) {
      const firstErr = Object.values(validation.errors)[0]
      setGenerateError(firstErr || 'Validation failed — check your answers.')
      return
    }
    const missing = missingIntakeFields(validation.data)
    if (missing.length > 0) {
      setGenerateError(`Still missing: ${missing.join(', ')}.`)
      return
    }

    setPhase('generating')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        setGenerateError('Session expired.')
        setPhase('chat')
        setTimeout(() => navigate('/start'), 1200)
        return
      }
      const res = await fetch('/api/trainer/self-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intake: validation.data }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body?.error === 'intake_incomplete' && Array.isArray(body.missing_fields)) {
          setGenerateError(`Still missing: ${body.missing_fields.join(', ')}.`)
        } else {
          setGenerateError(body?.error || `Save failed (${res.status})`)
        }
        setPhase('chat')
        return
      }
      navigate('/my-plan')
    } catch (err) {
      setGenerateError(err?.message || 'Network error during setup.')
      setPhase('chat')
    }
  }

  const missing = missingIntakeFields(extracted)

  if (sessionState.loading) return <CenteredSpinner label="Loading your account..." />

  if (phase === 'generating') return <GeneratingScreen />

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
            Tell us about you
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Chat with your coach — your profile builds itself as you go.
          </p>
        </header>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* Left: Chat */}
          <IntakeChatWidget
            extracted={extracted}
            onFieldsUpdate={handleFieldsUpdate}
            onAboutYouAppend={handleAboutYouAppend}
            userName={extracted.full_name || sessionState.user?.user_metadata?.full_name || ''}
          />

          {/* Right: Live card */}
          <div style={{ position: 'sticky', top: 24 }}>
            <IntakeLiveCard
              extracted={extracted}
              missingFields={missing}
              onGenerate={handleGenerate}
              generating={phase === 'generating'}
              generateError={generateError}
            />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#6b7280' }}>
          <Link to="/start" style={{ color: T, textDecoration: 'none', fontWeight: 700 }}>
            ← Back
          </Link>
        </div>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Progress screens ───────────────────────────────────────────────────────

function CenteredSpinner({ label }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 14 }}>
        <Loader2 size={16} /> {label}
      </div>
    </div>
  )
}

function GeneratingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <section style={{ background: '#fff', border: '1px solid #ececef', borderRadius: 12, padding: '32px 28px', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 20px', border: '4px solid #f1f1f6', borderTopColor: R, borderRadius: '50%', animation: 'kotoGenerateSpin 0.9s linear infinite' }} />
        <style>{'@keyframes kotoGenerateSpin{to{transform:rotate(360deg)}}'}</style>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>Crafting your plan</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6b7280', lineHeight: 1.55 }}>
          Your baseline, 90-day roadmap, 2-week workout block, and coaching playbook are
          generating now. This takes about a minute — don't close this tab.
        </p>
        <ul style={{ textAlign: 'left', margin: '0 auto', paddingLeft: 20, fontSize: 12, color: '#6b7280', lineHeight: 1.9, maxWidth: 360 }}>
          <li>Calorie + macro targets + training readiness</li>
          <li>3 x 30-day phases with measurable milestones</li>
          <li>2-week trackable workout block</li>
          <li>Coaching playbook — supplements, travel, recovery, scenarios</li>
        </ul>
      </section>
    </div>
  )
}

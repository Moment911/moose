"use client"
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { validateIntake } from '../../lib/trainer/intakeSchema'
import { REQUIRED_INTAKE_FIELDS, missingIntakeFields } from '../../lib/trainer/intakeCompleteness'
import IntakeChatWidget from '../../components/trainer/IntakeChatWidget'
import IntakeLiveCard from '../../components/trainer/IntakeLiveCard'
import TrainerFooter from '../../components/trainer/TrainerFooter'

// ─────────────────────────────────────────────────────────────────────────────
// /my-intake — conversational chat intake (Cal-AI restyle).
// ─────────────────────────────────────────────────────────────────────────────

// Same constant as ComplianceGatePage. Bumping there means anyone with a
// stale signature gets routed back through the gate.
const WAIVER_TEXT_VERSION = 1

function hasCurrentWaiver(user) {
  const c = user?.user_metadata?.compliance
  return !!(c?.waiver_accepted_at && (c.waiver_text_version ?? 0) >= WAIVER_TEXT_VERSION)
}

// Cal-AI tokens
const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const ACCENT = '#d89a6a'
const BRD = '#ececef'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const BG = '#ffffff'

// ── localStorage helpers for intake progress persistence ───────────────────
const LS_KEY_EXTRACTED = 'koto_intake_extracted'
const LS_KEY_ABOUT = 'koto_intake_about'
const LS_KEY_MESSAGES = 'koto_intake_messages'

function loadLS(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}
function clearIntakeLS() {
  try { localStorage.removeItem(LS_KEY_EXTRACTED); localStorage.removeItem(LS_KEY_ABOUT); localStorage.removeItem(LS_KEY_MESSAGES) } catch {}
}

export default function SelfIntakePage() {
  const navigate = useNavigate()

  const [sessionState, setSessionState] = useState({ loading: true, user: null })
  const [phase, setPhase] = useState('chat') // 'chat' | 'generating'

  // Accumulated intake fields from conversation — restored from localStorage.
  const [extracted, setExtracted] = useState(() => loadLS(LS_KEY_EXTRACTED) || {})
  const [aboutYou, setAboutYou] = useState(() => loadLS(LS_KEY_ABOUT) || '')
  const [savedMessages, setSavedMessages] = useState(() => loadLS(LS_KEY_MESSAGES) || [])

  const [generateError, setGenerateError] = useState(null)

  // Persist extracted fields to localStorage on every change
  useEffect(() => { saveLS(LS_KEY_EXTRACTED, extracted) }, [extracted])
  useEffect(() => { saveLS(LS_KEY_ABOUT, aboutYou) }, [aboutYou])

  // Auth gate — bounce to /start if not logged in, the consent gate if the
  // user hasn't accepted the current-version waiver, or /my-plan if they
  // already have a trainee record.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) { navigate('/start'); return }
      if (!hasCurrentWaiver(user)) { navigate('/start/consent'); return }
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (mapping) { clearIntakeLS(); navigate('/my-plan'); return }
      setSessionState({ loading: false, user })
      // Pre-fill name from auth metadata (only if not already restored from LS)
      const name = user.user_metadata?.full_name
      if (name && !extracted.full_name) setExtracted((prev) => ({ ...prev, full_name: name }))
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

  // Persist chat messages to localStorage so the conversation survives navigation
  const handleMessagesChange = useCallback((msgs) => {
    setSavedMessages(msgs)
    saveLS(LS_KEY_MESSAGES, msgs)
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
        if (body?.error === 'consent_required') {
          navigate('/start/consent')
          return
        }
        if (body?.error === 'intake_incomplete' && Array.isArray(body.missing_fields)) {
          setGenerateError(`Still missing: ${body.missing_fields.join(', ')}.`)
        } else {
          setGenerateError(body?.error || `Save failed (${res.status})`)
        }
        setPhase('chat')
        return
      }
      // Medical hold — baseline flagged the user as not cleared to train
      if (body?.ok_to_train === false) {
        setGenerateError('Based on your answers, we recommend consulting a healthcare provider before starting a training program. Your information has been saved.')
        setPhase('chat')
        return
      }
      clearIntakeLS()
      navigate('/my-plan')
    } catch (err) {
      setGenerateError(err?.message || 'Network error during setup.')
      setPhase('chat')
    }
  }

  const missing = missingIntakeFields(extracted)

  if (sessionState.loading) return <CenteredSpinner label="Loading your account..." />

  if (phase === 'generating') return <GeneratingScreen />

  async function handleSignOut() {
    clearIntakeLS()
    await supabase.auth.signOut()
    navigate('/start?fresh=1')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT }}>
      {/* Top nav bar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${BRD}`,
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/koto_logo_black.svg" alt="Koto" style={{ height: 20 }} />
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: INK3, fontFamily: FONT,
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-.4px', fontFamily: FONT }}>
            Let's build your plan.
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: INK3, fontFamily: FONT }}>
            A quick conversation with your AI coach. Your profile builds itself as you talk.
          </p>
          {savedMessages.length > 0 && (
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', background: '#f0fdf4', borderRadius: 999,
              fontSize: 12, fontWeight: 600, color: '#065f46',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#10b981' }} />
              Progress restored — pick up where you left off
            </div>
          )}
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
            onMessagesChange={handleMessagesChange}
            initialMessages={savedMessages}
            userName={extracted.full_name || sessionState.user?.user_metadata?.full_name || ''}
          />

          {/* Right: Live card */}
          <div style={{ position: 'sticky', top: 76 }}>
            <IntakeLiveCard
              extracted={extracted}
              missingFields={missing}
              onGenerate={handleGenerate}
              generating={phase === 'generating'}
              generateError={generateError}
            />
          </div>
        </div>

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

      <TrainerFooter />
    </div>
  )
}

// ── Progress screens ───────────────────────────────────────────────────────

function CenteredSpinner({ label }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: INK3, fontSize: 14 }}>
        <Loader2 size={16} /> {label}
      </div>
    </div>
  )
}

function GeneratingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: FONT }}>
      <section style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 16, padding: '36px 32px', textAlign: 'center', maxWidth: 480, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 20px', border: '4px solid #f1f1f6', borderTopColor: ACCENT, borderRadius: '50%', animation: 'kotoGenerateSpin 0.9s linear infinite' }} />
        <style>{'@keyframes kotoGenerateSpin{to{transform:rotate(360deg)}}'}</style>
        <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-.3px' }}>Crafting your plan</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: INK3, lineHeight: 1.55 }}>
          Your baseline, 90-day roadmap, 2-week workout block, and coaching playbook are
          generating now. This takes about a minute — don't close this tab.
        </p>
        <ul style={{ textAlign: 'left', margin: '0 auto', paddingLeft: 20, fontSize: 12, color: INK3, lineHeight: 1.9, maxWidth: 360 }}>
          <li>Calorie + macro targets + training readiness</li>
          <li>3 x 30-day phases with measurable milestones</li>
          <li>2-week trackable workout block</li>
          <li>Coaching playbook — supplements, travel, recovery, scenarios</li>
        </ul>
      </section>
    </div>
  )
}

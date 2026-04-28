"use client"
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertTriangle, ShieldAlert, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// /start/consent — legal compliance gate between signup and intake.
//
// Three steps in one page (positioning → screening → waiver), plus a
// branch step (block) when the screening turns up any medical/specialized
// flag. Persists the result to auth.user.user_metadata.compliance so the
// downstream /my-intake auth gate and the /api/trainer/self-signup route
// can both verify the user has been through this flow.

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const INK = '#0a0a0a'
const INK2 = '#37373c'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const ACCENT = '#d89a6a'
const CARD = '#f1f1f6'
const CARD_ELEV = '#fafafb'
const BRD = '#ececef'
const BG = '#ffffff'
const RED = '#dc2626'
const RED_BG = '#fef2f2'

// Bumping this requires re-acceptance from any user whose stored
// waiver_text_version is below the current value.
const WAIVER_TEXT_VERSION = 1

const SCREENING_QUESTIONS = [
  { id: 'medical_condition', label: 'A medical condition (diabetes, heart, thyroid, blood pressure, autoimmune, etc.)' },
  { id: 'pregnancy_postpartum', label: 'Pregnancy or postpartum (within the last 12 months)' },
  { id: 'eating_disorder_history', label: 'A history of an eating disorder' },
  { id: 'injury', label: 'An injury or chronic pain that affects exercise' },
  { id: 'physician_diet', label: 'A physician-prescribed diet or medication that affects nutrition' },
]

const WAIVER_CHECKS = [
  'I understand Koto provides general wellness guidance only.',
  'I understand Koto is not medical advice, not a diagnosis, and not a substitute for professional care.',
  'I assume all risks associated with exercise and nutrition changes I choose to make.',
  'I will consult a licensed healthcare professional if I have concerns about my health.',
  'I agree to the Terms of Service, Privacy Policy, and this Waiver.',
]

export default function ComplianceGatePage() {
  const navigate = useNavigate()

  const [bootstrap, setBootstrap] = useState({ loading: true, user: null, alreadyDone: false })
  const [step, setStep] = useState('positioning') // positioning | screening | block | waiver
  const [screening, setScreening] = useState({}) // { id: 'no'|'yes'|'unsure' }
  const [educationalMode, setEducationalMode] = useState(false)
  const [acks, setAcks] = useState(WAIVER_CHECKS.map(() => false))
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState(null)

  // Auth gate. Anyone here without a session bounces back to /start. Anyone
  // who already accepted a current-version waiver bounces forward to /my-intake
  // (or /my-plan if they already have a trainee row).
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) { navigate('/start'); return }
      const c = user.user_metadata?.compliance
      if (c?.waiver_accepted_at && (c.waiver_text_version ?? 0) >= WAIVER_TEXT_VERSION) {
        const { data: mapping } = await supabase
          .from('koto_fitness_trainee_users')
          .select('trainee_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (cancelled) return
        navigate(mapping ? '/my-plan' : '/my-intake')
        return
      }
      setBootstrap({ loading: false, user, alreadyDone: false })
    })
    return () => { cancelled = true }
  }, [navigate])

  useEffect(() => {
    document.title = 'Koto — Before we begin'
  }, [])

  const screeningHasFlag = useMemo(() => {
    return Object.values(screening).some((v) => v === 'yes' || v === 'unsure')
  }, [screening])

  const screeningComplete = useMemo(() => {
    return SCREENING_QUESTIONS.every((q) => screening[q.id])
  }, [screening])

  const allAcksChecked = acks.every(Boolean)

  // Sign out and bounce — used by the "Exit" branch on the block screen.
  async function exit() {
    try { await supabase.auth.signOut() } catch { /* swallow */ }
    navigate('/train')
  }

  // Persist compliance state to user_metadata, then advance to /my-intake.
  async function acceptAndContinue() {
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const now = new Date().toISOString()
      const compliance = {
        screening_completed_at: now,
        screening_result: educationalMode ? 'educational_mode' : 'clear',
        screening_answers: screening,
        educational_mode: educationalMode,
        waiver_accepted_at: now,
        waiver_text_version: WAIVER_TEXT_VERSION,
      }
      const { error } = await supabase.auth.updateUser({
        data: { compliance },
      })
      if (error) {
        setSubmitErr(error.message || 'Could not save consent — try again.')
        return
      }
      navigate('/my-intake')
    } catch (e) {
      setSubmitErr(e?.message || 'Could not save consent — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (bootstrap.loading) {
    return (
      <Shell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: INK3 }}>
          <Loader2 size={20} style={{ animation: 'koto-spin 1s linear infinite' }} />
        </div>
        <style>{'@keyframes koto-spin{to{transform:rotate(360deg)}}'}</style>
      </Shell>
    )
  }

  return (
    <Shell>
      <ProgressBar step={step} />

      {step === 'positioning' && (
        <PositioningCard
          onContinue={() => setStep('screening')}
        />
      )}

      {step === 'screening' && (
        <ScreeningCard
          screening={screening}
          onChange={(id, value) => setScreening((prev) => ({ ...prev, [id]: value }))}
          screeningComplete={screeningComplete}
          onContinue={() => {
            if (screeningHasFlag) { setStep('block'); return }
            setEducationalMode(false)
            setStep('waiver')
          }}
          onBack={() => setStep('positioning')}
        />
      )}

      {step === 'block' && (
        <BlockCard
          onEducationalMode={() => {
            setEducationalMode(true)
            setStep('waiver')
          }}
          onExit={exit}
          onBack={() => setStep('screening')}
        />
      )}

      {step === 'waiver' && (
        <WaiverCard
          educationalMode={educationalMode}
          acks={acks}
          onToggle={(idx) => setAcks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
          allAcksChecked={allAcksChecked}
          submitting={submitting}
          submitErr={submitErr}
          onAccept={acceptAndContinue}
          onBack={() => setStep(educationalMode ? 'block' : 'screening')}
        />
      )}

      <style>{'@keyframes koto-spin{to{transform:rotate(360deg)}}'}</style>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: BG, fontFamily: F,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '40px 20px',
      WebkitFontSmoothing: 'antialiased', color: INK,
    }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>Koto</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: INK3, marginTop: 4 }}>
            Smarter fitness and nutrition, guided by AI.
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProgressBar({ step }) {
  const stepIndex = ({ positioning: 1, screening: 2, block: 2, waiver: 3 })[step] || 1
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 8,
      marginBottom: 22,
    }}>
      {[1, 2, 3].map((n) => (
        <div key={n} style={{
          height: 4, width: 56, borderRadius: 4,
          background: n <= stepIndex ? INK : BRD,
          transition: 'background 200ms',
        }} />
      ))}
    </div>
  )
}

function Card({ children, padding = 28 }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BRD}`,
      borderRadius: 16, padding: `${padding}px ${padding}px`,
      boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  )
}

function PositioningCard({ onContinue }) {
  return (
    <Card>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
        Before we begin
      </h1>
      <p style={{ margin: '12px 0 20px', fontSize: 15, color: INK2, lineHeight: 1.55, fontFamily: F }}>
        Koto helps you build healthy routines through general fitness and
        nutrition guidance.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <DenyRow text="Does not provide medical advice" />
        <DenyRow text="Does not diagnose or treat conditions" />
        <DenyRow text="Does not replace licensed professionals" />
      </div>

      <PrimaryButton onClick={onContinue}>
        Continue
        <ArrowRight size={16} strokeWidth={2.25} />
      </PrimaryButton>
    </Card>
  )
}

function DenyRow({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: CARD,
      fontSize: 14, color: INK2, fontFamily: F, lineHeight: 1.45,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        border: `1.5px solid ${INK4}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          display: 'inline-block', width: 8, height: 1.5,
          background: INK4, borderRadius: 1,
        }} />
      </div>
      <span>{text}</span>
    </div>
  )
}

function ScreeningCard({ screening, onChange, screeningComplete, onContinue, onBack }) {
  return (
    <Card>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
        Do any of these apply to you?
      </h1>
      <p style={{ margin: '10px 0 22px', fontSize: 14, color: INK3, lineHeight: 1.55, fontFamily: F }}>
        We ask before generating any plan so we can route you safely if a
        professional should be involved.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {SCREENING_QUESTIONS.map((q) => (
          <ScreeningRow
            key={q.id}
            label={q.label}
            value={screening[q.id]}
            onChange={(v) => onChange(q.id, v)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <PrimaryButton onClick={onContinue} disabled={!screeningComplete}>
          Continue
          <ArrowRight size={16} strokeWidth={2.25} />
        </PrimaryButton>
      </div>
    </Card>
  )
}

function ScreeningRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 14, color: INK, lineHeight: 1.45, fontFamily: F }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { key: 'no', label: 'No' },
          { key: 'yes', label: 'Yes' },
          { key: 'unsure', label: 'Not sure' },
        ].map((opt) => {
          const active = value === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${active ? INK : BRD}`,
                background: active ? INK : '#fff',
                color: active ? '#fff' : INK2,
                fontSize: 14, fontWeight: 600, fontFamily: F,
                cursor: 'pointer',
                transition: 'background 120ms, color 120ms, border-color 120ms',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BlockCard({ onEducationalMode, onExit, onBack }) {
  return (
    <Card>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: RED_BG, color: RED,
        fontSize: 12, fontWeight: 700, fontFamily: F, letterSpacing: '0.02em',
        marginBottom: 14,
      }}>
        <ShieldAlert size={14} strokeWidth={2.25} />
        Take care
      </div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
        Koto may not be appropriate for you yet.
      </h1>
      <p style={{ margin: '12px 0 8px', fontSize: 15, color: INK2, lineHeight: 1.55, fontFamily: F }}>
        Based on what you shared, individual fitness or nutrition guidance from
        an AI may not be safe without input from a licensed healthcare provider.
      </p>
      <p style={{ margin: '0 0 22px', fontSize: 14, color: INK3, lineHeight: 1.55, fontFamily: F }}>
        Please consult a licensed professional before using Koto. If you'd
        still like to read general wellness content, you can continue in
        Educational Mode — Koto will avoid individualized calorie targets,
        meal prescriptions, and workout volume calls.
      </p>

      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: RED_BG, color: RED,
        fontSize: 13, lineHeight: 1.5, fontFamily: F, fontWeight: 500,
        marginBottom: 22,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            If you are experiencing chest pain, severe dizziness, or any
            symptom that feels like an emergency, stop and call your local
            emergency number now.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={onEducationalMode}>
          Continue in Educational Mode
          <ArrowRight size={16} strokeWidth={2.25} />
        </PrimaryButton>
        <SecondaryButton onClick={onExit}>Exit Koto</SecondaryButton>
        <button type="button" onClick={onBack} style={{
          background: 'none', border: 'none', color: INK3, fontSize: 12,
          fontWeight: 500, cursor: 'pointer', fontFamily: F, marginTop: 4,
        }}>
          ← Back to questions
        </button>
      </div>
    </Card>
  )
}

function WaiverCard({ educationalMode, acks, onToggle, allAcksChecked, submitting, submitErr, onAccept, onBack }) {
  return (
    <Card>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
        One more thing
      </h1>
      <p style={{ margin: '10px 0 18px', fontSize: 14, color: INK3, lineHeight: 1.55, fontFamily: F }}>
        Please read and confirm each item below. All five must be acknowledged
        to continue{educationalMode ? ' (Educational Mode)' : ''}.
      </p>

      {educationalMode && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: '#fff7ed', color: '#9a3412',
          fontSize: 13, lineHeight: 1.5, fontFamily: F, fontWeight: 500,
          marginBottom: 16,
        }}>
          You'll continue in Educational Mode. Koto will share general
          wellness principles only — no individualized calorie targets,
          macros, or workout prescriptions. Talk to a licensed professional
          for tailored guidance.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {WAIVER_CHECKS.map((text, idx) => (
          <CheckRow
            key={idx}
            checked={acks[idx]}
            onToggle={() => onToggle(idx)}
            text={text}
          />
        ))}
      </div>

      {submitErr && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: RED_BG, color: RED,
          fontSize: 13, fontFamily: F, marginBottom: 14,
        }}>
          {submitErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <SecondaryButton onClick={onBack} disabled={submitting}>Back</SecondaryButton>
        <PrimaryButton onClick={onAccept} disabled={!allAcksChecked || submitting}>
          {submitting && <Loader2 size={16} style={{ animation: 'koto-spin 1s linear infinite' }} />}
          {submitting ? 'Saving…' : 'Accept & continue'}
          {!submitting && <ArrowRight size={16} strokeWidth={2.25} />}
        </PrimaryButton>
      </div>

      <p style={{
        margin: '18px 0 0', fontSize: 11, color: INK4, lineHeight: 1.55, fontFamily: F,
        textAlign: 'center',
      }}>
        Koto provides general wellness guidance only. Not medical advice.
        Not a substitute for professional care.
      </p>
    </Card>
  )
}

function CheckRow({ checked, onToggle, text }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: checked ? '#fafafb' : '#fff',
        border: `1px solid ${checked ? INK : BRD}`,
        textAlign: 'left', cursor: 'pointer',
        fontFamily: F,
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6,
        flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${checked ? INK : INK4}`,
        background: checked ? INK : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms, border-color 120ms',
      }}>
        {checked && <Check size={13} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: 14, color: INK2, lineHeight: 1.45 }}>{text}</span>
    </button>
  )
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '14px 20px',
        background: disabled ? CARD_ELEV : INK,
        color: disabled ? INK4 : '#fff',
        border: `1px solid ${disabled ? BRD : INK}`,
        borderRadius: 12,
        fontSize: 15, fontWeight: 600, fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background 120ms, color 120ms',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '14px 20px',
        background: '#fff',
        color: INK,
        border: `1px solid ${BRD}`,
        borderRadius: 12,
        fontSize: 15, fontWeight: 600, fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  )
}

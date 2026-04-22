"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import FourrWelcomeCard from '../../components/fourr/FourrWelcomeCard'
import {
  NAVY, NAVY_LIGHT, GOLD, CREAM, WHITE,
  TEXT_BODY, TEXT_MUTED,
  CARD_BG, CARD_BORDER,
  FONT_HEADING, FONT_BODY,
} from '../../lib/fourr/fourrTheme'

// ─────────────────────────────────────────────────────────────────────────────
// /4r/start — public self-service signup for 4R Method intake.
//
// Mirrors SelfSignupPage.jsx pattern but with 4R branding.
// On success → /4r/intake (conversational chat).
// If already signed in → check koto_fourr_patient_users → route accordingly.
// ─────────────────────────────────────────────────────────────────────────────

export default function FourrSignupPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) return
      const { data: mapping } = await supabase
        .from('koto_fourr_patient_users')
        .select('patient_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (mapping) {
        // Check if protocol already generated
        const { data: patient } = await supabase
          .from('koto_fourr_patients')
          .select('status')
          .eq('id', mapping.patient_id)
          .maybeSingle()
        if (patient?.status === 'protocol_generated') {
          navigate('/4r/my-protocol')
        } else {
          navigate('/4r/intake')
        }
      } else {
        navigate('/4r/intake')
      }
    })
    return () => { cancelled = true }
  }, [navigate])

  async function handleSignup(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email || !password) { setError('Email and password required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitting(true)
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() || null, role: 'fourr_patient_self' },
          emailRedirectTo: `${window.location.origin}/4r/intake`,
        },
      })
      if (signUpErr) {
        if (/already registered/i.test(signUpErr.message)) {
          setMode('signin')
          setInfo('That email is already registered. Sign in with your password instead.')
        } else {
          setError(signUpErr.message)
        }
        return
      }
      if (data?.session?.user) {
        navigate('/4r/intake')
        return
      }
      setInfo('Check your inbox for a confirmation link to finish signing up.')
    } catch (err) {
      setError(err?.message || 'Signup failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignin(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInErr) { setError(signInErr.message); return }
      const { data } = await supabase.auth.getSession()
      const user = data?.session?.user
      if (!user) { setError('Signed in but no session returned.'); return }
      const { data: mapping } = await supabase
        .from('koto_fourr_patient_users')
        .select('patient_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (mapping) {
        const { data: patient } = await supabase
          .from('koto_fourr_patients')
          .select('status')
          .eq('id', mapping.patient_id)
          .maybeSingle()
        navigate(patient?.status === 'protocol_generated' ? '/4r/my-protocol' : '/4r/intake')
      } else {
        navigate('/4r/intake')
      }
    } catch (err) {
      setError(err?.message || 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: NAVY, padding: '40px 20px', fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <FourrWelcomeCard />

        <section style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 900,
              color: CREAM, letterSpacing: '-.3px', fontFamily: FONT_HEADING,
            }}>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <button
              type="button"
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null) }}
              style={{
                background: 'none', border: 'none', color: GOLD,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
              }}
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>

          <form onSubmit={mode === 'signup' ? handleSignup : handleSignin} style={{ display: 'grid', gap: 12 }}>
            {mode === 'signup' && (
              <Field label="Your name">
                <input
                  style={inputStyle}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                required
              />
              {mode === 'signup' && (
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>At least 8 characters.</div>
              )}
            </Field>

            {error && (
              <div style={{ padding: '10px 12px', background: '#3b1111', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ padding: '10px 12px', background: '#0c2d48', border: '1px solid #1e4d6e', borderRadius: 8, color: '#93c5fd', fontSize: 13 }}>
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4,
                padding: '12px 16px',
                background: submitting ? TEXT_MUTED : GOLD,
                color: submitting ? WHITE : NAVY,
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: submitting ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {submitting ? <Loader2 size={14} /> : <ArrowRight size={14} />}
              {submitting
                ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
                : (mode === 'signup' ? 'Create account and start assessment' : 'Sign in')}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: `1px solid ${CARD_BORDER}`,
            fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55,
          }}>
            By continuing you acknowledge that this assessment gathers information for your
            doctors to review. It is not a medical diagnosis. A licensed Doctor of Chiropractic
            will develop your personalized protocol.
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_BODY, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  background: NAVY_LIGHT,
  color: CREAM,
  fontFamily: 'inherit',
}

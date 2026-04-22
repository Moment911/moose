"use client"
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TrainerWelcomeCard from '../../components/trainer/TrainerWelcomeCard'
import { R, T, BLK, GRY } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// /start — public self-service signup landing for Koto Trainer.
//
// No trainer invite required.  Email + password via Supabase auth.  On
// success we redirect to /my-intake which captures the full intake and
// triggers /api/trainer/self-signup (plan generation chain).
//
// If an authenticated session already exists when the page mounts, we skip
// ahead — either to /my-intake (no trainee mapping yet) or /my-plan (plan
// already provisioned).  Keeps the flow single-click-to-resume.
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#f9fafb'

export default function SelfSignupPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signup') // 'signup' | 'signin'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  // If already signed in, route to the next step.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.session?.user
      if (!user) return
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      navigate(mapping ? '/my-plan' : '/my-intake')
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
          data: { full_name: fullName.trim() || null, role: 'trainer_trainee_self' },
          emailRedirectTo: `${window.location.origin}/my-intake`,
        },
      })
      if (signUpErr) {
        // Supabase returns "User already registered" — route them to sign-in.
        if (/already registered/i.test(signUpErr.message)) {
          setMode('signin')
          setInfo('That email is already registered. Sign in with your password instead.')
        } else {
          setError(signUpErr.message)
        }
        return
      }
      // Email-confirm disabled → we have a session right away.
      if (data?.session?.user) {
        navigate('/my-intake')
        return
      }
      // Email-confirm enabled → explain to the user.
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
      if (signInErr) {
        setError(signInErr.message)
        return
      }
      // Check mapping → route appropriately.
      const { data } = await supabase.auth.getSession()
      const user = data?.session?.user
      if (!user) { setError('Signed in but no session returned — try again.'); return }
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      navigate(mapping ? '/my-plan' : '/my-intake')
    } catch (err) {
      setError(err?.message || 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '40px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <TrainerWelcomeCard />

        <section
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '24px 28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BLK, letterSpacing: '-.3px' }}>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <button
              type="button"
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null) }}
              style={{ background: 'none', border: 'none', color: T, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
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
                  placeholder="Jane Runner"
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
                <div style={{ fontSize: 11, color: GRY, marginTop: 4 }}>At least 8 characters.</div>
              )}
            </Field>

            {error && (
              <div style={{ padding: '10px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#1e40af', fontSize: 13 }}>
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4,
                padding: '12px 16px',
                background: submitting ? '#9ca3af' : R,
                color: '#fff',
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
                ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'signup' ? 'Create account and start intake' : 'Sign in')}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6', fontSize: 11, color: GRY, lineHeight: 1.55 }}>
            By continuing you agree that this system provides coaching guidance, not medical
            advice. Consult your physician before starting any new training or nutrition program.
          </div>
        </section>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: GRY }}>
          <Link to="/" style={{ color: T, textDecoration: 'none', fontWeight: 700 }}>← Back to Koto</Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
  color: '#0a0a0a',
  fontFamily: 'inherit',
}

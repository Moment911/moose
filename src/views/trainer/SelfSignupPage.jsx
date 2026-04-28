"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// /start — Koto Trainer signup/login. Standalone auth, separate from agency.
// ─────────────────────────────────────────────────────────────────────────────

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const CARD = '#f1f1f6'
const BORDER = '#ececef'

export default function SelfSignupPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    document.title = 'Koto Trainer — Sign Up'
  }, [])

  // If already signed in, route forward
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
    setError(null); setInfo(null)
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
        if (/already registered/i.test(signUpErr.message)) {
          setMode('signin')
          setInfo('That email is already registered. Sign in instead.')
        } else {
          setError(signUpErr.message)
        }
        return
      }
      if (data?.session?.user) { navigate('/my-intake'); return }
      setInfo('Check your inbox for a confirmation link.')
    } catch (err) {
      setError(err?.message || 'Signup failed.')
    } finally { setSubmitting(false) }
  }

  async function handleSignin(e) {
    e.preventDefault()
    setError(null); setInfo(null); setSubmitting(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (signInErr) { setError(signInErr.message); return }
      const { data } = await supabase.auth.getSession()
      const user = data?.session?.user
      if (!user) { setError('No session — try again.'); return }
      const { data: mapping } = await supabase
        .from('koto_fitness_trainee_users')
        .select('trainee_id')
        .eq('user_id', user.id)
        .maybeSingle()
      navigate(mapping ? '/my-plan' : '/my-intake')
    } catch (err) {
      setError(err?.message || 'Sign-in failed.')
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#fff', fontFamily: F,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>
            Koto
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: INK3, marginTop: 4 }}>
            Your AI trainer, nutritionist, and coach.
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 16, padding: '28px 28px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
        }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: INK3, fontFamily: F }}>
            {mode === 'signup' ? 'Free to start. No credit card.' : 'Sign in to continue training.'}
          </p>

          <form onSubmit={mode === 'signup' ? handleSignup : handleSignin} style={{ display: 'grid', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4, fontFamily: F }}>Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name"
                  autoComplete="name"
                  style={{ ...inputStyle }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4, fontFamily: F }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" required
                style={{ ...inputStyle }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4, fontFamily: F }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined} required
                style={{ ...inputStyle }} />
              {mode === 'signup' && <div style={{ fontSize: 11, color: INK3, marginTop: 4 }}>At least 8 characters</div>}
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 13, fontFamily: F }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, color: '#065f46', fontSize: 13, fontFamily: F }}>
                {info}
              </div>
            )}

            <button type="submit" disabled={submitting} style={{
              marginTop: 4, padding: '14px 20px',
              background: submitting ? CARD : INK, color: submitting ? INK3 : '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, fontFamily: F,
              cursor: submitting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {submitting
                ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
                : (mode === 'signup' ? 'Get started' : 'Sign in')}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button type="button"
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null) }}
              style={{ background: 'none', border: 'none', color: INK3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F }}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: INK3, lineHeight: 1.5, fontFamily: F }}>
          By continuing you agree this is AI coaching, not medical advice.
          <br />Always consult a physician before starting any program.
        </div>

        {/* Back to landing */}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button type="button" onClick={() => navigate('/train')}
            style={{ background: 'none', border: 'none', color: INK3, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: F }}>
            &larr; Back to Koto Trainer
          </button>
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px', fontSize: 15, fontWeight: 500,
  border: `1px solid ${BORDER}`, borderRadius: 10,
  background: CARD, color: INK, fontFamily: F,
  outline: 'none', boxSizing: 'border-box',
}

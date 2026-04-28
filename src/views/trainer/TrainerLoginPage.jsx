"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { signIn, supabase } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// /trainer/login — dedicated coach/trainer login. Cal-AI aesthetic.
// Separate from /login (agency) and /start (athlete signup).
// On success → /trainer dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const F = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
const INK = '#0a0a0a'
const INK3 = '#6b6b70'
const INK4 = '#a1a1a6'
const CARD = '#f1f1f6'
const BORDER = '#ececef'

export default function TrainerLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => { document.title = 'Koto Trainer — Coach Login' }, [])

  // If already signed in, redirect to trainer dashboard
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data?.session?.user) navigate('/trainer', { replace: true })
    })
    return () => { cancelled = true }
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    if (!email || !password) { setError('Email and password required'); return }
    setSubmitting(true)
    try {
      const { error: signInErr } = await signIn(email.trim().toLowerCase(), password)
      if (signInErr) { setError(signInErr.message); return }
      navigate('/trainer')
    } catch (err) {
      setError(err?.message || 'Login failed.')
    } finally { setSubmitting(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError(null)
    if (!email) { setError('Enter your email first'); return }
    setSubmitting(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (resetErr) { setError(resetErr.message); return }
      setResetSent(true)
    } finally { setSubmitting(false) }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', fontSize: 16, fontWeight: 500,
    border: `1px solid ${BORDER}`, borderRadius: 12,
    background: '#fff', color: INK, fontFamily: F, outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#fff', fontFamily: F,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: INK,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>K</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: INK, letterSpacing: '-0.6px' }}>
            Koto Trainer
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: INK3, marginTop: 4 }}>
            Coach portal
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 20, padding: '32px 28px',
          boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
        }}>
          {mode === 'login' ? (
            <>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.02em', fontFamily: F }}>
                Sign in
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: INK3, fontFamily: F }}>
                Access your training dashboard.
              </p>

              <form onSubmit={handleLogin} style={{ display: 'grid', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color={INK4} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email" autoComplete="email" required
                    style={{ ...inputStyle, paddingLeft: 42 }}
                    onFocus={(e) => e.target.style.borderColor = INK}
                    onBlur={(e) => e.target.style.borderColor = BORDER}
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock size={18} color={INK4} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" autoComplete="current-password" required
                    style={{ ...inputStyle, paddingLeft: 42, paddingRight: 44 }}
                    onFocus={(e) => e.target.style.borderColor = INK}
                    onBlur={(e) => e.target.style.borderColor = BORDER}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: INK4,
                  }}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {error && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, color: '#991b1b', fontSize: 13, fontFamily: F }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} style={{
                  marginTop: 4, padding: '14px 20px',
                  background: submitting ? CARD : INK, color: submitting ? INK3 : '#fff',
                  border: 'none', borderRadius: 12,
                  fontSize: 16, fontWeight: 600, fontFamily: F,
                  cursor: submitting ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background .15s',
                }}>
                  {submitting && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
                  {submitting ? 'Signing in...' : 'Sign in'}
                  {!submitting && <ArrowRight size={18} />}
                </button>
              </form>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => { setMode('reset'); setError(null) }}
                  style={{ background: 'none', border: 'none', color: INK3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F }}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => navigate('/start')}
                  style={{ background: 'none', border: 'none', color: INK3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F }}>
                  Athlete? Sign up here
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: INK, fontFamily: F }}>
                Reset password
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: INK3, fontFamily: F }}>
                We'll send a reset link to your email.
              </p>

              {resetSent ? (
                <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#065f46' }}>Check your email</div>
                  <div style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>Reset link sent to {email}</div>
                </div>
              ) : (
                <form onSubmit={handleReset} style={{ display: 'grid', gap: 14 }}>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email" autoComplete="email" required style={inputStyle} />
                  {error && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>
                  )}
                  <button type="submit" disabled={submitting} style={{
                    padding: '14px 20px', background: submitting ? CARD : INK, color: submitting ? INK3 : '#fff',
                    border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, fontFamily: F,
                    cursor: submitting ? 'default' : 'pointer',
                  }}>
                    {submitting ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
              )}

              <button type="button" onClick={() => { setMode('login'); setError(null); setResetSent(false) }}
                style={{ marginTop: 14, background: 'none', border: 'none', color: INK3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F, width: '100%', textAlign: 'center' }}>
                Back to sign in
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: INK4, lineHeight: 1.6 }}>
          By signing in you agree that this system provides coaching guidance, not medical advice.
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

"use client";
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signIn, supabase } from '../lib/supabase'
import { Loader2, Check, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, W, FH, FB } from '../lib/theme'

const INK   = BLK
const MUTED = '#6b7280'
const FAINT = '#9ca3af'
const HAIR  = '#e5e7eb'
const WASH  = '#fafbfc'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)
  const [shaking, setShaking] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  function triggerShake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'reset') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      setLoading(false)
      if (resetError) { setError(resetError.message); triggerShake(); return }
      setResetSent(true)
      return
    }

    const { error: signInError } = await signIn(email, password)
    setLoading(false)
    if (signInError) { setError(signInError.message); triggerShake(); return }
    const from = location.state?.from || '/'
    window.location.href = from
  }

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
    setGoogleLoading(false)
    if (oauthError) { setError(oauthError.message); triggerShake() }
  }

  const inputStyle = {
    width: '100%',
    padding: '16px 18px 16px 48px',
    background: W,
    border: `1.5px solid ${HAIR}`,
    borderRadius: 12,
    fontSize: 16,
    color: INK,
    outline: 'none',
    fontFamily: FB,
    transition: 'border-color .2s, box-shadow .2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: W, fontFamily: FH, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient color backdrop */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -100, left: '10%', width: 520, height: 520,
          borderRadius: '50%', background: R + '20', filter: 'blur(100px)',
          animation: 'orb1 12s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: 80, right: '8%', width: 480, height: 480,
          borderRadius: '50%', background: T + '22', filter: 'blur(100px)',
          animation: 'orb2 14s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: '50%', width: 620, height: 300,
          borderRadius: '50%', transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse at center, ${R}18 0%, ${T}18 60%, transparent 80%)`,
          filter: 'blur(80px)', animation: 'orb1 16s ease-in-out infinite reverse',
        }} />
      </div>

      {/* Top bar */}
      <div style={{
        position: 'relative', padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/koto_logo.svg" alt="Koto" style={{ height: 28, cursor: 'pointer' }}
          onClick={() => navigate('/')} />
        <a href="/" style={{
          fontSize: 14, color: MUTED, textDecoration: 'none', fontWeight: 600,
        }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MUTED}
        >← Back to home</a>
      </div>

      {/* Centered card */}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 68px)', padding: '40px 24px 80px',
      }}>
        <div style={{
          width: '100%', maxWidth: 460,
          animation: shaking ? 'shake 0.5s ease-in-out' : 'none',
        }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <img src="/koto_logo.svg" alt="Koto" style={{ height: 34, marginBottom: 28 }} />
            <h1 style={{
              fontSize: 44, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.03em', lineHeight: 1.1, color: INK, marginBottom: 10,
            }}>
              {mode === 'reset' ? 'Reset your password' : 'Welcome back.'}
            </h1>
            <p style={{ fontSize: 16, color: MUTED, fontFamily: FB, lineHeight: 1.5 }}>
              {mode === 'reset'
                ? 'Enter your email and we\'ll send a reset link.'
                : 'Sign in to keep building with Koto.'}
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: W, border: `1px solid ${HAIR}`, borderRadius: 20,
            padding: '36px 36px 32px',
            boxShadow: '0 24px 60px rgba(17,17,17,.06), 0 4px 12px rgba(17,17,17,.04)',
          }}>
            {/* Error banner */}
            {error && (
              <div style={{
                padding: '12px 14px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 10,
                marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: R, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#991b1b', fontFamily: FB }}>{error}</span>
              </div>
            )}

            {/* Reset sent success */}
            {resetSent && (
              <div style={{
                padding: '24px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 14, marginBottom: 16, textAlign: 'center',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: GRN,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Check size={22} color={W} strokeWidth={3} />
                </div>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#166534', fontFamily: FH, marginBottom: 4 }}>
                  Check your email
                </p>
                <p style={{ fontSize: 14, color: '#15803d', fontFamily: FB }}>
                  We sent a reset link to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => { setMode('login'); setResetSent(false); setError('') }}
                  style={{
                    marginTop: 16, background: 'none', border: 'none',
                    color: INK, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: FH,
                  }}
                >
                  ← Back to sign in
                </button>
              </div>
            )}

            {!resetSent && (
              <>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Email */}
                  <div>
                    <label style={{
                      display: 'block', fontSize: 13, fontWeight: 700,
                      color: INK, marginBottom: 8, fontFamily: FH, letterSpacing: '-.005em',
                    }}>
                      Email
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} style={{ position: 'absolute', left: 16, color: FAINT, pointerEvents: 'none' }} />
                      <input
                        type="email"
                        value={email}
                        required
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@agency.com"
                        style={inputStyle}
                        onFocus={e => {
                          e.target.style.borderColor = INK
                          e.target.style.boxShadow = `0 0 0 4px rgba(17,17,17,.08)`
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = HAIR
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  {mode === 'login' && (
                    <div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 8,
                      }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, letterSpacing: '-.005em' }}>
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => { setMode('reset'); setError('') }}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            fontSize: 13, color: MUTED, cursor: 'pointer',
                            fontFamily: FB, fontWeight: 600,
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = INK}
                          onMouseLeave={e => e.currentTarget.style.color = MUTED}
                        >
                          Forgot?
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Lock size={18} style={{ position: 'absolute', left: 16, color: FAINT, pointerEvents: 'none' }} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          required
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          style={{ ...inputStyle, paddingRight: 48 }}
                          onFocus={e => {
                            e.target.style.borderColor = INK
                            e.target.style.boxShadow = `0 0 0 4px rgba(17,17,17,.08)`
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = HAIR
                            e.target.style.boxShadow = 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute', right: 14,
                            background: 'none', border: 'none',
                            cursor: 'pointer', padding: 4,
                            color: FAINT, display: 'flex',
                          }}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: 8,
                      padding: '16px',
                      borderRadius: 12,
                      border: 'none',
                      background: loading ? FAINT : INK,
                      color: W,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all .2s',
                      fontFamily: FH,
                      letterSpacing: '-.005em',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(17,17,17,.18)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        {mode === 'reset' ? 'Sending...' : 'Signing in...'}
                      </>
                    ) : (
                      <>
                        {mode === 'reset' ? 'Send reset link' : 'Sign in'}
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>

                {mode === 'login' && (
                  <>
                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0 18px' }}>
                      <div style={{ flex: 1, height: 1, background: HAIR }} />
                      <span style={{ fontSize: 12, color: FAINT, fontFamily: FB, fontWeight: 600 }}>OR</span>
                      <div style={{ flex: 1, height: 1, background: HAIR }} />
                    </div>

                    {/* Google OAuth */}
                    <button
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                      style={{
                        width: '100%', padding: '14px',
                        borderRadius: 12, border: `1.5px solid ${HAIR}`,
                        background: W, color: INK,
                        fontSize: 14, fontWeight: 700,
                        cursor: googleLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        transition: 'all .2s', fontFamily: FH,
                      }}
                      onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.borderColor = INK } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR }}
                    >
                      {googleLoading ? (
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <GoogleIcon />
                      )}
                      Continue with Google
                    </button>
                  </>
                )}

                {mode === 'reset' && (
                  <button
                    onClick={() => { setMode('login'); setError('') }}
                    style={{
                      marginTop: 18, background: 'none', border: 'none',
                      color: MUTED, fontSize: 14, cursor: 'pointer',
                      fontFamily: FB, textAlign: 'center', width: '100%', fontWeight: 600,
                    }}
                  >
                    ← Back to sign in
                  </button>
                )}
              </>
            )}
          </div>

          {/* Sign up link */}
          {mode === 'login' && !resetSent && (
            <p style={{
              textAlign: 'center', marginTop: 28,
              fontSize: 14, color: MUTED, fontFamily: FB,
            }}>
              Don't have an account?{' '}
              <a href="/signup" style={{ color: INK, fontWeight: 800, textDecoration: 'none', fontFamily: FH }}>
                Get started →
              </a>
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0,0) scale(1); opacity: .9; }
          50%      { transform: translate(40px,-20px) scale(1.08); opacity: 1; }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0,0) scale(1); opacity: .9; }
          50%      { transform: translate(-30px,30px) scale(1.06); opacity: 1; }
        }
        input::placeholder { color: ${FAINT} !important; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${W} inset !important;
          -webkit-text-fill-color: ${INK} !important;
        }
      `}</style>
    </div>
  )
}

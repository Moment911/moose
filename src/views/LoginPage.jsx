"use client";
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signIn, supabase } from '../lib/supabase'
import { Zap, Loader2, Check, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const R = '#ea2729'
const T = '#5bc6d0'
const FH = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB = "'Raleway','Helvetica Neue',sans-serif"

const benefits = [
  'Streamline client approvals & feedback',
  'Centralize all project assets in one place',
  'Automate revision tracking & sign-offs',
  'Scale your agency without the chaos',
]

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
      if (resetError) {
        setError(resetError.message)
        triggerShake()
        return
      }
      setResetSent(true)
      return
    }

    const { error: signInError } = await signIn(email, password)
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      triggerShake()
      return
    }
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
    if (oauthError) {
      setError(oauthError.message)
      triggerShake()
    }
  }

  const inputWrap = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px 14px 44px',
    background: '#f7f7f8',
    border: '1.5px solid #e2e2e6',
    borderRadius: 10,
    fontSize: 15,
    color: '#1a1a1a',
    outline: 'none',
    fontFamily: FB,
    transition: 'border-color .2s, box-shadow .2s',
    boxSizing: 'border-box',
  }

  const inputIconStyle = {
    position: 'absolute',
    left: 14,
    color: '#9ca3af',
    pointerEvents: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: FB,
    }}>
      {/* ── Left panel ── */}
      <div className="login-left-panel" style={{
        flex: 1,
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated grid background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
          animation: 'gridDrift 20s linear infinite',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: R, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={24} color="#fff" fill="#fff" />
            </div>
            <span style={{
              fontSize: 36, fontWeight: 800, color: '#fff',
              fontFamily: FH, letterSpacing: '-0.02em',
            }}>
              koto
            </span>
          </div>

          {/* Tagline */}
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: '#fff',
            fontFamily: FH, lineHeight: 1.3, marginBottom: 40,
            letterSpacing: '-0.01em',
          }}>
            The Operating System for<br />Modern Marketing Agencies
          </h1>

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {benefits.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(234,39,41,.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Check size={15} color={R} strokeWidth={3} />
                </div>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', fontFamily: FB }}>
                  {b}
                </span>
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div style={{
            marginTop: 64, paddingTop: 32,
            borderTop: '1px solid rgba(255,255,255,.08)',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', fontFamily: FB, lineHeight: 1.5 }}>
              Trusted by 500+ agencies worldwide. SOC 2 compliant. Your data is encrypted at rest and in transit.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right-panel" style={{
        width: 480,
        minWidth: 480,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        overflowY: 'auto',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 360,
          margin: '0 auto',
          animation: shaking ? 'shake 0.5s ease-in-out' : 'none',
        }}>
          {/* Header */}
          <h2 style={{
            fontSize: 26, fontWeight: 700, color: '#1a1a1a',
            fontFamily: FH, marginBottom: 8,
          }}>
            {mode === 'reset' ? 'Reset password' : 'Welcome back'}
          </h2>
          <p style={{
            fontSize: 15, color: '#6b7280', marginBottom: 32,
            fontFamily: FB,
          }}>
            {mode === 'reset'
              ? 'Enter your email and we\'ll send a reset link'
              : 'Sign in to your Koto account'}
          </p>

          {/* Error banner */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: R, flexShrink: 0,
              }} />
              <span style={{ fontSize: 14, color: '#991b1b', fontFamily: FB }}>
                {error}
              </span>
            </div>
          )}

          {/* Reset sent success */}
          {resetSent && (
            <div style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 12,
              marginBottom: 24,
              textAlign: 'center',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#22c55e', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Check size={20} color="#fff" strokeWidth={3} />
              </div>
              <p style={{
                fontSize: 16, fontWeight: 600, color: '#166534',
                fontFamily: FH, marginBottom: 4,
              }}>
                Check your email
              </p>
              <p style={{ fontSize: 14, color: '#15803d', fontFamily: FB }}>
                We sent a reset link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => { setMode('login'); setResetSent(false); setError('') }}
                style={{
                  marginTop: 16, background: 'none', border: 'none',
                  color: R, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: FB,
                }}
              >
                Back to sign in
              </button>
            </div>
          )}

          {!resetSent && (
            <>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Email */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 13, fontWeight: 600,
                    color: '#374151', marginBottom: 6, fontFamily: FB,
                  }}>
                    Email address
                  </label>
                  <div style={inputWrap}>
                    <Mail size={18} style={inputIconStyle} />
                    <input
                      type="email"
                      value={email}
                      required
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@agency.com"
                      style={inputStyle}
                      onFocus={e => {
                        e.target.style.borderColor = R
                        e.target.style.boxShadow = `0 0 0 3px ${R}15`
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#e2e2e6'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Password (only in login mode) */}
                {mode === 'login' && (
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 6,
                    }}>
                      <label style={{
                        fontSize: 13, fontWeight: 600,
                        color: '#374151', fontFamily: FB,
                      }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('reset'); setError('') }}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: 13, color: R, cursor: 'pointer',
                          fontFamily: FB, fontWeight: 500,
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div style={inputWrap}>
                      <Lock size={18} style={inputIconStyle} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        required
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        style={{ ...inputStyle, paddingRight: 44 }}
                        onFocus={e => {
                          e.target.style.borderColor = R
                          e.target.style.boxShadow = `0 0 0 3px ${R}15`
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = '#e2e2e6'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: 12,
                          background: 'none', border: 'none',
                          cursor: 'pointer', padding: 4,
                          color: '#9ca3af', display: 'flex',
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
                    marginTop: 4,
                    padding: '14px',
                    borderRadius: 10,
                    border: 'none',
                    background: loading ? '#ccc' : R,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: loading ? 'none' : `0 4px 14px ${R}30`,
                    transition: 'all .2s',
                    fontFamily: FH,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      {mode === 'reset' ? 'Sending...' : 'Signing in...'}
                    </>
                  ) : (
                    mode === 'reset' ? 'Send reset link' : 'Sign In'
                  )}
                </button>
              </form>

              {mode === 'login' && (
                <>
                  {/* Divider */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    margin: '24px 0',
                  }}>
                    <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                    <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>or</span>
                    <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  </div>

                  {/* Google OAuth */}
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: 10,
                      border: '1.5px solid #e2e2e6',
                      background: '#fff',
                      color: '#374151',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: googleLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      transition: 'all .2s',
                      fontFamily: FB,
                    }}
                    onMouseEnter={e => {
                      if (!googleLoading) e.target.style.background = '#f9fafb'
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = '#fff'
                    }}
                  >
                    {googleLoading ? (
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </button>

                  {/* Sign up link */}
                  <p style={{
                    textAlign: 'center', marginTop: 28,
                    fontSize: 14, color: '#6b7280', fontFamily: FB,
                  }}>
                    Don&apos;t have an account?{' '}
                    <a
                      href="/signup"
                      style={{
                        color: R, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      Get started &rarr;
                    </a>
                  </p>
                </>
              )}

              {mode === 'reset' && (
                <button
                  onClick={() => { setMode('login'); setError('') }}
                  style={{
                    marginTop: 20, background: 'none', border: 'none',
                    color: '#6b7280', fontSize: 14, cursor: 'pointer',
                    fontFamily: FB, textAlign: 'center', width: '100%',
                  }}
                >
                  &larr; Back to sign in
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        @keyframes gridDrift {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 60px 60px, 60px 60px; }
        }
        input::placeholder {
          color: #9ca3af !important;
        }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #f7f7f8 inset !important;
          -webkit-text-fill-color: #1a1a1a !important;
        }
        @media (max-width: 768px) {
          .login-left-panel {
            display: none !important;
          }
          .login-right-panel {
            width: 100% !important;
            min-width: 0 !important;
            padding: 40px 24px !important;
          }
        }
      `}</style>
    </div>
  )
}

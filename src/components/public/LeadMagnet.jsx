"use client"
import { useState } from 'react'
import { ArrowRight, Check, Mail, Download, Calculator, ListChecks } from 'lucide-react'
import { R, T, BLK, GRN, W, FH, FB } from '../../lib/theme'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'

/**
 * Mid-page email capture for lead magnets. One component, every service page.
 *
 * Props:
 *   magnet:        slug — 'crm-migration-checklist' | 'cpl-calculator' | etc.
 *   magnet_title:  human-readable name for the email notification
 *   eyebrow:       small caption above headline (e.g. "Free resource")
 *   headline:      big headline — the offer in plain language
 *   sub:           one-line benefit / what's inside
 *   bullets:       array of short benefit lines (max 4)
 *   cta:           submit button label (default: 'Email me the resource →')
 *   success_title: headline after submission
 *   success_sub:   sub-copy after submission
 *   success_href:  optional URL to redirect to (or show a "View now" button)
 *   success_label: label for the success_href button
 *   accent:        'pink' | 'teal' | 'ink' — background treatment
 *   icon:          'download' | 'calculator' | 'checklist' | 'mail'
 */
export default function LeadMagnet({
  magnet,
  magnet_title,
  eyebrow = 'Free resource',
  headline,
  sub,
  bullets = [],
  cta = 'Email me the resource',
  success_title = 'Check your inbox.',
  success_sub = 'We just sent it over. If you don\'t see it in a minute, peek at your spam folder.',
  success_href,
  success_label = 'View now',
  accent = 'pink',
  icon = 'download',
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const tint = accent === 'teal' ? T : accent === 'ink' ? INK : R

  const IconCmp =
    icon === 'calculator' ? Calculator :
    icon === 'checklist'  ? ListChecks :
    icon === 'mail'       ? Mail :
    Download

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          magnet,
          magnet_title: magnet_title || headline,
          page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Something broke on our side. Try again?')
        setLoading(false)
        return
      }
      setSubmitted(true)
      setLoading(false)
      // If we have a direct resource URL, redirect after short beat
      if (success_href) {
        window.setTimeout(() => {
          window.location.assign(success_href)
        }, 900)
      }
    } catch (err) {
      setError('Network error. Try again?')
      setLoading(false)
    }
  }

  return (
    <section className="lm-pad" style={{ padding: '72px 40px', background: W, borderTop: `1px solid ${HAIR}` }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        background: `linear-gradient(135deg, ${tint}0d, ${T}0d)`,
        border: `1px solid ${HAIR}`, borderRadius: 20,
        padding: '44px 40px', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden="true" style={{
          position: 'absolute', top: -80, right: -80, width: 260, height: 260,
          borderRadius: '50%', background: tint + '22', filter: 'blur(60px)',
        }} />
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: -80, left: -80, width: 220, height: 220,
          borderRadius: '50%', background: T + '1a', filter: 'blur(60px)',
        }} />

        <div className="lm-grid" style={{
          position: 'relative',
          display: 'grid', gridTemplateColumns: bullets.length ? '1.3fr 1fr' : '1fr',
          gap: 40, alignItems: 'center',
        }}>
          {/* Left: offer copy */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 100, background: W,
              border: `1px solid ${HAIR}`,
              fontSize: 11, fontWeight: 700, color: tint, letterSpacing: '.08em',
              textTransform: 'uppercase', fontFamily: FH, marginBottom: 18,
            }}>
              <IconCmp size={12} />
              {eyebrow}
            </div>
            <h2 className="lm-h2" style={{
              fontSize: 34, fontWeight: 900, fontFamily: FH,
              letterSpacing: '-.025em', color: INK, lineHeight: 1.1, marginBottom: 12,
            }}>
              {headline}
            </h2>
            {sub && (
              <p style={{ fontSize: 16, color: MUTED, fontFamily: FB, lineHeight: 1.6, marginBottom: 20, maxWidth: 520 }}>
                {sub}
              </p>
            )}

            {/* Form */}
            {!submitted ? (
              <form onSubmit={onSubmit} style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                background: W, padding: 6, borderRadius: 12,
                border: `1px solid ${HAIR}`, maxWidth: 520,
              }}>
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  style={{
                    flex: 1, minWidth: 200, border: 'none', outline: 'none',
                    padding: '12px 14px', fontSize: 15, fontFamily: FB, color: INK,
                    background: 'transparent',
                  }}
                />
                <button type="submit" disabled={loading || !email.trim()} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 22px', borderRadius: 8, border: 'none',
                  background: loading ? FAINT : INK,
                  color: W, fontSize: 14, fontWeight: 700, fontFamily: FH,
                  cursor: loading ? 'default' : 'pointer', transition: 'all .15s',
                  letterSpacing: '.01em',
                }}>
                  {loading ? 'Sending…' : <>{cta} <ArrowRight size={14} /></>}
                </button>
              </form>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '20px 22px', background: W, border: `1.5px solid ${GRN}`,
                borderRadius: 14, maxWidth: 520,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: GRN,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Check size={18} color={W} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em', marginBottom: 4 }}>
                    {success_title}
                  </div>
                  <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>
                    {success_sub}
                  </div>
                  {success_href && (
                    <a href={success_href} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      marginTop: 10, fontSize: 13, fontWeight: 800, color: tint,
                      textDecoration: 'none', fontFamily: FH,
                    }}>
                      {success_label} <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 10, fontSize: 13, color: '#dc2626', fontFamily: FB,
              }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: 14, fontSize: 12, color: FAINT, fontFamily: FB,
            }}>
              No spam. No newsletter sign-up. Email used only to send this resource.
            </div>
          </div>

          {/* Right: bullet list (if provided) */}
          {bullets.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
              padding: '22px 22px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: tint, letterSpacing: '.08em',
                textTransform: 'uppercase', fontFamily: FH, marginBottom: 4,
              }}>
                What's inside
              </div>
              {bullets.slice(0, 4).map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, background: tint + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    marginTop: 2,
                  }}>
                    <Check size={12} color={tint} />
                  </div>
                  <div style={{ fontSize: 14, color: INK, fontFamily: FB, lineHeight: 1.55 }}>
                    {b}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .lm-pad { padding: 56px 20px !important; }
          .lm-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .lm-h2 { font-size: 26px !important; }
        }
      `}</style>
    </section>
  )
}

"use client"

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, Sparkles, Search, Check, X as XIcon,
  Shield, Smartphone, Code, Image as ImageIcon, Link2, Gauge,
  Phone, Mail,
} from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../../lib/theme'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '../../lib/contact'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { usePageMeta } from '../../lib/usePageMeta'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'
const WASH   = '#fafbfc'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes orbPulse { 0%,100% { transform: translate(0,0) scale(1); opacity: .9; } 50% { transform: translate(40px,-20px) scale(1.08); opacity: 1; } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; text-decoration: none; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover:not(:disabled) { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-primary:disabled { background: ${FAINT}; cursor: default; }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .shim { background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%); background-size: 200% 100%; animation: shimmer 1.6s linear infinite; }
  @media (max-width: 900px) {
    .sb-hero-h1 { font-size: 40px !important; }
    .sb-pad     { padding: 56px 20px !important; }
    .sb-grid-4  { grid-template-columns: 1fr 1fr !important; }
    .sb-split   { grid-template-columns: 1fr !important; }
  }
`

// The live stages shown while the scan runs — keyed to real work done in the API.
// The timing is faster than the actual scan; the UI catches up when data arrives.
const STAGES = [
  { id: 'fetch',   label: 'Fetching the homepage',                 icon: Search },
  { id: 'parse',   label: 'Parsing HTML — title, meta, schema',     icon: Code },
  { id: 'social',  label: 'Checking Open Graph + Twitter cards',    icon: ImageIcon },
  { id: 'tech',    label: 'Measuring SSL, viewport, response time', icon: Gauge },
  { id: 'conv',    label: 'Auditing H1, image alt text, link mix',  icon: Link2 },
  { id: 'ai',      label: 'Running Claude summary + top 3 fixes',   icon: Sparkles },
]

function scoreColor(score) {
  if (score >= 80) return GRN
  if (score >= 60) return AMB
  return R
}
function scoreGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export default function ScanBusinessPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(-1)      // -1 = idle, 0..5 = running stage, 6 = complete
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const resultsRef = useRef(null)

  // Lead capture at the end
  const [captureEmail, setCaptureEmail] = useState('')
  const [captured, setCaptured] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState('')

  usePageMeta({
    title: 'Scan your business — live AI audit | Koto',
    description: 'Paste your URL. In 20 seconds we pull SEO, social, technical, and conversion signals from the live page, then Claude writes 3 specific fixes ranked by impact. Free, no signup.',
  })

  async function runScan(e) {
    e?.preventDefault()
    if (!url.trim() || running) return

    setError('')
    setResult(null)
    setCaptured(false)
    setStage(0)
    setRunning(true)

    // Drive the stage animation — ~1.2s per stage, 6 stages. Caps just
    // before "AI" so we land the final stage when the real response arrives.
    const startedAt = Date.now()
    const stageTimers = []
    for (let i = 1; i <= STAGES.length - 1; i++) {
      stageTimers.push(setTimeout(() => setStage(i), i * 1100))
    }

    try {
      const res = await fetch('/api/demo/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || `Scan failed (${res.status})`)
      }

      // Wait at least until the last stage starts so it doesn't feel instant
      const minElapsed = (STAGES.length - 1) * 1100 + 400
      const remaining = minElapsed - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))

      setStage(STAGES.length) // all complete
      setResult(data)
      setRunning(false)

      // Auto-scroll to results
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e) {
      stageTimers.forEach(clearTimeout)
      setError(e.message || 'Something broke. Try again?')
      setStage(-1)
      setRunning(false)
    }
  }

  async function sendFullReport(e) {
    e.preventDefault()
    setCaptureError('')
    if (!captureEmail.trim()) return
    setCapturing(true)
    try {
      const res = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: captureEmail.trim(),
          magnet: 'site-scan-report',
          magnet_title: `Full site audit — ${result?.finalUrl || result?.url || ''}`,
          page_path: '/demos/scan',
          referrer: document.referrer || undefined,
          user_agent: navigator.userAgent,
          extra: {
            scanned_url: result?.finalUrl || result?.url,
            overall_score: result?.scores?.overall,
            seo_score: result?.scores?.seo,
            social_score: result?.scores?.social,
            technical_score: result?.scores?.technical,
            conversion_score: result?.scores?.conversion,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setCaptureError(data.error || 'Something broke. Try again?')
        setCapturing(false)
        return
      }
      setCaptured(true)
      setCapturing(false)
    } catch {
      setCaptureError('Network error. Try again?')
      setCapturing(false)
    }
  }

  const SCORE_CARDS = result ? [
    { key: 'seo',        label: 'SEO',         score: result.scores.seo,        icon: Search },
    { key: 'social',     label: 'Social / OG', score: result.scores.social,     icon: ImageIcon },
    { key: 'technical',  label: 'Technical',   score: result.scores.technical,  icon: Shield },
    { key: 'conversion', label: 'Conversion',  score: result.scores.conversion, icon: Gauge },
  ] : []

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO + INPUT */}
      <section className="sb-pad" style={{ padding: '96px 40px 32px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: R + '22', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: T + '22', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => navigate('/demos')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: FH, marginBottom: 16, padding: 0,
          }}
            onMouseEnter={e => e.currentTarget.style.color = INK}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}
          >
            <ArrowLeft size={14} /> All demos
          </button>

          <div className="fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 100, border: `1px solid ${HAIR}`,
            background: WASH, fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GRN }} />
            Live · pulls real signals · no signup
          </div>

          <h1 className="sb-hero-h1 fade" style={{
            fontSize: 64, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, margin: '0 auto',
          }}>
            Scan your business<br />in 20 seconds.
          </h1>
          <p style={{ fontSize: 18, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 680, margin: '18px auto 0' }}>
            Paste any URL. We fetch the live page, measure SEO + social + technical + conversion
            signals, and Claude writes the three most important fixes — ranked by impact.
          </p>

          {/* Input */}
          <form onSubmit={runScan} style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
            background: W, padding: 8, borderRadius: 14,
            border: `1px solid ${HAIR}`, maxWidth: 620, margin: '32px auto 0',
            boxShadow: '0 10px 28px rgba(17,17,17,.06)',
          }}>
            <input
              type="text"
              placeholder="yourbusiness.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={running}
              style={{
                flex: 1, minWidth: 240, border: 'none', outline: 'none',
                padding: '14px 16px', fontSize: 16, fontFamily: FB, color: INK,
                background: 'transparent',
              }}
            />
            <button type="submit" disabled={running || !url.trim()} className="btn btn-primary" style={{ padding: '14px 24px', fontSize: 15 }}>
              {running ? 'Scanning…' : <>Scan it <ArrowRight size={14} /></>}
            </button>
          </form>

          {error && (
            <div style={{
              maxWidth: 620, margin: '14px auto 0',
              fontSize: 13, color: '#dc2626', fontFamily: FB, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 12, color: FAINT, fontFamily: FB }}>
            Tip: you can drop any competitor's URL in here. We only read public HTML.
          </div>
        </div>
      </section>

      {/* STAGE PROGRESS */}
      {(running || result) && (
        <section className="sb-pad" style={{ padding: '32px 40px', background: SURFACE, borderTop: `1px solid ${HAIR}` }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAGES.map((s, i) => {
                const done = stage > i
                const active = stage === i
                const Icon = s.icon
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 18px',
                    background: done ? W : active ? W : '#f3f4f6',
                    border: `1px solid ${done ? HAIR : active ? INK : HAIR}`,
                    borderRadius: 12,
                    opacity: done || active ? 1 : 0.55,
                    transition: 'all .3s',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: done ? GRN : active ? INK : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      animation: active ? 'pulse 1.2s infinite' : undefined,
                    }}>
                      {done ? <Check size={14} color={W} /> : <Icon size={14} color={active ? W : MUTED} />}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, color: INK, fontWeight: done ? 600 : active ? 700 : 500, fontFamily: FB }}>
                      {s.label}
                    </div>
                    {active && (
                      <div style={{ fontSize: 12, color: MUTED, fontFamily: FH, fontWeight: 600 }}>
                        <span className="shim" style={{ padding: '2px 12px', borderRadius: 6 }}>working…</span>
                      </div>
                    )}
                    {done && (
                      <div style={{ fontSize: 12, color: GRN, fontWeight: 700, fontFamily: FH }}>DONE</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* RESULTS */}
      {result && (
        <section ref={resultsRef} className="sb-pad" style={{ padding: '64px 40px', borderTop: `1px solid ${HAIR}` }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 8 }}>
                Scan complete
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 900, fontFamily: FH, letterSpacing: '-.025em', color: INK, lineHeight: 1.1, marginBottom: 6, wordBreak: 'break-all' }}>
                {(result.finalUrl || result.url).replace(/^https?:\/\//, '')}
              </h2>
              <div style={{ fontSize: 13, color: MUTED, fontFamily: FB }}>
                HTTP {result.httpStatus} · {result.ttfbMs}ms first byte · {(result.signals.htmlBytes / 1024).toFixed(1)} KB
              </div>
            </div>

            {/* Scores grid */}
            <div className="sb-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
              {SCORE_CARDS.map(c => {
                const Icon = c.icon
                const color = scoreColor(c.score)
                return (
                  <div key={c.key} style={{
                    background: W, border: `1px solid ${HAIR}`, borderRadius: 14,
                    padding: '22px 20px', position: 'relative', overflow: 'hidden',
                  }}>
                    <div aria-hidden="true" style={{
                      position: 'absolute', bottom: -40, right: -40, width: 120, height: 120,
                      borderRadius: '50%', background: color + '14',
                    }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: color + '18',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} color={color} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH }}>{c.label}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <div style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', color, lineHeight: 1 }}>
                          {c.score}
                        </div>
                        <div style={{ fontSize: 15, color: MUTED, fontFamily: FH, fontWeight: 600 }}>/ 100</div>
                        <div style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 900, fontFamily: FH, color }}>{scoreGrade(c.score)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Overall + AI summary */}
            <div className="sb-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20, marginBottom: 32 }}>
              {/* Overall tile */}
              <div style={{
                background: INK, color: W, borderRadius: 16, padding: '28px 26px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: scoreColor(result.scores.overall) + '40', filter: 'blur(60px)' }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.55)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
                    Overall score
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 64, fontWeight: 900, fontFamily: FH, letterSpacing: '-.03em', lineHeight: 1 }}>
                      {result.scores.overall}
                    </div>
                    <div style={{ fontSize: 18, color: 'rgba(255,255,255,.6)', fontFamily: FH, fontWeight: 600 }}>/ 100</div>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontFamily: FB }}>
                    Grade <strong style={{ color: W }}>{scoreGrade(result.scores.overall)}</strong> — average of the four dimensions
                  </div>
                </div>
              </div>

              {/* AI summary */}
              <div style={{
                background: W, border: `1.5px solid ${HAIR}`, borderRadius: 16, padding: '28px 26px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, background: R + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={14} color={R} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH }}>
                    Claude's read
                  </div>
                </div>
                <div style={{ fontSize: 15, color: INK, fontFamily: FB, lineHeight: 1.65 }}>
                  {result.aiSummary || 'Claude summary unavailable for this run — signals still captured above.'}
                </div>
              </div>
            </div>

            {/* Top 3 fixes */}
            {result.topFixes && result.topFixes.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
                  Top 3 fixes — ranked by conversion impact
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="sb-grid-4">
                  {result.topFixes.map((fix, i) => (
                    <div key={i} style={{
                      background: W, border: `1px solid ${HAIR}`, borderRadius: 14, padding: '22px 22px',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: -14, left: 20,
                        width: 30, height: 30, borderRadius: 8, background: INK, color: W,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 900, fontFamily: FH,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 14, color: INK, fontFamily: FB, lineHeight: 1.6, paddingTop: 10 }}>
                        {fix}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signals table */}
            <details style={{
              background: SURFACE, border: `1px solid ${HAIR}`, borderRadius: 14, padding: '20px 24px',
            }}>
              <summary style={{ fontSize: 14, fontWeight: 800, color: INK, fontFamily: FH, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: R }}>◆</span>
                See all {Object.keys(result.signals).length} raw signals we pulled
              </summary>
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {Object.entries(result.signals).map(([k, v]) => {
                  const display =
                    v === null || v === undefined ? '—' :
                    typeof v === 'boolean' ? (v ? 'yes' : 'no') :
                    Array.isArray(v) ? (v.length ? v.join(', ') : '—') :
                    String(v)
                  const good =
                    typeof v === 'boolean' ? v :
                    (k === 'imagesWithoutAlt' ? Number(v) === 0 : null)
                  return (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                      padding: '8px 12px', background: W, border: `1px solid ${HAIR}`, borderRadius: 8,
                      fontSize: 13, fontFamily: FB,
                    }}>
                      <div style={{ color: MUTED, fontWeight: 600, flexShrink: 0 }}>{k}</div>
                      <div style={{
                        color: good === true ? GRN : good === false ? R : INK,
                        fontWeight: 700, textAlign: 'right',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 180,
                      }}>
                        {display}
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>

            {/* Email capture for full report */}
            <div style={{
              marginTop: 40, padding: '36px 32px',
              background: `linear-gradient(135deg, ${R}0d, ${T}0d)`,
              border: `1px solid ${HAIR}`, borderRadius: 18,
            }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 6 }}>
                    Want the full 40-point audit?
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.15, marginBottom: 6 }}>
                    Get a written audit + fix list in your inbox.
                  </h3>
                  <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>
                    We'll expand this scan into a deeper report across 40+ checkpoints plus a 20-min
                    invite to walk it with the team.
                  </p>
                </div>
                <div style={{ flex: '0 0 auto', minWidth: 280 }}>
                  {!captured ? (
                    <form onSubmit={sendFullReport} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input type="email" required placeholder="you@company.com" value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} disabled={capturing} style={{
                        flex: 1, minWidth: 180, border: `1px solid ${HAIR}`, outline: 'none',
                        padding: '12px 14px', fontSize: 14, fontFamily: FB, color: INK,
                        borderRadius: 8, background: W,
                      }} />
                      <button type="submit" disabled={capturing || !captureEmail.trim()} className="btn btn-primary" style={{ padding: '12px 18px', fontSize: 13 }}>
                        {capturing ? 'Sending…' : <>Email me the audit <ArrowRight size={13} /></>}
                      </button>
                    </form>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 16px', background: W, border: `1.5px solid ${GRN}`,
                      borderRadius: 10,
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: GRN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={14} color={W} />
                      </div>
                      <div style={{ fontSize: 13, color: INK, fontFamily: FB, fontWeight: 600 }}>
                        Sent. Check your inbox for the full audit + Calendly invite.
                      </div>
                    </div>
                  )}
                  {captureError && <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', fontFamily: FB }}>{captureError}</div>}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA — shown always */}
      <section className="sb-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.08, marginBottom: 14 }}>
              This is what one of our tools does in 20 seconds.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              Imagine one that runs your sales calls, another that books appointments, another that
              builds proposals, another that ships your next website. Book 20 minutes — we'll scope
              yours live.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a 20-min call <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn" style={{ background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)' }}>
                <Phone size={14} /> {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

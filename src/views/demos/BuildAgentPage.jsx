"use client"

import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, Sparkles, Bot, Check, RefreshCw,
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
  @keyframes blink { 50% { opacity: 0; } }
  .fade { animation: fadeUp .6s ease both; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; padding: 12px 22px; font-size: 14px; text-decoration: none; }
  .btn-primary { background: ${INK}; color: ${W}; }
  .btn-primary:hover:not(:disabled) { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-primary:disabled { background: ${FAINT}; cursor: default; }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .cursor { display: inline-block; width: 8px; height: 1.1em; background: ${R}; vertical-align: -2px; margin-left: 2px; animation: blink 1s steps(2) infinite; }
  .md h3 { font-size: 18px; font-weight: 900; font-family: ${FH}; letter-spacing: -.02em; color: ${INK}; margin: 28px 0 12px; padding-bottom: 10px; border-bottom: 1px solid ${HAIR}; }
  .md h3:first-child { margin-top: 0; }
  .md p { font-size: 15px; color: #374151; font-family: ${FB}; line-height: 1.65; margin-bottom: 12px; }
  .md ul { margin: 6px 0 14px 0; padding-left: 22px; }
  .md li { font-size: 15px; color: #374151; font-family: ${FB}; line-height: 1.65; margin-bottom: 6px; }
  .md strong { color: ${INK}; font-weight: 800; }
  .md code { background: ${SURFACE}; border: 1px solid ${HAIR}; border-radius: 5px; padding: 1px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: ${R}; }
  .md pre { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 10px 0 18px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; }
  .md pre code { background: transparent; border: none; padding: 0; color: inherit; font-size: inherit; }
  @media (max-width: 900px) {
    .ba-hero-h1 { font-size: 40px !important; }
    .ba-pad     { padding: 56px 20px !important; }
    .ba-split   { grid-template-columns: 1fr !important; }
  }
`

// Preset business descriptions — lower the friction to try the demo
const PRESETS = [
  { industry: 'Dental', text: 'A 4-provider dental practice in Miami. We do general dentistry plus Invisalign and implants. 80% of our new patients come from insurance referrals and Google. Our front desk drops calls when they\'re slammed and after hours we miss everything.' },
  { industry: 'Home services', text: 'Residential roofing company covering three counties in Florida. We run storm-damage campaigns after hurricanes so inbound spikes hard. We have 9 inspectors and need leads qualified and inspections booked within an hour of calling in.' },
  { industry: 'Law firm', text: 'Personal-injury law firm. About half our intake is motor-vehicle cases, the rest medical malpractice and premises liability. We run paid media so the volume is real, but our intake team can\'t handle after-hours and we\'re losing 30%+ of qualified leads.' },
  { industry: 'Real estate', text: 'Luxury-waterfront brokerage in Miami Beach. Average transaction is $2.8M. Our buyer inquiries come through the website and open houses. We need an agent that can qualify buyers, schedule showings, answer neighborhood questions, and hand off to a human agent when serious.' },
]

// Very small markdown → HTML. Handles ##, **bold**, `code`, - lists, paragraphs.
// Good enough for our fixed Claude output shape; not a general parser.
function renderMarkdown(text) {
  if (!text) return ''
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = text.split('\n')
  const out = []
  let inList = false
  let inCodeBlock = false
  let codeBuf = []

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  const flushCode = () => {
    if (codeBuf.length) {
      out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`)
      codeBuf = []
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) { flushCode(); inCodeBlock = false }
      else { closeList(); inCodeBlock = true }
      continue
    }
    if (inCodeBlock) { codeBuf.push(raw); continue }

    if (/^##\s+/.test(line)) {
      closeList()
      const t = line.replace(/^##\s+/, '').replace(/^\d+\.\s*/, '')
      out.push(`<h3>${esc(t)}</h3>`)
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      let item = line.replace(/^\s*[-*]\s+/, '')
      item = formatInline(item)
      out.push(`<li>${item}</li>`)
      continue
    }
    if (!line.trim()) { closeList(); continue }
    // plain paragraph line
    closeList()
    out.push(`<p>${formatInline(line)}</p>`)
  }
  flushCode()
  closeList()
  return out.join('\n')

  function formatInline(s) {
    // Escape first so we don't inject real HTML, then wrap markers.
    s = esc(s)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
    return s
  }
}

export default function BuildAgentPage() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [spec, setSpec] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const controllerRef = useRef(null)
  const outputRef = useRef(null)

  // Lead capture
  const [captureEmail, setCaptureEmail] = useState('')
  const [captured, setCaptured] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState('')

  usePageMeta({
    title: 'Build my AI agent — live spec generator | Koto',
    description: 'Describe your business in two sentences. Watch Claude write a full production-grade AI agent spec live — persona, prompt, tool schemas, sample call, deployment. Free, no signup.',
  })

  const html = useMemo(() => renderMarkdown(spec), [spec])
  const complete = !running && spec.length > 0

  async function run() {
    if (!description.trim() || running) return
    setError('')
    setSpec('')
    setCaptured(false)

    if (controllerRef.current) controllerRef.current.abort()
    const ctrl = new AbortController()
    controllerRef.current = ctrl

    setRunning(true)
    try {
      const res = await fetch('/api/demo/build-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), industry: industry.trim() || undefined }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setSpec((prev) => prev + chunk)
        // Nudge scroll downward as content arrives
        if (outputRef.current) {
          const el = outputRef.current
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          if (nearBottom) el.scrollTop = el.scrollHeight
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Something broke. Try again?')
      }
    }
    setRunning(false)
  }

  function usePreset(p) {
    setIndustry(p.industry)
    setDescription(p.text)
  }

  function reset() {
    if (controllerRef.current) controllerRef.current.abort()
    setSpec('')
    setError('')
    setRunning(false)
  }

  async function sendFullSpec(e) {
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
          magnet: 'build-agent-spec',
          magnet_title: 'Custom AI agent spec',
          page_path: '/demos/build-agent',
          referrer: document.referrer || undefined,
          user_agent: navigator.userAgent,
          extra: {
            industry: industry || '(not provided)',
            description: description.slice(0, 500),
            spec_chars: spec.length,
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

  return (
    <div style={{ minHeight: '100vh', background: W }}>
      <style>{CSS}</style>
      <PublicNav />
      <div style={{ height: 64 }} />

      {/* HERO */}
      <section className="ba-pad" style={{ padding: '96px 40px 32px', position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 40, left: '10%', width: 500, height: 500, borderRadius: '50%', background: R + '22', filter: 'blur(100px)', animation: 'orbPulse 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 100, right: '8%', width: 460, height: 460, borderRadius: '50%', background: T + '22', filter: 'blur(100px)', animation: 'orbPulse 13s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
          <button onClick={() => navigate('/demos')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: FH, marginBottom: 18, padding: 0,
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
            Streamed live from Claude Sonnet 4.5
          </div>

          <h1 className="ba-hero-h1 fade" style={{
            fontSize: 60, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 880,
          }}>
            Build your AI agent in 60 seconds.
          </h1>
          <p style={{ fontSize: 18, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 680, marginTop: 16 }}>
            Describe your business in two sentences. Claude writes a full production-grade agent
            spec — persona, system prompt, tool schemas, sample call, deployment + cost — streaming
            live into your browser.
          </p>
        </div>
      </section>

      {/* SPLIT INPUT / OUTPUT */}
      <section className="ba-pad" style={{ padding: '32px 40px 96px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="ba-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20, alignItems: 'flex-start' }}>

            {/* Input panel */}
            <div style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
              padding: '24px 22px', position: 'sticky', top: 88, zIndex: 1,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
                Your business
              </div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 6 }}>
                Industry <span style={{ color: FAINT, fontWeight: 500 }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Dental, Home services, Legal"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                disabled={running}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${HAIR}`, outline: 'none', fontSize: 14,
                  fontFamily: FB, color: INK, marginBottom: 16, background: W,
                }}
              />

              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 6 }}>
                Describe your business <span style={{ color: R }}>*</span>
              </label>
              <textarea
                placeholder="Two or three sentences. Who do you serve? What does the agent need to do? Where are you losing opportunities today?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={running}
                rows={6}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: `1px solid ${HAIR}`, outline: 'none', fontSize: 14,
                  fontFamily: FB, color: INK, resize: 'vertical', background: W,
                  lineHeight: 1.55,
                }}
              />
              <div style={{ fontSize: 11, color: FAINT, fontFamily: FB, marginTop: 4, textAlign: 'right' }}>
                {description.length} / 1200
              </div>

              {/* Presets */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 8 }}>
                  Or pick a starter
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESETS.map(p => (
                    <button key={p.industry} onClick={() => usePreset(p)} disabled={running} style={{
                      padding: '6px 12px', borderRadius: 100, background: SURFACE,
                      border: `1px solid ${HAIR}`, color: INK, fontSize: 12, fontWeight: 700,
                      fontFamily: FH, cursor: running ? 'default' : 'pointer', transition: 'all .15s',
                    }}
                      onMouseEnter={e => { if (!running) { e.currentTarget.style.borderColor = INK } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = HAIR }}
                    >
                      {p.industry}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button onClick={run} disabled={running || !description.trim()} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px 20px' }}>
                  {running ? 'Writing…' : spec ? <><RefreshCw size={14} /> Regenerate</> : <>Build it <ArrowRight size={14} /></>}
                </button>
                {spec && !running && (
                  <button onClick={reset} className="btn btn-secondary" style={{ padding: '14px 18px' }}>
                    Clear
                  </button>
                )}
              </div>

              {error && (
                <div style={{ marginTop: 12, fontSize: 13, color: '#dc2626', fontFamily: FB, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 11, color: FAINT, fontFamily: FB }}>
                Streams live from Claude Sonnet 4.5. Nothing you enter is stored unless you submit
                your email below.
              </div>
            </div>

            {/* Output panel */}
            <div ref={outputRef} style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
              minHeight: 520, padding: '24px 26px',
              position: 'relative', overflow: 'auto', maxHeight: '80vh',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${HAIR}`, position: 'sticky', top: -24, background: W, paddingTop: 0, marginTop: -2, zIndex: 2 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: R + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={18} color={R} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em' }}>
                    Koto agent spec
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, fontFamily: FB }}>
                    {running ? 'Generating live…' : spec ? 'Complete — scroll through below' : 'Fill the form to begin'}
                  </div>
                </div>
                {running && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', fontFamily: FH }}>
                    <Sparkles size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> STREAMING
                  </div>
                )}
                {complete && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: GRN, letterSpacing: '.08em', fontFamily: FH, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> DONE
                  </div>
                )}
              </div>

              {!spec && !running && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minHeight: 360, padding: '20px 20px', textAlign: 'center',
                }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: SURFACE, border: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Bot size={26} color={FAINT} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: INK, letterSpacing: '-.015em', marginBottom: 6 }}>
                    Your spec will stream here.
                  </div>
                  <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55, maxWidth: 380 }}>
                    Persona · system prompt · tool schemas · a sample call · deployment + cost. About 60 seconds end-to-end.
                  </div>
                </div>
              )}

              {(spec || running) && (
                <div className="md" dangerouslySetInnerHTML={{
                  __html: html + (running ? '<span class="cursor"></span>' : ''),
                }} />
              )}
            </div>
          </div>

          {/* Email capture — shown only when spec is complete */}
          {complete && (
            <div style={{
              marginTop: 32, padding: '32px 32px',
              background: `linear-gradient(135deg, ${R}0d, ${T}0d)`,
              border: `1px solid ${HAIR}`, borderRadius: 18,
              display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 6 }}>
                  Like what you see?
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.15, marginBottom: 6 }}>
                  Get this spec emailed + a 20-min call to deploy it.
                </h3>
                <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>
                  We'll send the full spec to your inbox. If you want, hop on a 20-minute call and
                  we'll have your agent live in about a week.
                </p>
              </div>
              <div style={{ flex: '0 0 auto', minWidth: 280 }}>
                {!captured ? (
                  <form onSubmit={sendFullSpec} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input type="email" required placeholder="you@company.com" value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} disabled={capturing} style={{
                      flex: 1, minWidth: 180, border: `1px solid ${HAIR}`, outline: 'none',
                      padding: '12px 14px', fontSize: 14, fontFamily: FB, color: INK,
                      borderRadius: 8, background: W,
                    }} />
                    <button type="submit" disabled={capturing || !captureEmail.trim()} className="btn btn-primary" style={{ padding: '12px 18px', fontSize: 13 }}>
                      {capturing ? 'Sending…' : <>Email + book call <ArrowRight size={13} /></>}
                    </button>
                  </form>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px', background: W, border: `1.5px solid ${GRN}`, borderRadius: 10,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: GRN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={14} color={W} />
                    </div>
                    <div style={{ fontSize: 13, color: INK, fontFamily: FB, fontWeight: 600 }}>
                      Sent — spec + Calendly invite on the way.
                    </div>
                  </div>
                )}
                {captureError && <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', fontFamily: FB }}>{captureError}</div>}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="ba-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.08, marginBottom: 14 }}>
              Spec looks right? Let's build it.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              Book 20 minutes. We'll walk the spec with you live, answer questions, and quote the
              build on the call. Most agents are live in 7–10 days.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ background: R, borderColor: R }} onClick={() => navigate('/contact')}>
                Book a 20-min call <ArrowRight size={14} />
              </button>
              <a href={CONTACT_PHONE_HREF} className="btn" style={{ background: 'transparent', color: W, border: '1px solid rgba(255,255,255,.3)' }}>
                {CONTACT_PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

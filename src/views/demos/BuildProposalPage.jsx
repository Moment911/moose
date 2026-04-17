"use client"

import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, Sparkles, FileText, Check, RefreshCw,
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
  .md ol { margin: 6px 0 14px 0; padding-left: 22px; }
  .md ol li { font-size: 15px; color: #374151; font-family: ${FB}; line-height: 1.65; margin-bottom: 6px; }
  .md strong { color: ${INK}; font-weight: 800; }
  .md em { font-style: italic; }
  .md code { background: ${SURFACE}; border: 1px solid ${HAIR}; border-radius: 5px; padding: 1px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: ${R}; }
  .md table { border-collapse: collapse; width: 100%; margin: 14px 0 20px; font-size: 14px; font-family: ${FB}; }
  .md th { background: ${SURFACE}; text-align: left; padding: 10px 12px; border-bottom: 2px solid ${HAIR}; font-family: ${FH}; font-weight: 800; color: ${INK}; font-size: 13px; }
  .md td { padding: 10px 12px; border-bottom: 1px solid ${HAIR}; color: #374151; }
  .md tr:last-child td { border-bottom: none; }
  @media (max-width: 900px) {
    .bp-hero-h1 { font-size: 40px !important; }
    .bp-pad     { padding: 56px 20px !important; }
    .bp-split   { grid-template-columns: 1fr !important; }
  }
`

const PRESETS = [
  { business: 'Brickell Dental Group',   industry: 'Dental',          city: 'Miami, FL',       budget: 6000,  goal: 'Book 30+ new patient consults/mo, focus on Invisalign and implants' },
  { business: 'Summit Roofing',          industry: 'Roofing',          city: 'Houston, TX',     budget: 12000, goal: 'Convert storm-damage leads within 1 hour of calling in; grow inspection book' },
  { business: 'Morales Injury Law',      industry: 'Personal injury',  city: 'Phoenix, AZ',     budget: 20000, goal: 'Grow qualified case intake; reduce after-hours lead loss' },
  { business: 'BayBreeze Realty',        industry: 'Luxury real estate', city: 'Miami Beach, FL', budget: 9000,  goal: 'Book qualified buyer showings for $2M+ waterfront inventory' },
]

// Markdown → HTML — handles headers, bold, italic, inline code, lists,
// pipe tables, paragraphs. Small, dependency-free, tuned for our Claude
// output shape.
function renderMarkdown(text) {
  if (!text) return ''
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s) => {
    s = esc(s)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/(?:^|(?<=\s|[(]))\*([^*\n]+)\*/g, '<em>$1</em>')
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
    return s
  }

  const lines = text.split('\n')
  const out = []
  let i = 0
  let inUl = false, inOl = false

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/\s+$/, '')

    if (/^##\s+/.test(line)) {
      closeLists()
      const t = line.replace(/^##\s+/, '').replace(/^\d+\.\s*/, '')
      out.push(`<h3>${esc(t)}</h3>`)
      i++
      continue
    }

    // Table detection: current line looks like "| col | col |" and next
    // line is a separator like "| --- | --- |"
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      closeLists()
      const header = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
      i += 2
      const rows = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
        rows.push(cells)
        i++
      }
      out.push('<table>')
      out.push('<thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>')
      out.push('<tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>')
      out.push('</table>')
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) { closeLists(); out.push('<ul>'); inUl = true }
      const item = line.replace(/^\s*[-*]\s+/, '')
      out.push(`<li>${inline(item)}</li>`)
      i++
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { closeLists(); out.push('<ol>'); inOl = true }
      const item = line.replace(/^\s*\d+\.\s+/, '')
      out.push(`<li>${inline(item)}</li>`)
      i++
      continue
    }

    if (!line.trim()) { closeLists(); i++; continue }

    closeLists()
    out.push(`<p>${inline(line)}</p>`)
    i++
  }
  closeLists()
  return out.join('\n')
}

function formatBudget(n) {
  if (!n) return ''
  return '$' + Number(n).toLocaleString()
}

export default function BuildProposalPage() {
  const navigate = useNavigate()
  const [business, setBusiness] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [budget, setBudget] = useState(6000)
  const [goal, setGoal] = useState('')

  const [proposal, setProposal] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const controllerRef = useRef(null)
  const outputRef = useRef(null)

  const [captureEmail, setCaptureEmail] = useState('')
  const [captured, setCaptured] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState('')

  usePageMeta({
    title: 'Instant proposal — live AI-generated agency proposal | Koto',
    description: 'Enter your business, industry, and budget. In 60 seconds Claude streams a full 6-section agency proposal — strategy, tiers, ROI projections, next steps. Free, no signup.',
  })

  const html = useMemo(() => renderMarkdown(proposal), [proposal])
  const complete = !running && proposal.length > 0

  async function run() {
    if (!business.trim() || !industry.trim() || !budget || running) return
    setError('')
    setProposal('')
    setCaptured(false)

    if (controllerRef.current) controllerRef.current.abort()
    const ctrl = new AbortController()
    controllerRef.current = ctrl

    setRunning(true)
    try {
      const res = await fetch('/api/demo/build-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: business.trim(),
          industry: industry.trim(),
          city: city.trim() || undefined,
          budget: Number(budget),
          goal: goal.trim() || undefined,
        }),
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
        setProposal((prev) => prev + chunk)
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
    setBusiness(p.business)
    setIndustry(p.industry)
    setCity(p.city)
    setBudget(p.budget)
    setGoal(p.goal)
  }

  function reset() {
    if (controllerRef.current) controllerRef.current.abort()
    setProposal('')
    setError('')
    setRunning(false)
  }

  async function sendFullProposal(e) {
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
          magnet: 'instant-proposal',
          magnet_title: `Instant proposal — ${business}`,
          page_path: '/demos/build-proposal',
          referrer: document.referrer || undefined,
          user_agent: navigator.userAgent,
          extra: {
            business,
            industry,
            city: city || '(not provided)',
            monthly_budget: budget,
            goal: goal || '(not provided)',
            proposal_chars: proposal.length,
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
      <section className="bp-pad" style={{ padding: '96px 40px 32px', position: 'relative' }}>
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

          <h1 className="bp-hero-h1 fade" style={{
            fontSize: 60, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05, color: INK, maxWidth: 880,
          }}>
            Instant proposal, streamed live.
          </h1>
          <p style={{ fontSize: 18, color: MUTED, fontFamily: FB, lineHeight: 1.6, maxWidth: 680, marginTop: 16 }}>
            Enter your business, industry, and monthly budget. Claude writes a full 6-section agency
            proposal — executive summary, strategy, three service tiers, ROI table, next steps —
            right into your browser.
          </p>
        </div>
      </section>

      {/* SPLIT INPUT / OUTPUT */}
      <section className="bp-pad" style={{ padding: '32px 40px 96px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="bp-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 20, alignItems: 'flex-start' }}>

            {/* Input panel */}
            <div style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
              padding: '24px 22px', position: 'sticky', top: 88, zIndex: 1,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 10 }}>
                Your business profile
              </div>

              <Row label="Business name" required>
                <input type="text" placeholder="e.g. Brickell Dental Group" value={business} onChange={e => setBusiness(e.target.value)} disabled={running} style={inputStyle} />
              </Row>

              <Row label="Industry" required>
                <input type="text" placeholder="e.g. Dental, Roofing, Law" value={industry} onChange={e => setIndustry(e.target.value)} disabled={running} style={inputStyle} />
              </Row>

              <Row label="City / market" optional>
                <input type="text" placeholder="e.g. Miami, FL" value={city} onChange={e => setCity(e.target.value)} disabled={running} style={inputStyle} />
              </Row>

              <Row label={<>Monthly budget <span style={{ color: R, fontWeight: 800, marginLeft: 6 }}>{formatBudget(budget)}</span></>}>
                <input type="range" min="500" max="50000" step="500" value={budget} onChange={e => setBudget(Number(e.target.value))} disabled={running} style={{ width: '100%', accentColor: R }} />
              </Row>

              <Row label="Primary goal" optional>
                <textarea rows={3} placeholder="What do you want in 90 days? (optional)" value={goal} onChange={e => setGoal(e.target.value)} disabled={running} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </Row>

              {/* Presets */}
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 8 }}>
                  Or pick a starter
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESETS.map(p => (
                    <button key={p.business} onClick={() => usePreset(p)} disabled={running} style={{
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

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button onClick={run} disabled={running || !business.trim() || !industry.trim()} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px 20px' }}>
                  {running ? 'Writing…' : proposal ? <><RefreshCw size={14} /> Regenerate</> : <>Write proposal <ArrowRight size={14} /></>}
                </button>
                {proposal && !running && (
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
                Claude writes the proposal live. Your inputs stay local unless you submit your email below.
              </div>
            </div>

            {/* Output panel */}
            <div ref={outputRef} style={{
              background: W, border: `1px solid ${HAIR}`, borderRadius: 16,
              minHeight: 520, padding: '24px 26px',
              overflow: 'auto', maxHeight: '80vh',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${HAIR}`, position: 'sticky', top: -24, background: W, paddingTop: 0, marginTop: -2, zIndex: 2 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: R + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color={R} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.015em' }}>
                    {business || 'Your proposal'}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, fontFamily: FB }}>
                    {running ? 'Streaming from Claude Sonnet 4.5…' : proposal ? 'Complete' : 'Fill the form on the left to begin'}
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

              {!proposal && !running && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minHeight: 380, padding: '20px 20px', textAlign: 'center',
                }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: SURFACE, border: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <FileText size={26} color={FAINT} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FH, color: INK, letterSpacing: '-.015em', marginBottom: 6 }}>
                    Your proposal will stream here.
                  </div>
                  <div style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55, maxWidth: 400 }}>
                    Executive summary · situation analysis · strategy · three tiers · ROI table · next steps. About 60 seconds end-to-end.
                  </div>
                </div>
              )}

              {(proposal || running) && (
                <div className="md" dangerouslySetInnerHTML={{
                  __html: html + (running ? '<span class="cursor"></span>' : ''),
                }} />
              )}
            </div>
          </div>

          {/* Email capture */}
          {complete && (
            <div style={{
              marginTop: 32, padding: '32px 32px',
              background: `linear-gradient(135deg, ${R}0d, ${T}0d)`,
              border: `1px solid ${HAIR}`, borderRadius: 18,
              display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: R, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: FH, marginBottom: 6 }}>
                  Looks close?
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: INK, lineHeight: 1.15, marginBottom: 6 }}>
                  Get this proposal refined + a 20-min walk-through.
                </h3>
                <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.55 }}>
                  We'll tighten the proposal against your real numbers, send it back, and include a
                  Calendly link if you want to walk it with the team live.
                </p>
              </div>
              <div style={{ flex: '0 0 auto', minWidth: 280 }}>
                {!captured ? (
                  <form onSubmit={sendFullProposal} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input type="email" required placeholder="you@company.com" value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} disabled={capturing} style={{
                      flex: 1, minWidth: 180, border: `1px solid ${HAIR}`, outline: 'none',
                      padding: '12px 14px', fontSize: 14, fontFamily: FB, color: INK,
                      borderRadius: 8, background: W,
                    }} />
                    <button type="submit" disabled={capturing || !captureEmail.trim()} className="btn btn-primary" style={{ padding: '12px 18px', fontSize: 13 }}>
                      {capturing ? 'Sending…' : <>Email + schedule <ArrowRight size={13} /></>}
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
                      Sent — refined proposal + call invite on the way.
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
      <section className="bp-pad" style={{ padding: '96px 40px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', background: INK, borderRadius: 24,
          padding: '56px 48px', textAlign: 'center', color: W, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: R + '30', filter: 'blur(70px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', bottom: -100, left: -100, width: 280, height: 280, borderRadius: '50%', background: T + '30', filter: 'blur(70px)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, letterSpacing: '-.02em', color: W, lineHeight: 1.08, marginBottom: 14 }}>
              Ship this proposal live on a 20-min call.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', fontFamily: FB, lineHeight: 1.6, marginBottom: 24, maxWidth: 540, margin: '0 auto 24px' }}>
              We'll walk it with you, tune numbers to your reality, and quote the first month on the call.
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

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${HAIR}`, outline: 'none', fontSize: 14,
  fontFamily: FB, color: INK, background: W,
}

function Row({ label, required, optional, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: INK, fontFamily: FH, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: R, marginLeft: 6 }}>*</span>}
        {optional && <span style={{ color: FAINT, fontWeight: 500, marginLeft: 6 }}>(optional)</span>}
      </label>
      {children}
    </div>
  )
}

"use client"
import { useState, useEffect } from 'react'
import {
  FileText, Loader2, CheckCircle, XCircle, AlertCircle, Zap, Target,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function grade(score) {
  if (score >= 90) return { g: 'A', c: GRN }
  if (score >= 75) return { g: 'B', c: GRN }
  if (score >= 60) return { g: 'C', c: AMB }
  if (score >= 40) return { g: 'D', c: AMB }
  return { g: 'F', c: R }
}

function ScoreRing({ score, size = 130 }) {
  const { c, g } = grade(score)
  const radius = (size - 14) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.3, fontWeight: 900, color: c }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: '#1f1f22', fontWeight: 700 }}>Grade {g}</div>
      </div>
    </div>
  )
}

function CheckRow({ label, status, detail }) {
  const icon = status === 'pass' ? <CheckCircle size={14} color={GRN} />
    : status === 'fail' ? <XCircle size={14} color="#0a0a0a" />
    : <AlertCircle size={14} color={AMB} />
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9f9fb', marginBottom: 4 }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  )
}

export default function OnPageTab({ clientId, agencyId, prefilledForm }) {
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)
  // Conversational bot prefill
  useEffect(() => {
    if (!prefilledForm) return
    if (prefilledForm.url) setUrl(prefilledForm.url)
    if (prefilledForm.target_keyword) setKeyword(prefilledForm.target_keyword)
  }, [prefilledForm])

  const run = async () => {
    if (!url.trim() || !keyword.trim()) return toast.error('URL and keyword required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_on_page', client_id: clientId, agency_id: agencyId, url, keyword }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('On-page analysis complete')
    } catch (e) {
      toast.error(e.message || 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="on_page" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color="#0a0a0a" /> On-Page Audit
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Checks title, meta, headings, keyword placement, schema, and more.
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/page" style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          marginBottom: 10, boxSizing: 'border-box',
        }} />
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Target keyword" style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          marginBottom: 10, boxSizing: 'border-box',
        }} />
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={14} />}
          {running ? 'Analyzing...' : 'Analyze Page'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
            <ScoreRing score={data.overall_score || 0} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: BLK }}>{url}</div>
              <div style={{ fontSize: 12, color: '#1f1f22', marginTop: 4 }}>
                {data.checks?.filter(c => c.status === 'pass').length || 0} pass --
                {' '}{data.checks?.filter(c => c.status === 'warning').length || 0} warn --
                {' '}{data.checks?.filter(c => c.status === 'fail').length || 0} fail
              </div>
            </div>
          </div>

          {data.keyword_placement && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color="#0a0a0a" /> Keyword Placement
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {Object.entries(data.keyword_placement).map(([slot, val]) => {
                  const on = !!val
                  return (
                    <div key={slot} style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: on ? GRN + '14' : '#f1f1f6', border: `1px solid ${on ? GRN + '30' : '#ececef'}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 2 }}>{slot.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: on ? GRN : '#8e8e93' }}>
                        {on ? (typeof val === 'boolean' ? '✓ Present' : String(val)) : '✗ Missing'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {data.checks?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>All Checks</div>
              {data.checks.map((c, i) => (
                <CheckRow key={i} label={c.label || c.name} status={c.status} detail={c.detail || c.message} />
              ))}
            </div>
          )}

          {data.critical_fixes?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${R}` }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, marginBottom: 12 }}>Critical Fixes</div>
              {data.critical_fixes.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#f9f9fb', marginBottom: 4 }}>
                  <XCircle size={14} color="#0a0a0a" style={{ marginTop: 2 }} />
                  <div style={{ fontSize: 12, color: '#1f1f22' }}>{typeof f === 'string' ? f : f.fix || f.text}</div>
                </div>
              ))}
            </div>
          )}

          {data.quick_wins?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${GRN}` }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: GRN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color={GRN} /> Quick Wins
              </div>
              {data.quick_wins.map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, background: GRN + '06', marginBottom: 4 }}>
                  <Zap size={14} color={GRN} style={{ marginTop: 2 }} />
                  <div style={{ fontSize: 12, color: '#1f1f22' }}>{typeof w === 'string' ? w : w.win || w.text}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

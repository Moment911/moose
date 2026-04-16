"use client"
import { useState } from 'react'
import {
  Sparkles, Loader2, CheckCircle, XCircle, Brain, Search, MessageSquare, Bot,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const ENGINE_LIST = [
  { key: 'google_ai_overview', label: 'Google AI Overview', Icon: Search,        color: '#4285F4' },
  { key: 'perplexity',         label: 'Perplexity',         Icon: Brain,         color: '#22D3EE' },
  { key: 'chatgpt_search',     label: 'ChatGPT Search',     Icon: Bot,           color: '#10A37F' },
  { key: 'claude',             label: 'Claude',             Icon: Sparkles,      color: '#D97757' },
  { key: 'copilot',            label: 'Copilot',            Icon: MessageSquare, color: '#0078D4' },
]

function ScoreRing({ score, size = 72, color }) {
  const radius = (size - 8) / 2
  const c = 2 * Math.PI * radius
  const offset = c - (score / 100) * c
  const col = color || (score >= 70 ? GRN : score >= 40 ? AMB : R)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={col} strokeWidth={5}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FH, fontSize: size * 0.28, fontWeight: 900, color: col }}>{score}</div>
      </div>
    </div>
  )
}

function EligibilityBadge({ level }) {
  const cfg = {
    high:   { color: GRN, label: 'High' },
    medium: { color: AMB, label: 'Medium' },
    low:    { color: R,   label: 'Low' },
  }[level] || { color: '#374151', label: 'Unknown' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: cfg.color + '14', color: cfg.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
      {cfg.label}
    </span>
  )
}

export default function AEOMultiEngineTab({ clientId, agencyId }) {
  const [content, setContent] = useState('')
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!content.trim() || !keyword.trim()) return toast.error('Content and keyword required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score_multi_engine_aeo', client_id: clientId, agency_id: agencyId, content, keyword }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Multi-engine scoring complete')
    } catch (e) {
      toast.error(e.message || 'Scoring failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color={T} /> Multi-Engine AEO Scoring
        </div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
          Score your content for citation potential across Google AI Overview, Perplexity, ChatGPT Search, Claude, and Copilot.
        </div>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Target keyword (e.g. best running shoes)" style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FH,
          marginBottom: 10, boxSizing: 'border-box',
        }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste your page content here..." rows={8} style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FH,
          resize: 'vertical', marginBottom: 10, boxSizing: 'border-box',
        }} />
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
          {running ? 'Scoring...' : 'Score Content'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24 }}>
            <ScoreRing score={data.overall_aeo_score || 0} size={96} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>Overall AEO Score</div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>Composite score across all engines</div>
              {data.best_positioned_for?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>Best positioned for:</span>
                  {data.best_positioned_for.map((e, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: GRN + '14', color: GRN }}>{e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 14 }}>
            {ENGINE_LIST.map(engine => {
              const e = data.engines?.[engine.key] || {}
              const Icon = engine.Icon
              return (
                <div key={engine.key} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: engine.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color={engine.color} />
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800, color: BLK }}>{engine.label}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <ScoreRing score={e.score || 0} size={60} color={engine.color} />
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}><EligibilityBadge level={e.eligibility} /></div>
                      <div style={{ fontSize: 11, color: '#374151' }}>{e.verdict || 'No analysis'}</div>
                    </div>
                  </div>
                  {e.factors?.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                      {e.factors.slice(0, 6).map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1f2937', marginBottom: 4 }}>
                          {f.pass ? <CheckCircle size={11} color={GRN} /> : <XCircle size={11} color={R} />}
                          <span>{f.label || f.name || String(f)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

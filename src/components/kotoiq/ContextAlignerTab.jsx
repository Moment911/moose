"use client"
import { useState } from 'react'
import { Target, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function ContextAlignerTab({ clientId, agencyId }) {
  const [keyword, setKeyword] = useState('')
  const [outline, setOutline] = useState('')
  const [competitorH2s, setCompetitorH2s] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!keyword.trim() || !outline.trim()) return toast.error('Keyword and outline required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'align_context_vectors', client_id: clientId, agency_id: agencyId,
          keyword, outline, competitor_h2s: competitorH2s.split('\n').map(s => s.trim()).filter(Boolean),
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Context aligned')
    } catch (e) {
      toast.error(e.message || 'Alignment failed')
    } finally {
      setRunning(false)
    }
  }

  const score = data?.alignment_score || 0
  const scoreColor = score >= 70 ? GRN : score >= 40 ? AMB : R

  return (
    <div>
      <HowItWorks tool="context_aligner" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} color="#0a0a0a" /> Context Aligner
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Validate that your content outline covers all expected contexts for the target query.
        </div>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Target keyword" style={inp} />
        <textarea value={outline} onChange={e => setOutline(e.target.value)} placeholder="Your outline (H2s, one per line)" rows={6} style={ta} />
        <textarea value={competitorH2s} onChange={e => setCompetitorH2s(e.target.value)} placeholder="Competitor H2s (optional, one per line)" rows={4} style={ta} />
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
          {running ? 'Aligning...' : 'Align Context'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: scoreColor }}>{score}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK }}>Alignment Score</div>
              <div style={{ fontSize: 13, color: '#1f1f22' }}>How well your outline covers the expected contexts</div>
            </div>
          </div>

          {data.missing_contexts?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${R}` }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={16} color="#0a0a0a" /> Missing Contexts
              </div>
              {data.missing_contexts.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f9f9fb', borderRadius: 8, marginBottom: 4 }}>
                  <XCircle size={14} color="#0a0a0a" style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>{typeof m === 'string' ? m : m.context}</div>
                    {typeof m === 'object' && m.why && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{m.why}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.extraneous_contexts?.length > 0 && (
            <div style={{ ...card, borderLeft: `4px solid ${AMB}` }}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: AMB, marginBottom: 12 }}>Extraneous Contexts (consider removing)</div>
              {data.extraneous_contexts.map((m, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#f9f9fb', borderRadius: 8, marginBottom: 4, fontSize: 12, color: '#1f1f22' }}>
                  {typeof m === 'string' ? m : m.context}
                </div>
              ))}
            </div>
          )}

          {data.recommended_adjustments?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color={GRN} /> Recommended Adjustments
              </div>
              <ol style={{ margin: 0, paddingLeft: 22, color: '#1f1f22' }}>
                {data.recommended_adjustments.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                    {typeof r === 'string' ? r : r.adjustment || r.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const inp = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginBottom: 10, boxSizing: 'border-box' }
const ta = { ...inp, resize: 'vertical' }

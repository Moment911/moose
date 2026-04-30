"use client"
import { useState } from 'react'
import { FileText, Loader2, Star, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function PassageOptimizerTab({ clientId, agencyId }) {
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
        body: JSON.stringify({ action: 'optimize_passages', client_id: clientId, agency_id: agencyId, content, keyword }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Passages optimized')
    } catch (e) {
      toast.error(e.message || 'Optimization failed')
    } finally {
      setRunning(false)
    }
  }

  // Find best passage
  const passages = data?.passages || []
  const best = passages.reduce((b, p) => (!b || (p.snippet_score || 0) > (b.snippet_score || 0)) ? p : b, null)

  return (
    <div>
      <HowItWorks tool="passage_opt" />
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color={T} /> Passage Optimizer
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Optimize passages for featured snippets and AI answer boxes.
        </div>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Target keyword" style={{
          width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FH,
          marginBottom: 10, boxSizing: 'border-box',
        }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste your content..." rows={10} style={{
          width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: FH,
          resize: 'vertical', marginBottom: 10, boxSizing: 'border-box',
        }} />
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
          {running ? 'Optimizing...' : 'Optimize Passages'}
        </button>
      </div>

      {passages.length > 0 && (
        <>
          {best && (
            <div style={{ ...card, borderLeft: `4px solid ${GRN}` }}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: GRN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={16} color={GRN} /> Best Snippet Candidate — Score {best.snippet_score}
              </div>
              <div style={{ padding: 14, background: GRN + '08', borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: '#1f1f22' }}>
                {best.optimized}
              </div>
            </div>
          )}

          {passages.map((p, i) => {
            const color = (p.snippet_score || 0) >= 70 ? GRN : (p.snippet_score || 0) >= 40 ? AMB : R
            return (
              <div key={i} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, flex: 1 }}>Passage {i + 1}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: color + '14', color }}>
                    Snippet score: {p.snippet_score || 0}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 4 }}>Original</div>
                    <div style={{ padding: 12, background: '#f9f9fb', borderRadius: 8, fontSize: 12, color: '#1f2937', lineHeight: 1.5 }}>
                      {p.original}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRN, textTransform: 'uppercase', marginBottom: 4 }}>Optimized</div>
                    <div style={{ padding: 12, background: GRN + '08', borderRadius: 8, fontSize: 12, color: '#1f1f22', lineHeight: 1.5 }}>
                      {p.optimized}
                    </div>
                  </div>
                </div>
                {p.reason && (
                  <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 8, fontStyle: 'italic' }}>
                    Why: {p.reason}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

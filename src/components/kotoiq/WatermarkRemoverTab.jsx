"use client"
import { useState } from 'react'
import { Eraser, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

export default function WatermarkRemoverTab({ clientId, agencyId }) {
  const [content, setContent] = useState('')
  const [aggressiveness, setAggressiveness] = useState(5)
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!content.trim()) return toast.error('Paste content first')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_ai_watermarks', client_id: clientId, agency_id: agencyId,
          content, aggressiveness,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Watermarks removed')
    } catch (e) {
      toast.error(e.message || 'Removal failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="watermark" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eraser size={18} color={T} /> AI Watermark Remover
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Strip hidden AI fingerprints, homoglyphs, and telltale phrases.
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste your AI-generated content..." rows={10} style={{
          width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          resize: 'vertical', marginBottom: 10, boxSizing: 'border-box',
        }} />
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', marginBottom: 6, display: 'block' }}>
            Aggressiveness: <span style={{ color: R }}>{aggressiveness}</span> / 10
          </label>
          <input type="range" min={1} max={10} value={aggressiveness} onChange={e => setAggressiveness(Number(e.target.value))} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#1f1f22', marginTop: 2 }}>
            <span>Minimal changes</span><span>Heavy rewriting</span>
          </div>
        </div>
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Eraser size={14} />}
          {running ? 'Cleaning...' : 'Remove Watermarks'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <Stat label="Watermarks Removed" value={data.watermarks_removed || 0} color={R} />
            <Stat label="Human Score Before" value={`${data.human_score_before || 0}%`} color={AMB} />
            <Stat label="Human Score After" value={`${data.human_score_after || 0}%`} color={GRN} />
          </div>

          <div style={card}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color={GRN} /> Cleaned Content
            </div>
            <div style={{ padding: 14, background: '#f9f9fb', borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: '#1f1f22', whiteSpace: 'pre-wrap' }}>
              {data.cleaned_content}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(data.cleaned_content); toast.success('Copied') }} style={{
              marginTop: 10, padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 12, fontWeight: 700, color: BLK, cursor: 'pointer',
            }}>Copy cleaned text</button>
          </div>

          {data.patterns_detected?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Patterns Detected</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.patterns_detected.map((p, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: '#f1f1f6', color: R }}>
                    {typeof p === 'string' ? p : p.pattern || p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.rewrites?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Diff</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.rewrites.slice(0, 20).map((r, i) => (
                  <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: '#f9f9fb', fontSize: 12, color: R, textDecoration: 'line-through' }}>
                      {r.before}
                    </div>
                    <div style={{ padding: '8px 12px', background: GRN + '08', fontSize: 12, color: GRN }}>
                      {r.after}
                    </div>
                    {r.reason && <div style={{ padding: '6px 12px', fontSize: 11, color: '#1f1f22', borderTop: '1px solid #f3f4f6' }}>{r.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 26, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

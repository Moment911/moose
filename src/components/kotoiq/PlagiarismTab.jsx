"use client"
import { useState, useEffect } from 'react'
import {
  Shield, Loader2, AlertTriangle, CheckCircle, Brain, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function ScoreRing({ score, size = 110, colorFn }) {
  const color = (colorFn || (s => s >= 70 ? GRN : s >= 40 ? AMB : R))(score)
  const radius = (size - 12) / 2
  const c = 2 * Math.PI * radius
  const offset = c - (score / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.3, fontWeight: 900, color }}>{score}</div>
      </div>
    </div>
  )
}

export default function PlagiarismTab({ clientId, agencyId, prefilledForm }) {
  const [content, setContent] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)
  // Conversational bot prefill
  useEffect(() => {
    if (!prefilledForm) return
    if (prefilledForm.content) setContent(prefilledForm.content)
    else if (prefilledForm.url) setContent(prefilledForm.url)
  }, [prefilledForm])

  const run = async () => {
    if (!content.trim()) return toast.error('Paste content first')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_plagiarism', client_id: clientId, agency_id: agencyId, content }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Check complete')
    } catch (e) {
      toast.error(e.message || 'Check failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="plagiarism" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} color="#0a0a0a" /> Plagiarism &amp; AI Detection
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Detect copied content and AI-generated patterns before publishing.
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste the content to check..." rows={10} style={{
          width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          resize: 'vertical', marginBottom: 10, boxSizing: 'border-box',
        }} />
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
          border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
        }}>
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={14} />}
          {running ? 'Checking...' : 'Check'}
        </button>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 0 }}>
              <ScoreRing score={data.originality_score || 0} />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK }}>Originality</div>
                <div style={{ fontSize: 12, color: '#1f1f22' }}>Higher = more unique</div>
              </div>
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 0 }}>
              <ScoreRing score={data.ai_generation_likelihood || 0} colorFn={s => s >= 70 ? R : s >= 40 ? AMB : GRN} />
              <div>
                <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK }}>AI Likelihood</div>
                <div style={{ fontSize: 12, color: '#1f1f22' }}>Higher = more AI-ish</div>
              </div>
            </div>
          </div>

          {data.plagiarized_chunks?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: R, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#0a0a0a" /> Potential Plagiarism ({data.plagiarized_chunks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.plagiarized_chunks.map((c, i) => (
                  <div key={i} style={{ border: `1px solid #ececef`, borderRadius: 10, padding: 14, background: '#f9f9fb' }}>
                    <div style={{ fontSize: 12, color: '#1f1f22', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>
                      "{c.chunk || c.text}"
                    </div>
                    {c.matched_urls?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 4 }}>Matches</div>
                        {c.matched_urls.map((u, j) => (
                          <a key={j} href={u} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 11, color: T, display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10,
                          }}>
                            <ExternalLink size={10} /> {u}
                          </a>
                        ))}
                      </div>
                    )}
                    {c.similarity_pct != null && (
                      <div style={{ fontSize: 11, marginTop: 6, color: R, fontWeight: 700 }}>{c.similarity_pct}% match</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.ai_patterns?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: AMB, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={16} color={AMB} /> AI Patterns Detected
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.ai_patterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#f9f9fb', borderRadius: 8 }}>
                    <AlertTriangle size={14} color={AMB} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BLK }}>{p.pattern || p.name || String(p)}</div>
                      {p.example && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2, fontStyle: 'italic' }}>"{p.example}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.originality_score >= 80 && !data.plagiarized_chunks?.length && (
            <div style={{ ...card, borderLeft: `4px solid ${GRN}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={20} color={GRN} />
                <div>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: GRN }}>Content looks original</div>
                  <div style={{ fontSize: 12, color: '#1f1f22' }}>No significant matches and AI patterns are within human range.</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

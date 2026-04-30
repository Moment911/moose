"use client"
import { useState, useEffect } from 'react'
import { Map, Loader2, Globe, Target, TrendingUp, Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #ececef', padding: '20px 22px', marginBottom: 14 }

export default function CompetitorMapTab({ clientId, agencyId, prefilledForm }) {
  const [url, setUrl] = useState('')
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)
  // Conversational bot prefill
  useEffect(() => {
    if (!prefilledForm) return
    if (prefilledForm.competitor_url) setUrl(prefilledForm.competitor_url)
    else if (prefilledForm.url) setUrl(prefilledForm.url)
  }, [prefilledForm])

  const run = async () => {
    if (!url.trim()) return toast.error('Competitor URL required')
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_competitor_topical_map', client_id: clientId, agency_id: agencyId, url }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Competitor map extracted')
    } catch (e) {
      toast.error(e.message || 'Extraction failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="competitor_map" />
      <div style={card}>
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Map size={18} color="#0a0a0a" /> Competitor Topical Map
        </div>
        <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
          Reverse-engineer a competitor's topical strategy.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://competitor.com" style={{
            flex: 1, padding: '10px 14px', border: '1px solid #ececef', borderRadius: 8, fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          }} />
          <button onClick={run} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
            border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={14} />}
            {running ? 'Extracting...' : 'Extract Map'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {data.central_entity && (
            <div style={{ ...card, borderLeft: `4px solid ${T}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 4 }}>Inferred Central Entity</div>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: T }}>{data.central_entity}</div>
              {data.niche && <div style={{ fontSize: 13, color: '#1f1f22', marginTop: 4 }}>Niche: {data.niche}</div>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color="#0a0a0a" /> Core Topics
              </div>
              {(data.core_topics || []).map((t, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#f9f9fb', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#1f1f22' }}>
                  {typeof t === 'string' ? t : t.topic || t.name}
                </div>
              ))}
              {!data.core_topics?.length && <div style={{ fontSize: 12, color: '#1f1f22' }}>None detected</div>}
            </div>

            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color={AMB} /> Outer Topics
              </div>
              {(data.outer_topics || []).map((t, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#f9f9fb', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#1f1f22' }}>
                  {typeof t === 'string' ? t : t.topic || t.name}
                </div>
              ))}
              {!data.outer_topics?.length && <div style={{ fontSize: 12, color: '#1f1f22' }}>None detected</div>}
            </div>
          </div>

          {data.coverage_comparison && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="#0a0a0a" /> Coverage vs. Client
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Stat label="Client Coverage" value={`${data.coverage_comparison.client_coverage || 0}%`} color="#0a0a0a" />
                <Stat label="Competitor Coverage" value={`${data.coverage_comparison.competitor_coverage || 0}%`} color="#0a0a0a" />
                <Stat label="Gap" value={`${data.coverage_comparison.gap || 0}%`} color={AMB} />
              </div>
              {data.coverage_comparison.missing_topics?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', marginBottom: 6 }}>Topics competitor covers that you don't</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {data.coverage_comparison.missing_topics.map((m, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: '#f1f1f6', color: R }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {data.strategic_insights?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={16} color={AMB} /> Strategic Insights
              </div>
              {data.strategic_insights.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f9f9fb', borderRadius: 8, marginBottom: 4 }}>
                  <Lightbulb size={14} color={AMB} style={{ marginTop: 2 }} />
                  <div style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.5 }}>{typeof s === 'string' ? s : s.insight || s.text}</div>
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

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 10, padding: '14px 18px', border: '1px solid #ececef' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 26, fontWeight: 900, color }}>{value}</div>
    </div>
  )
}

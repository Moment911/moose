"use client"
import { useState, useEffect } from 'react'
import {
  Award, RefreshCw, Loader2, CheckCircle, AlertCircle, TrendingUp,
  Target, BookOpen, Users, Lightbulb,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function gradeFor(score) {
  if (score >= 90) return { grade: 'A', color: GRN }
  if (score >= 75) return { grade: 'B', color: GRN }
  if (score >= 60) return { grade: 'C', color: AMB }
  if (score >= 40) return { grade: 'D', color: AMB }
  return { grade: 'F', color: R }
}

function ScoreRing({ score, size = 140 }) {
  const { color, grade } = gradeFor(score)
  const radius = (size - 14) / 2
  const c = 2 * Math.PI * radius
  const offset = c - (score / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: '#1f1f22', fontWeight: 700, marginTop: 2 }}>Grade {grade}</div>
      </div>
    </div>
  )
}

function QuadrantCard({ label, score, sub, icon: Icon, accent }) {
  const { color } = gradeFor(score)
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 12, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: (accent || T) + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent || T} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: FH }}>{label}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{score ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#1f1f22', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

export default function TopicalAuthorityTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_topical_authority', client_id: clientId }),
    }).then(r => r.json()).then(r => { if (r?.data) setData(r.data) }).catch(() => {})
  }, [clientId])

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit_topical_authority', client_id: clientId, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('Authority audit complete')
    } catch (e) {
      toast.error(e.message || 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <HowItWorks tool="topical_authority" />
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {data ? <ScoreRing score={data.overall_score || 0} /> : (
            <div style={{ width: 140, height: 140, borderRadius: '50%', background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={40} color="#d1d5db" />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: BLK, marginBottom: 4 }}>Topical Authority Score</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
            {data
              ? `${data.clusters?.length || 0} clusters analyzed -- updated ${data.updated_at ? new Date(data.updated_at).toLocaleString() : 'recently'}`
              : 'Score your coverage, content depth, historical data, and competitive position'}
          </div>
          <button onClick={run} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
            border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {running ? 'Auditing...' : data ? 'Re-run Audit' : 'Run Audit'}
          </button>
        </div>
      </div>

      {!data && !running && (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Award size={42} color="#d1d5db" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: BLK, marginBottom: 6 }}>No Authority Audit Yet</div>
          <div style={{ fontSize: 13, color: '#1f2937' }}>Run an audit to see your topical authority score across all clusters.</div>
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <QuadrantCard label="Coverage" score={data.coverage_score} sub="Breadth of your topical universe" icon={Target} accent={T} />
            <QuadrantCard label="Historical Data" score={data.historical_score} sub="Content age + consistency" icon={BookOpen} accent="#8b5cf6" />
            <QuadrantCard label="Content Depth" score={data.depth_score} sub="Detail per cluster" icon={Lightbulb} accent={AMB} />
            <QuadrantCard label="Competitive" score={data.competitive_score} sub="Ranking vs. competitors" icon={Users} accent={GRN} />
          </div>

          {data.clusters?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color={T} /> Cluster Scores
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Cluster</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Score</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Strengths</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Gaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clusters.map((c, i) => {
                      const { color } = gradeFor(c.score || 0)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: BLK }}>{c.name}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color }}>{c.score}</td>
                          <td style={{ padding: '10px 8px', color: '#1f2937' }}>
                            {(c.strengths || []).slice(0, 3).map((s, j) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <CheckCircle size={11} color={GRN} /> {s}
                              </div>
                            ))}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#1f2937' }}>
                            {(c.gaps || []).slice(0, 3).map((g, j) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <AlertCircle size={11} color={R} /> {g}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.recommendations?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={16} color={AMB} /> AI Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recommendations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9f9fb' }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#f1f1f6', color: R, fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <div style={{ flex: 1, fontSize: 13, color: '#1f1f22', lineHeight: 1.5 }}>
                      {typeof r === 'string' ? r : r.recommendation || r.text || ''}
                      {r.priority && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.priority === 'high' ? '#f1f1f6' : '#f1f1f6', color: r.priority === 'high' ? R : AMB }}>{r.priority}</span>}
                    </div>
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

"use client"
import { useState, useEffect } from 'react'
import {
  BarChart2, Loader2, RefreshCw, AlertTriangle, TrendingDown, TrendingUp,
  FileWarning, Copy as CopyIcon, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

function ScoreRing({ score, size = 100 }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : R
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, color }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: '#374151', fontWeight: 600 }}>/ 100</div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function GSCAuditTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!clientId) return
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_gsc_audit', client_id: clientId }),
    }).then(r => r.json()).then(r => { if (r?.data) setData(r.data) }).catch(() => {})
  }, [clientId])

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_gsc_audit', client_id: clientId, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)
      toast.success('GSC audit complete')
    } catch (e) {
      toast.error(e.message || 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {data ? <ScoreRing score={data.health_score || 0} /> : (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={32} color="#d1d5db" />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>GSC Deep Audit</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            {data
              ? `Last run ${data.updated_at ? new Date(data.updated_at).toLocaleString() : 'recently'} -- ${data.total_issues || 0} issues`
              : 'Deep Search Console audit: indexing, CTR anomalies, decay, cannibalization'}
          </div>
          <button onClick={run} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
            border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {running ? 'Auditing...' : data ? 'Re-run' : 'Run Audit'}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="Indexing Issues" value={data.indexing_issues?.length || 0} icon={FileWarning} color={R} sub="Pages not indexed properly" />
            <StatCard label="CTR Anomalies" value={data.ctr_anomalies?.length || 0} icon={AlertTriangle} color={AMB} sub="High impressions, low clicks" />
            <StatCard label="Decaying URLs" value={data.decay_issues?.length || 0} icon={TrendingDown} color={AMB} sub="Losing rankings" />
            <StatCard label="Cannibalization" value={data.cannibalization_issues?.length || 0} icon={CopyIcon} color={R} sub="Competing URLs" />
          </div>

          <IssueTable title="Indexing Issues" color={R} Icon={FileWarning} items={data.indexing_issues} columns={['url', 'status', 'last_crawled']} />
          <IssueTable title="CTR Anomalies" color={AMB} Icon={AlertTriangle} items={data.ctr_anomalies} columns={['url', 'query', 'impressions', 'ctr', 'expected_ctr']} />
          <IssueTable title="Decaying URLs" color={AMB} Icon={TrendingDown} items={data.decay_issues} columns={['url', 'prev_position', 'current_position', 'clicks_lost']} />
          <IssueTable title="Cannibalization" color={R} Icon={CopyIcon} items={data.cannibalization_issues} columns={['query', 'urls', 'severity']} />

          {data.quick_wins?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color={GRN} /> Quick Wins
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.quick_wins.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: GRN + '08', borderRadius: 8, border: `1px solid ${GRN}30` }}>
                    <TrendingUp size={14} color={GRN} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1, fontSize: 12, color: '#374151' }}>{typeof w === 'string' ? w : w.recommendation || w.text || JSON.stringify(w)}</div>
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

function IssueTable({ title, color, Icon, items, columns }) {
  if (!items?.length) return null
  return (
    <div style={card}>
      <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={color} /> {title} ({items.length})
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {columns.map(c => (
                <th key={c} style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>{c.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 20).map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {columns.map(c => (
                  <td key={c} style={{ padding: '8px', color: c === 'url' ? T : '#4b5563', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Array.isArray(it[c]) ? it[c].join(', ') : String(it[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

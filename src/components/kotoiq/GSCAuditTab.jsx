"use client"
import { useState, useEffect } from 'react'
import {
  BarChart2, Loader2, RefreshCw, AlertTriangle, TrendingDown, TrendingUp,
  FileWarning, Copy as CopyIcon, Zap, ShieldAlert, Lightbulb, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

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
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: size * 0.32, fontWeight: 900, color }}>{score}</div>
        <div style={{ fontSize: size * 0.1, color: '#1f1f22', fontWeight: 600 }}>/ 100</div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{ background: '#f9f9fb', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      </div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const SEVERITY = {
  critical: { label: 'Critical', color: R, bg: R + '10', border: R + '30' },
  warning: { label: 'Warning', color: AMB, bg: AMB + '10', border: AMB + '30' },
  info: { label: 'Info', color: '#3b82f6', bg: '#3b82f610', border: '#3b82f630' },
}

const RECOMMENDATIONS = [
  {
    key: 'indexing_issues',
    title: 'Indexing Issues',
    icon: FileWarning,
    severity: 'critical',
    explanation: 'Pages not being indexed are invisible to Google and waste your content investment.',
    actions: [
      'Submit these URLs to Google Search Console using the URL Inspection tool and request indexing.',
      'Check each page for noindex meta tags, canonical mismatches, or robots.txt blocks that prevent crawling.',
      'Ensure internal links point to these pages so Googlebot can discover them naturally.',
    ],
  },
  {
    key: 'ctr_anomalies',
    title: 'CTR Anomalies',
    icon: AlertTriangle,
    severity: 'warning',
    explanation: 'These pages rank well but get fewer clicks than expected for their position.',
    actions: [
      'Rewrite title tags to be more compelling — use numbers, power words, and clear value propositions.',
      'Update meta descriptions with a strong call-to-action and ensure they accurately preview page content.',
      'Add structured data (FAQ, HowTo, Review) to earn rich snippets that increase visual prominence in SERPs.',
    ],
  },
  {
    key: 'decay_issues',
    title: 'Decaying URLs',
    icon: TrendingDown,
    severity: 'warning',
    explanation: 'These pages are losing rankings over time, meaning less organic traffic each month.',
    actions: [
      'Refresh content with new information, updated statistics, and current examples.',
      'Update publish dates and add an "Last updated" note so Google sees freshness signals.',
      'Build 2-3 new internal links from high-authority pages on your site to each decaying URL.',
    ],
  },
  {
    key: 'cannibalization_issues',
    title: 'Cannibalization',
    icon: CopyIcon,
    severity: 'critical',
    explanation: 'Multiple pages competing for the same keyword dilute your authority and confuse Google.',
    actions: [
      'Consolidate competing pages by merging the weaker page into the stronger one and adding a 301 redirect.',
      'Differentiate targeting by updating titles, H1s, and content to focus each page on a distinct keyword variant.',
      'Use canonical tags to signal which page should rank if the pages must remain separate.',
    ],
  },
]

function SeverityBadge({ level }) {
  const s = SEVERITY[level] || SEVERITY.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      <ShieldAlert size={10} /> {s.label}
    </span>
  )
}

function IssueSummaryCard({ data }) {
  const counts = {
    indexing: data.indexing_issues?.length || 0,
    ctr: data.ctr_anomalies?.length || 0,
    decay: data.decay_issues?.length || 0,
    cannibalization: data.cannibalization_issues?.length || 0,
  }
  const critical = counts.indexing + counts.cannibalization
  const warnings = counts.ctr + counts.decay
  const total = critical + warnings

  if (total === 0) return (
    <div style={{ ...card, background: GRN + '08', border: `1px solid ${GRN}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <CheckCircle size={20} color={GRN} />
      <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>No issues detected. Your site looks healthy.</div>
    </div>
  )

  return (
    <div style={{ ...card, background: critical > 0 ? '#f9f9fb' : '#f9f9fb', border: `1px solid ${critical > 0 ? '#e9695c' : AMB}25` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <ShieldAlert size={18} color={critical > 0 ? '#e9695c' : AMB} />
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: BLK }}>
          Your site has {total} issue{total !== 1 ? 's' : ''} that need attention
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#1f1f22', lineHeight: 1.6 }}>
        {critical > 0 && (
          <span><strong style={{ color: R }}>{critical} critical</strong> (indexing + cannibalization) requiring immediate action. </span>
        )}
        {warnings > 0 && (
          <span><strong style={{ color: AMB }}>{warnings} warning{warnings !== 1 ? 's' : ''}</strong> (CTR anomalies + decaying pages) that should be addressed soon.</span>
        )}
      </div>
    </div>
  )
}

function AIRecommendations({ data }) {
  const hasAny = RECOMMENDATIONS.some(r => (data[r.key]?.length || 0) > 0)
  if (!hasAny) return null

  return (
    <div style={card}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lightbulb size={16} color={AMB} /> AI Recommendations
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {RECOMMENDATIONS.map(rec => {
          const count = data[rec.key]?.length || 0
          if (count === 0) return null
          const Icon = rec.icon
          const sev = SEVERITY[rec.severity]
          return (
            <div key={rec.key} style={{ borderRadius: 10, border: `1px solid ${sev.border}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: sev.bg }}>
                <Icon size={14} color={sev.color} />
                <div style={{ flex: 1, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK }}>
                  {rec.title} ({count})
                </div>
                <SeverityBadge level={rec.severity} />
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: '#1f1f22', marginBottom: 10, lineHeight: 1.5 }}>{rec.explanation}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rec.actions.map((action, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, color: sev.color, flexShrink: 0 }}>{i + 1}.</span>
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
      <HowItWorks tool="gsc_audit" />
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {data ? <ScoreRing score={data.health_score || 0} /> : (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={32} color="#d1d5db" />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>GSC Deep Audit</div>
          <div style={{ fontSize: 13, color: '#1f1f22', marginBottom: 12 }}>
            {data
              ? `Last run ${data.updated_at ? new Date(data.updated_at).toLocaleString() : 'recently'} -- ${data.total_issues || 0} issues`
              : 'Deep Search Console audit: indexing, CTR anomalies, decay, cannibalization'}
          </div>
          <button onClick={run} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8,
            border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
            cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1,
          }}>
            {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {running ? 'Auditing...' : data ? 'Re-run' : 'Run Audit'}
          </button>
        </div>
      </div>

      {data && (
        <>
          <IssueSummaryCard data={data} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="Indexing Issues" value={data.indexing_issues?.length || 0} icon={FileWarning} color="#0a0a0a" sub="Pages not indexed properly" />
            <StatCard label="CTR Anomalies" value={data.ctr_anomalies?.length || 0} icon={AlertTriangle} color={AMB} sub="High impressions, low clicks" />
            <StatCard label="Decaying URLs" value={data.decay_issues?.length || 0} icon={TrendingDown} color={AMB} sub="Losing rankings" />
            <StatCard label="Cannibalization" value={data.cannibalization_issues?.length || 0} icon={CopyIcon} color="#0a0a0a" sub="Competing URLs" />
          </div>

          <AIRecommendations data={data} />

          <IssueTable title="Indexing Issues" color="#0a0a0a" Icon={FileWarning} items={data.indexing_issues} columns={['url', 'status', 'last_crawled']} />
          <IssueTable title="CTR Anomalies" color={AMB} Icon={AlertTriangle} items={data.ctr_anomalies} columns={['url', 'query', 'impressions', 'ctr', 'expected_ctr']} />
          <IssueTable title="Decaying URLs" color={AMB} Icon={TrendingDown} items={data.decay_issues} columns={['url', 'prev_position', 'current_position', 'clicks_lost']} />
          <IssueTable title="Cannibalization" color="#0a0a0a" Icon={CopyIcon} items={data.cannibalization_issues} columns={['query', 'urls', 'severity']} />

          {data.quick_wins?.length > 0 && (
            <div style={card}>
              <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color={GRN} /> Quick Wins
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.quick_wins.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: GRN + '08', borderRadius: 8, border: `1px solid ${GRN}30` }}>
                    <TrendingUp size={14} color={GRN} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1, fontSize: 12, color: '#1f1f22' }}>{typeof w === 'string' ? w : w.recommendation || w.text || JSON.stringify(w)}</div>
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
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <td key={c} style={{ padding: '8px', color: c === 'url' ? '#5aa0ff' : '#4b5563', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

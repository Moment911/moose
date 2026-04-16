"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Loader2, RefreshCw, Globe, Smartphone, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Activity, FileText, Zap, Server,
  ExternalLink, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: 'ms', label: 'LCP' },
  fid: { good: 200, poor: 500, unit: 'ms', label: 'INP/FID' },
  cls: { good: 0.1, poor: 0.25, unit: '', label: 'CLS' },
}

function cwvColor(value, metric) {
  if (value === null || value === undefined) return '#9ca3af'
  const t = CWV_THRESHOLDS[metric]
  if (!t) return '#9ca3af'
  if (value <= t.good) return GRN
  if (value <= t.poor) return AMB
  return R
}

function ScoreRing({ score, size = 80, strokeWidth = 6, color }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(score, 100) / 100) * circumference
  const c = color || (score >= 70 ? GRN : score >= 40 ? AMB : R)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, color: c, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>/100</span>
      </div>
    </div>
  )
}

function SubScoreBadge({ label, score, icon: Icon, color }) {
  const c = color || (score >= 70 ? GRN : score >= 40 ? AMB : R)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: c + '0a', borderRadius: 10, border: `1px solid ${c}20` }}>
      <Icon size={14} color={c} />
      <div>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color: c }}>{score}</div>
      </div>
    </div>
  )
}

function ProgressBar({ value, max = 100, color = T, height = 8, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ flex: 1 }}>
      {label && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span><span style={{ fontFamily: FH, fontWeight: 700 }}>{Math.round(pct)}%</span>
      </div>}
      <div style={{ height, borderRadius: height / 2, background: '#f3f4f6', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, background: color, transition: 'width .5s ease' }} />
      </div>
    </div>
  )
}

function IssueBadge({ type }) {
  const colors = { missing: R, non_self: AMB, points_to_404: R, chain: AMB, no_viewport: R, fixed_width: AMB }
  const labels = { missing: 'Missing', non_self: 'Non-Self', points_to_404: '→ 404', chain: 'Chain', no_viewport: 'No Viewport', fixed_width: 'Fixed Width' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: (colors[type] || '#9ca3af') + '14', color: colors[type] || '#9ca3af' }}>
      {labels[type] || type}
    </span>
  )
}

function truncUrl(url, max = 60) {
  if (!url) return '—'
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    return path.length > max ? path.slice(0, max) + '...' : path
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url
  }
}

export default function TechnicalDeepTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [expandCanonical, setExpandCanonical] = useState(false)
  const [expandMobile, setExpandMobile] = useState(false)
  const [expandSitemap, setExpandSitemap] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_technical_deep', client_id: clientId }) })
      const d = await res.json()
      if (d.success && !d.empty) setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const runAudit = async () => {
    setAuditing(true)
    toast('Running deep technical audit... This may take 1-2 minutes.', { icon: '🔍', duration: 5000 })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit_technical_deep', client_id: clientId, agency_id: agencyId }) })
      const d = await res.json()
      if (d.success) { setData(d); toast.success('Technical audit complete') }
      else toast.error(d.error || 'Audit failed')
    } catch { toast.error('Audit failed') }
    setAuditing(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>

  // ── Empty state ──────────────────────────────────────────────────────
  if (!data) return (
    <div style={card}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Server size={40} color={T} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>Technical SEO Deep Audit</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
          Crawl your site to analyze sitemaps, canonical tags, mobile readiness, Core Web Vitals, and index coverage.
        </div>
        <button onClick={runAudit} disabled={auditing} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', background: auditing ? '#e5e7eb' : BLK,
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: auditing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {auditing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
          Run Deep Audit
        </button>
      </div>
    </div>
  )

  const d = data
  const statusDist = d.status_code_distribution || {}
  const statusTotal = Object.values(statusDist).reduce((a, b) => a + b, 0) || 1

  return (
    <>
      {/* Score Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <ScoreRing score={d.overall_score || 0} size={90} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 4 }}>Technical SEO Score</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Last audit: {d.updated_at ? new Date(d.updated_at).toLocaleDateString() : 'Unknown'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <SubScoreBadge label="Crawl Health" score={Math.max(0, 100 - (d.crawl_waste_pct || 0))} icon={Activity} />
            <SubScoreBadge label="Canonical" score={d.canonical_score || 0} icon={FileText} />
            <SubScoreBadge label="Mobile" score={d.mobile_score || 0} icon={Smartphone} />
            <SubScoreBadge label="CWV" score={d.cwv_grade === 'Good' ? 90 : d.cwv_grade === 'Needs Improvement' ? 55 : d.cwv_grade === 'Poor' ? 25 : 50} icon={Zap} />
            <SubScoreBadge label="Index" score={d.indexed_pct || 0} icon={Globe} />
          </div>
        </div>
        <button onClick={runAudit} disabled={auditing} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', background: auditing ? '#e5e7eb' : BLK,
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: auditing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {auditing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
          Re-run Audit
        </button>
      </div>

      {/* 4-Panel Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Crawl Budget */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} color={T} /> Crawl Budget
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Total URLs</div>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: BLK }}>{(d.total_urls || 0).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Indexable</div>
              <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 900, color: GRN }}>{(d.indexable_urls || 0).toLocaleString()}</div>
            </div>
          </div>
          <ProgressBar value={100 - (d.crawl_waste_pct || 0)} label="Crawl Efficiency" color={d.crawl_waste_pct > 30 ? R : d.crawl_waste_pct > 15 ? AMB : GRN} />
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={d.url_value_ratio || 0} label="URL Value Ratio (pages with traffic)" color={T} />
          </div>
        </div>

        {/* Canonical Health */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} color={AMB} /> Canonical Health
              <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color: d.canonical_score >= 70 ? GRN : d.canonical_score >= 40 ? AMB : R, marginLeft: 8 }}>
                {d.canonical_score}
              </span>
            </div>
            {(d.canonical_issues || []).length > 0 && (
              <button onClick={() => setExpandCanonical(!expandCanonical)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                {(d.canonical_issues || []).length} issues {expandCanonical ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          {(d.canonical_issues || []).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRN, fontSize: 13 }}>
              <CheckCircle size={16} /> All canonicals properly configured
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {(d.canonical_issues || []).length} issues found across sampled pages
              </div>
              {expandCanonical && (d.canonical_issues || []).slice(0, 15).map((issue, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f9fafb', fontSize: 12 }}>
                  <IssueBadge type={issue.issue} />
                  <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncUrl(issue.url)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Mobile-First */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={15} color={T} /> Mobile-First
              <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 900, color: d.mobile_score >= 70 ? GRN : d.mobile_score >= 40 ? AMB : R, marginLeft: 8 }}>
                {d.mobile_score}
              </span>
            </div>
            {(d.mobile_mismatches || []).length > 0 && (
              <button onClick={() => setExpandMobile(!expandMobile)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                {(d.mobile_mismatches || []).length} issues {expandMobile ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          {(d.mobile_mismatches || []).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GRN, fontSize: 13 }}>
              <CheckCircle size={16} /> All pages have proper mobile viewport
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {(d.mobile_mismatches || []).length} pages missing viewport meta
              </div>
              {expandMobile && (d.mobile_mismatches || []).slice(0, 15).map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f9fafb', fontSize: 12 }}>
                  <IssueBadge type={m.issue} />
                  <span style={{ color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncUrl(m.url)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Index Coverage */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} color={GRN} /> Index Coverage
          </div>
          <ProgressBar value={d.indexed_pct || 0} label="Indexed" color={d.indexed_pct >= 80 ? GRN : d.indexed_pct >= 50 ? AMB : R} height={10} />
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Status Code Distribution</div>
            {Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([code, count]) => {
              const pct = (count / statusTotal * 100).toFixed(1)
              const color = code === '200' ? GRN : code.startsWith('3') ? AMB : code.startsWith('4') ? R : '#9ca3af'
              return (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 800, color, width: 36 }}>{code}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FH, fontWeight: 600, width: 55, textAlign: 'right' }}>{count} ({pct}%)</span>
                </div>
              )
            })}
            {Object.keys(d.not_indexed_reasons || {}).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Not Indexed Reasons</div>
                {Object.entries(d.not_indexed_reasons).map(([reason, count]) => (
                  <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    <XCircle size={12} color={R} />
                    <span style={{ textTransform: 'capitalize' }}>{reason}</span>
                    <span style={{ fontFamily: FH, fontWeight: 700, marginLeft: 'auto' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={15} color={AMB} /> Core Web Vitals
          <span style={{
            marginLeft: 8, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: d.cwv_grade === 'Good' ? GRN + '14' : d.cwv_grade === 'Poor' ? R + '14' : AMB + '14',
            color: d.cwv_grade === 'Good' ? GRN : d.cwv_grade === 'Poor' ? R : AMB,
          }}>
            {d.cwv_grade || 'No Data'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {[
            ['lcp', d.cwv_lcp, 'LCP', 'Largest Contentful Paint'],
            ['fid', d.cwv_fid, 'INP/FID', 'Interaction to Next Paint'],
            ['cls', d.cwv_cls, 'CLS', 'Cumulative Layout Shift'],
          ].map(([key, value, label, desc]) => (
            <div key={key} style={{ textAlign: 'center', padding: '16px 12px', background: '#fafafa', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{desc}</div>
              <div style={{ fontFamily: FH, fontSize: 32, fontWeight: 900, color: cwvColor(value, key) }}>
                {value !== null && value !== undefined ? (key === 'cls' ? value.toFixed(2) : `${Math.round(value)}`) : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {key === 'cls' ? '' : 'ms'}
                {value !== null && value !== undefined && (
                  <span style={{ marginLeft: 6, fontWeight: 700, color: cwvColor(value, key) }}>
                    {value <= CWV_THRESHOLDS[key]?.good ? 'Good' : value <= CWV_THRESHOLDS[key]?.poor ? 'Needs Work' : 'Poor'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sitemap Analysis */}
      <div style={card}>
        <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={15} color={T} /> Sitemap Analysis
          </div>
          {(d.sitemap_issues || []).length > 0 && (
            <button onClick={() => setExpandSitemap(!expandSitemap)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              {(d.sitemap_issues || []).length} issues {expandSitemap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>URL Count</div>
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK }}>{(d.sitemap_urls_count || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Categorized</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              {d.sitemap_categorized ? <CheckCircle size={16} color={GRN} /> : <XCircle size={16} color={AMB} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: d.sitemap_categorized ? GRN : AMB }}>
                {d.sitemap_categorized ? 'Yes — Index Found' : 'Single Sitemap'}
              </span>
            </div>
          </div>
          {d.sitemap_url && (
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
              <a href={d.sitemap_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                {truncUrl(d.sitemap_url, 40)} <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
        {expandSitemap && (d.sitemap_issues || []).length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
            {(d.sitemap_issues || []).map((issue, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f9fafb' }}>
                <AlertTriangle size={12} color={AMB} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncUrl(issue.url, 50)}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{issue.issue}</span>
                {issue.status && <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 11, color: R }}>{issue.status}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

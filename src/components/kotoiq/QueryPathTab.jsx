"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, RefreshCw, Target, ChevronDown, ChevronUp, ArrowRight, ArrowLeft,
  GitBranch, Layers, Zap, Search, FileText, CheckCircle, XCircle, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const TYPE_CONFIG = {
  topical:     { color: T,        label: 'Topical',     icon: Layers },
  intent:      { color: '#8b5cf6', label: 'Intent',      icon: Target },
  sequential:  { color: AMB,      label: 'Sequential',  icon: GitBranch },
  correlative: { color: GRN,      label: 'Correlative', icon: Search },
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { color: '#4b5563', label: type, icon: Layers }
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: cfg.color + '14', color: cfg.color }}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

function CoverageBar({ covered, total, height = 8 }) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0
  const color = pct >= 70 ? GRN : pct >= 40 ? AMB : R
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4b5563', fontWeight: 600, marginBottom: 3 }}>
        <span>Coverage</span>
        <span style={{ color }}>{pct}% ({covered}/{total})</span>
      </div>
      <div style={{ height, borderRadius: height / 2, background: '#f3f4f6', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: GRN, transition: 'width .5s ease' }} />
        <div style={{ width: `${100 - pct}%`, height: '100%', background: R + '30' }} />
      </div>
    </div>
  )
}

function QueryPill({ keyword, status }) {
  const color = status === 'covered' ? GRN : status === 'gap' ? R : AMB
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: color + '10', color: color, border: `1px solid ${color}25`,
      margin: '2px 3px',
    }}>
      {status === 'covered' ? <CheckCircle size={9} /> : <XCircle size={9} />}
      {keyword}
    </span>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
      <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 900, color: color || BLK }}>{value}</div>
      <div style={{ fontSize: 12, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  )
}

export default function QueryPathTab({ clientId, agencyId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedClusters, setExpandedClusters] = useState({})
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_query_clusters', client_id: clientId }) })
      const d = await res.json()
      if (d.success && !d.empty) setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const runAnalysis = async () => {
    setAnalyzing(true)
    toast('Analyzing query paths with AI... This may take 30-60 seconds.', { icon: '🧠', duration: 5000 })
    try {
      const res = await fetch('/api/kotoiq', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_query_paths', client_id: clientId, agency_id: agencyId }) })
      const d = await res.json()
      if (d.success) { setData(d); toast.success(`Found ${d.total_clusters} query clusters`) }
      else toast.error(d.error || 'Analysis failed')
    } catch { toast.error('Analysis failed') }
    setAnalyzing(false)
  }

  const toggleCluster = (i) => setExpandedClusters(prev => ({ ...prev, [i]: !prev[i] }))

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} color={T} style={{ animation: 'spin 1s linear infinite' }} /></div>

  // ── Empty state ──────────────────────────────────────────────────────
  if (!data) return (
    <div style={card}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <GitBranch size={40} color={T} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: BLK, marginBottom: 8 }}>Query Path Analyzer</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, maxWidth: 440, margin: '0 auto 20px' }}>
          Discover how users search for your services. Group keywords into clusters based on topical, intent, and sequential patterns to find content gaps.
        </div>
        <button onClick={runAnalysis} disabled={analyzing} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', background: analyzing ? '#e5e7eb' : BLK,
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: analyzing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {analyzing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
          Analyze Query Paths
        </button>
      </div>
    </div>
  )

  const clusters = data.clusters || []

  return (
    <>
      {/* Header Stats */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <StatBox label="Clusters" value={data.total_clusters || 0} color={T} />
        <StatBox label="Total Queries" value={data.total_queries || 0} color={BLK} />
        <StatBox label="Avg Coverage" value={`${data.avg_coverage_pct || 0}%`} color={data.avg_coverage_pct >= 70 ? GRN : data.avg_coverage_pct >= 40 ? AMB : R} />
        <StatBox label="Gap Queries" value={(data.all_gaps || []).length} color={R} />
        <button onClick={runAnalysis} disabled={analyzing} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', background: analyzing ? '#e5e7eb' : BLK,
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: analyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {analyzing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
          Re-analyze
        </button>
      </div>

      {/* Cluster Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {clusters.map((cluster, i) => {
          const expanded = expandedClusters[i]
          const queries = cluster.queries || []
          const gapQueries = cluster.gap_queries || []
          const coveredSet = new Set(
            queries
              .filter(q => !gapQueries.includes(q.keyword))
              .map(q => q.keyword.toLowerCase().trim())
          )

          return (
            <div key={i} style={{ ...card, marginBottom: 0 }}>
              {/* Cluster Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 4 }}>
                    {cluster.cluster_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TypeBadge type={cluster.cluster_type} />
                    <span style={{ fontSize: 11, color: '#4b5563' }}>{queries.length} queries</span>
                  </div>
                </div>
                <button onClick={() => toggleCluster(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', padding: 4 }}>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Seed Query */}
              <div style={{ padding: '6px 12px', background: T + '08', borderRadius: 8, border: `1px solid ${T}20`, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={12} color={T} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T }}>Seed:</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: BLK }}>{cluster.seed_query}</span>
              </div>

              {/* Coverage Bar */}
              <CoverageBar covered={cluster.covered_queries || 0} total={cluster.total_queries || 0} />

              {/* Query Pills */}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap' }}>
                {queries.slice(0, expanded ? 50 : 8).map((q, j) => (
                  <QueryPill key={j} keyword={q.keyword} status={coveredSet.has(q.keyword.toLowerCase().trim()) ? 'covered' : 'gap'} />
                ))}
                {!expanded && queries.length > 8 && (
                  <span style={{ fontSize: 11, color: '#4b5563', padding: '5px 8px', cursor: 'pointer' }} onClick={() => toggleCluster(i)}>
                    +{queries.length - 8} more
                  </span>
                )}
              </div>

              {/* Expanded: Next/Prev queries + gap actions */}
              {expanded && (
                <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                  {/* Session depth */}
                  <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 8 }}>
                    Avg session depth: <span style={{ fontFamily: FH, fontWeight: 700, color: BLK }}>{cluster.avg_session_depth || '—'}</span> queries
                  </div>

                  {/* Next queries */}
                  {(cluster.common_next_queries || []).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowRight size={10} /> Users search next
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cluster.common_next_queries.map((q, j) => (
                          <span key={j} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Previous queries */}
                  {(cluster.common_prev_queries || []).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ArrowLeft size={10} /> Users searched before
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cluster.common_prev_queries.map((q, j) => (
                          <span key={j} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gap action */}
                  {gapQueries.length > 0 && (
                    <button onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.set('tab', 'briefs')
                      navigate(url.pathname + url.search)
                    }} style={{
                      marginTop: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${T}40`, background: T + '08',
                      color: T, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <FileText size={11} /> Create Content for {gapQueries.length} Gaps
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Coverage Summary */}
      {(data.all_gaps || []).length > 0 && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={15} color={R} /> Gap Queries — No Ranking Content
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            {(data.all_gaps || []).length} keywords with no ranking page. Create content to capture this traffic.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {(data.all_gaps || []).slice(0, 40).map((q, i) => (
              <span key={i} style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: R + '0a', color: R, border: `1px solid ${R}20`, margin: '2px 3px',
              }}>
                {q}
              </span>
            ))}
            {(data.all_gaps || []).length > 40 && (
              <span style={{ fontSize: 11, color: '#4b5563', padding: '5px 8px' }}>
                +{(data.all_gaps || []).length - 40} more
              </span>
            )}
          </div>
        </div>
      )}
    </>
  )
}

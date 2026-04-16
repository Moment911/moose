"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Map, Loader2, RefreshCw, CheckCircle, AlertCircle, XCircle,
  Target, Layers, TrendingUp, ChevronDown, ChevronUp, Filter,
  FileText, Zap, Globe, ArrowRight, Edit2, Check, X, Search
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

// ── Status helpers ──────────────────────────────────────────────

const STATUS_CONFIG = {
  gap:     { label: 'Gap',     color: R,   bg: R + '12',   icon: XCircle },
  partial: { label: 'Partial', color: AMB, bg: AMB + '12', icon: AlertCircle },
  covered: { label: 'Covered', color: GRN, bg: GRN + '12', icon: CheckCircle },
}

const CONTENT_TYPE_COLORS = {
  pillar:     { color: '#7c3aed', bg: '#7c3aed14' },
  cluster:    { color: T, bg: T + '14' },
  support:    { color: '#6b7280', bg: '#6b728014' },
  faq:        { color: AMB, bg: AMB + '14' },
  comparison: { color: R, bg: R + '14' },
}

function fmtN(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0) }

// ── Score Circle ────────────────────────────────────────────────

function ScoreCircle({ score, size = 64, strokeWidth = 5 }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : R
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: FH, fontSize: size * 0.32, fontWeight: 900, fill: color }}>
        {score}
      </text>
    </svg>
  )
}

// ── Score Badge ─────────────────────────────────────────────────

function ScoreBadge({ score, label, icon: Icon }) {
  const color = score >= 70 ? GRN : score >= 40 ? AMB : score > 0 ? R : '#d1d5db'
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
        {Icon && <Icon size={12} color={color} />}
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{score || '--'}</div>
      </div>
      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

// ── Status Badge ────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.gap
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

// ── Content Type Pill ───────────────────────────────────────────

function ContentTypePill({ type }) {
  const cfg = CONTENT_TYPE_COLORS[type] || { color: '#6b7280', bg: '#6b728014' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>
      {type}
    </span>
  )
}

// ── Priority Badge ──────────────────────────────────────────────

function PriorityBadge({ priority }) {
  const color = priority <= 3 ? R : priority <= 6 ? AMB : '#9ca3af'
  return (
    <span style={{ fontFamily: FH, fontSize: 10, fontWeight: 800, color, background: color + '12', padding: '1px 6px', borderRadius: 8 }}>
      P{priority}
    </span>
  )
}

// ── Node Card ───────────────────────────────────────────────────

function NodeCard({ node, onGenerateBrief, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px',
      transition: 'box-shadow 0.15s', cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, lineHeight: 1.3, marginBottom: 4 }}>
            {node.entity}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <StatusBadge status={node.status} />
            <PriorityBadge priority={node.priority} />
            <ContentTypePill type={node.content_type} />
          </div>
        </div>
        {node.search_volume > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 900, color: BLK }}>{fmtN(node.search_volume)}</div>
            <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>vol</div>
          </div>
        )}
      </div>

      {/* Suggested title */}
      {node.suggested_title && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, lineHeight: 1.4, fontStyle: 'italic' }}>
          {node.suggested_title}
        </div>
      )}

      {/* Attributes as tags */}
      {node.attributes && node.attributes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
          {node.attributes.slice(0, expanded ? 20 : 4).map((attr, i) => (
            <span key={i} style={{
              padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', fontSize: 10, color: '#6b7280',
              fontWeight: 500, border: '1px solid #e5e7eb',
            }}>
              {Array.isArray(attr) ? attr.join(': ') : attr}
            </span>
          ))}
          {!expanded && node.attributes.length > 4 && (
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>+{node.attributes.length - 4}</span>
          )}
        </div>
      )}

      {/* Macro context (truncated) */}
      {node.macro_context && (
        <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, marginBottom: 8 }}>
          {expanded ? node.macro_context : node.macro_context.slice(0, 80) + (node.macro_context.length > 80 ? '...' : '')}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
          {/* Micro contexts */}
          {node.micro_contexts && node.micro_contexts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Search Queries</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {node.micro_contexts.map((mc, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Search size={9} color="#d1d5db" /> {mc}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contextual bridges */}
          {node.contextual_bridges && node.contextual_bridges.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Connected Topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {node.contextual_bridges.map((cb, i) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 8, background: T + '10', color: T, fontSize: 10, fontWeight: 600, border: `1px solid ${T}30` }}>
                    {cb}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing URL */}
          {node.existing_url && (
            <div style={{ fontSize: 11, color: GRN, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Globe size={10} /> {node.existing_url}
            </div>
          )}

          {/* Suggested URL */}
          {node.suggested_url && !node.existing_url && (
            <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <ArrowRight size={10} /> Suggested: {node.suggested_url}
            </div>
          )}

          {/* Quick status change */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, alignSelf: 'center' }}>Status:</span>
            {['gap', 'partial', 'covered'].map(st => (
              <button key={st} onClick={() => onStatusChange(node.id, st)}
                style={{
                  padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${STATUS_CONFIG[st].color}${node.status === st ? '' : '40'}`,
                  background: node.status === st ? STATUS_CONFIG[st].bg : '#fff',
                  color: STATUS_CONFIG[st].color, opacity: node.status === st ? 1 : 0.6,
                }}>
                {STATUS_CONFIG[st].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <button onClick={() => setExpanded(!expanded)} style={{
          display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 10, color: '#9ca3af', fontWeight: 600,
        }}>
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'Less' : 'More'}
        </button>
        {node.status === 'gap' && (
          <button onClick={() => onGenerateBrief(node)} style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6,
            border: 'none', background: BLK, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>
            <Zap size={10} /> Generate Brief
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TopicalMapTab({ clientId, agencyId }) {
  const [map, setMap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [filter, setFilter] = useState('all') // all | core | outer | gaps | covered
  const [sortBy, setSortBy] = useState('priority') // priority | volume | relevance
  const [searchQ, setSearchQ] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityForm, setIdentityForm] = useState({ central_entity: '', source_context: '', central_search_intent: '' })

  // Load map on mount
  const loadMap = useCallback(() => {
    if (!clientId) return
    setLoading(true)
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_topical_map', client_id: clientId }),
    })
      .then(r => r.json())
      .then(res => {
        setMap(res.map || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  useEffect(() => { loadMap() }, [loadMap])

  // Generate map
  const generateMap = async () => {
    if (!clientId || !agencyId) return
    setGenerating(true)
    toast.loading('Generating topical map -- analyzing website, building semantic structure...', { id: 'topmap' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_topical_map', client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error, { id: 'topmap' })
        setGenerating(false)
        return
      }
      toast.success(`Topical map generated -- ${data.map?.total_nodes || 0} nodes mapped`, { id: 'topmap' })
      loadMap()
    } catch {
      toast.error('Failed to generate topical map', { id: 'topmap' })
    }
    setGenerating(false)
  }

  // Analyze coverage
  const analyzeCoverage = async () => {
    if (!clientId) return
    setAnalyzing(true)
    toast.loading('Analyzing content coverage -- crawling sitemap, matching pages to nodes...', { id: 'coverage' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_topical_coverage', client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error, { id: 'coverage' })
        setAnalyzing(false)
        return
      }
      toast.success(`Coverage analysis complete -- ${data.analysis?.pages_analyzed || 0} pages analyzed`, { id: 'coverage' })
      if (data.map) setMap(data.map)
      else loadMap()
    } catch {
      toast.error('Coverage analysis failed', { id: 'coverage' })
    }
    setAnalyzing(false)
  }

  // Update node status
  const updateNodeStatus = async (nodeId, status) => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_topical_node', node_id: nodeId, status }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      toast.success('Node updated')
      loadMap()
    } catch {
      toast.error('Failed to update node')
    }
  }

  // Generate brief for a node
  const handleGenerateBrief = (node) => {
    // Navigate to briefs tab with the entity pre-filled
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'briefs')
    url.searchParams.set('brief_keyword', node.entity)
    window.history.replaceState({}, '', url.toString())
    window.location.reload()
  }

  // Filter and sort nodes
  const getFilteredNodes = () => {
    if (!map) return []
    let allNodes = [...(map.core_nodes || []), ...(map.outer_nodes || [])]

    // Search
    if (searchQ) {
      const q = searchQ.toLowerCase()
      allNodes = allNodes.filter(n =>
        n.entity.toLowerCase().includes(q) ||
        (n.suggested_title || '').toLowerCase().includes(q) ||
        (n.macro_context || '').toLowerCase().includes(q) ||
        (n.micro_contexts || []).some(mc => mc.toLowerCase().includes(q))
      )
    }

    // Filter
    if (filter === 'core') allNodes = allNodes.filter(n => n.section === 'core')
    if (filter === 'outer') allNodes = allNodes.filter(n => n.section === 'outer')
    if (filter === 'gaps') allNodes = allNodes.filter(n => n.status === 'gap')
    if (filter === 'covered') allNodes = allNodes.filter(n => n.status === 'covered' || n.status === 'partial')

    // Sort
    if (sortBy === 'priority') allNodes.sort((a, b) => (a.priority || 10) - (b.priority || 10))
    if (sortBy === 'volume') allNodes.sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
    if (sortBy === 'relevance') {
      // Gaps first, then partial, then covered. Within each group, by priority.
      const statusOrder = { gap: 0, partial: 1, covered: 2 }
      allNodes.sort((a, b) => {
        const sd = (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2)
        return sd !== 0 ? sd : (a.priority || 10) - (b.priority || 10)
      })
    }

    return allNodes
  }

  const filteredNodes = getFilteredNodes()
  const coreFiltered = filteredNodes.filter(n => n.section === 'core')
  const outerFiltered = filteredNodes.filter(n => n.section === 'outer')

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 16 }

  // ── Empty state ──────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={24} color={T} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 10, fontSize: 14, color: '#9ca3af' }}>Loading topical map...</span>
      </div>
    )
  }

  if (!map) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: T + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Map size={28} color={T} />
        </div>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 900, color: BLK, marginBottom: 8 }}>No Topical Map Yet</div>
        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>
          Generate a semantic topical map using KotoIQ's knowledge base. Analyzes your website, identifies the central entity, and maps every topic you should cover for maximum topical authority.
        </div>
        <button onClick={generateMap} disabled={generating}
          style={{
            padding: '12px 28px', borderRadius: 10, border: 'none', background: BLK, color: '#fff',
            fontSize: 14, fontWeight: 700, fontFamily: FH, cursor: generating ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8, opacity: generating ? 0.6 : 1,
          }}>
          {generating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Map size={16} />}
          {generating ? 'Generating...' : 'Generate Topical Map'}
        </button>
      </div>
    )
  }

  // ── Main UI ──────────────────────────────────────────────────

  const stats = map.stats || {}
  const coverageScore = map.topical_coverage_score || 0

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <ScoreCircle score={coverageScore} />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 900, color: BLK, letterSpacing: '-.02em', marginBottom: 4 }}>
            Topical Map
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {stats.total || 0} nodes mapped -- {stats.covered || 0} covered, {stats.partial || 0} partial, {stats.gap || 0} gaps
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <ScoreBadge score={map.vastness_score || 0} label="Vastness" icon={Layers} />
          <ScoreBadge score={map.depth_score || 0} label="Depth" icon={Target} />
          <ScoreBadge score={map.momentum_score || 0} label="Momentum" icon={TrendingUp} />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={analyzeCoverage} disabled={analyzing}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 12, fontWeight: 700, cursor: analyzing ? 'wait' : 'pointer', color: T,
              display: 'flex', alignItems: 'center', gap: 4, opacity: analyzing ? 0.5 : 1,
            }}>
            {analyzing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            Analyze Coverage
          </button>
          <button onClick={generateMap} disabled={generating}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', background: BLK, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, opacity: generating ? 0.5 : 1,
            }}>
            {generating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Map size={12} />}
            Regenerate
          </button>
        </div>
      </div>

      {/* Coverage progress bar */}
      <div style={{ ...card, padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH }}>Coverage Distribution</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: GRN, display: 'inline-block' }} />
              Covered ({stats.covered || 0})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: AMB, display: 'inline-block' }} />
              Partial ({stats.partial || 0})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: R, display: 'inline-block' }} />
              Gap ({stats.gap || 0})
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f3f4f6' }}>
          {stats.total > 0 && (
            <>
              <div style={{ width: `${(stats.covered / stats.total) * 100}%`, background: GRN, transition: 'width 0.3s' }} />
              <div style={{ width: `${(stats.partial / stats.total) * 100}%`, background: AMB, transition: 'width 0.3s' }} />
              <div style={{ width: `${(stats.gap / stats.total) * 100}%`, background: R, transition: 'width 0.3s' }} />
            </>
          )}
        </div>
      </div>

      {/* Map identity card */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Semantic Identity
          </div>
          <button onClick={() => {
            if (editingIdentity) {
              setEditingIdentity(false)
            } else {
              setIdentityForm({
                central_entity: map.central_entity || '',
                source_context: map.source_context || '',
                central_search_intent: map.central_search_intent || '',
              })
              setEditingIdentity(true)
            }
          }} style={{
            display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#6b7280',
          }}>
            {editingIdentity ? <X size={10} /> : <Edit2 size={10} />}
            {editingIdentity ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {!editingIdentity ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Central Entity</div>
              <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK }}>{map.central_entity || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Source Context</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{map.source_context || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Central Search Intent</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{map.central_search_intent || '--'}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Central Entity</div>
              <input value={identityForm.central_entity} onChange={e => setIdentityForm(p => ({ ...p, central_entity: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: FH, fontWeight: 700 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Source Context</div>
              <textarea value={identityForm.source_context} onChange={e => setIdentityForm(p => ({ ...p, source_context: e.target.value }))}
                rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Central Search Intent</div>
              <textarea value={identityForm.central_search_intent} onChange={e => setIdentityForm(p => ({ ...p, central_search_intent: e.target.value }))}
                rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, resize: 'vertical' }} />
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Filter size={14} color="#9ca3af" />
        {[
          ['all', 'All', null],
          ['core', 'Core', stats.core_count],
          ['outer', 'Outer', stats.outer_count],
          ['gaps', 'Gaps Only', stats.gap],
          ['covered', 'Covered', (stats.covered || 0) + (stats.partial || 0)],
        ].map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${filter === key ? BLK : '#e5e7eb'}`,
              background: filter === key ? BLK + '08' : '#fff',
              color: filter === key ? BLK : '#6b7280',
            }}>
            {label} {count != null && <span style={{ opacity: 0.6 }}>({count})</span>}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={12} color="#9ca3af" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search nodes..."
            style={{ padding: '6px 10px 6px 26px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11, width: 160 }} />
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, background: '#fff', cursor: 'pointer' }}>
          <option value="priority">Sort: Priority</option>
          <option value="volume">Sort: Volume</option>
          <option value="relevance">Sort: Relevance</option>
        </select>
      </div>

      {/* Node sections */}
      {(filter === 'all' || filter === 'core' || filter === 'gaps' || filter === 'covered') && coreFiltered.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: R }} />
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
              Core Section
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
              ({coreFiltered.length} {coreFiltered.length === 1 ? 'node' : 'nodes'})
            </span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>-- Directly tied to monetization</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {coreFiltered.map(node => (
              <NodeCard key={node.id || node.entity} node={node} onGenerateBrief={handleGenerateBrief} onStatusChange={updateNodeStatus} />
            ))}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'outer' || filter === 'gaps' || filter === 'covered') && outerFiltered.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: T }} />
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
              Outer Section
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
              ({outerFiltered.length} {outerFiltered.length === 1 ? 'node' : 'nodes'})
            </span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>-- Topical authority builders</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {outerFiltered.map(node => (
              <NodeCard key={node.id || node.entity} node={node} onGenerateBrief={handleGenerateBrief} onStatusChange={updateNodeStatus} />
            ))}
          </div>
        </div>
      )}

      {/* Empty filtered state */}
      {filteredNodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No nodes match the current filter</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Try changing the filter or search term</div>
        </div>
      )}
    </div>
  )
}

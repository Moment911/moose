"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Shield, CheckCircle, XCircle, Loader2, RefreshCw, User, Award,
  AlertTriangle, ChevronDown, ChevronUp, Globe, Star, Eye, BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

const GRADE_COLORS = { A: GRN, B: '#22c55e', C: AMB, D: '#f97316', F: R }
const DIMENSION_ICONS = { Experience: Eye, Expertise: BookOpen, Authority: Award, Trust: Shield }
const DIMENSION_COLORS = { Experience: T, Expertise: '#8b5cf6', Authority: AMB, Trust: GRN }
const PRIORITY_COLORS = { high: R, medium: AMB, low: T }

function GradeBadge({ grade, score, size = 'large' }) {
  const color = GRADE_COLORS[grade] || '#6b6b70'
  const isLarge = size === 'large'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: isLarge ? 80 : 48, height: isLarge ? 80 : 48, borderRadius: '50%',
        background: color + '14', border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: isLarge ? 36 : 20, fontWeight: 900, color,
      }}>
        {grade || '—'}
      </div>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: isLarge ? 14 : 11, fontWeight: 700, color: '#1f1f22' }}>
        {score != null ? `${score}/100` : ''}
      </div>
    </div>
  )
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f1f1f6', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', borderRadius: 4, background: color, transition: 'width .5s ease' }} />
    </div>
  )
}

function SignalList({ signals, dimension }) {
  const color = DIMENSION_COLORS[dimension] || T
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(signals || []).map((sig, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: i < signals.length - 1 ? '1px solid #f9fafb' : 'none' }}>
          {sig.found
            ? <CheckCircle size={14} color={GRN} style={{ marginTop: 2, flexShrink: 0 }} />
            : <XCircle size={14} color={'#d1d5db'} style={{ marginTop: 2, flexShrink: 0 }} />
          }
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: sig.found ? BLK : '#8e8e93' }}>{sig.name}</div>
            {sig.detail && <div style={{ fontSize: 11, color: '#1f2937', marginTop: 2 }}>{sig.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EEATTab({ clientId, agencyId }) {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [targetUrl, setTargetUrl] = useState('')
  const [showUrl, setShowUrl] = useState(false)
  const [expandedDim, setExpandedDim] = useState(null)

  const loadAudit = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_eeat_audit', client_id: clientId }),
      })
      const data = await res.json()
      if (data.audit) setAudit(data.audit)
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadAudit() }, [loadAudit])

  const runAudit = async () => {
    setRunning(true)
    toast.loading('Running E-E-A-T audit...', { id: 'eeat' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'audit_eeat', client_id: clientId, agency_id: agencyId,
          ...(targetUrl ? { url: targetUrl } : {}),
        }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error, { id: 'eeat' }); setRunning(false); return }
      toast.success('E-E-A-T audit complete', { id: 'eeat' })
      setAudit(data.audit)
    } catch { toast.error('Audit failed', { id: 'eeat' }) }
    setRunning(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} color="#0a0a0a" style={{ animation: 'spin 1s linear infinite' }} /></div>

  // Empty state
  if (!audit) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
        <Shield size={48} color="#0a0a0a" style={{ margin: '0 auto 16px', opacity: .3 }} />
        <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 8 }}>E-E-A-T Scorer</div>
        <div style={{ fontSize: 14, color: '#1f1f22', marginBottom: 20, maxWidth: 460, margin: '0 auto 20px' }}>
          Analyze your site for Experience, Expertise, Authoritativeness, and Trust signals that Google uses to evaluate content quality.
        </div>

        {showUrl && (
          <div style={{ maxWidth: 400, margin: '0 auto 16px' }}>
            <input
              value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
              placeholder="https://example.com/page (optional — leave blank for homepage)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, outline: 'none' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={runAudit} disabled={running}
            style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 14, fontWeight: 700, cursor: running ? 'wait' : 'pointer', opacity: running ? .7 : 1 }}>
            {running ? <Loader2 size={14} style={{ marginRight: 6, verticalAlign: -2, animation: 'spin 1s linear infinite' }} /> : <Shield size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
            Run E-E-A-T Audit
          </button>
          <button onClick={() => setShowUrl(!showUrl)}
            style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#1f1f22', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Globe size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Specific URL
          </button>
        </div>
      </div>
    )
  }

  // ── Results view ──────────────────────────────────────────────────────────
  const dimensions = [
    { key: 'Experience', score: audit.experience_score, signals: audit.experience_signals, weight: '25%' },
    { key: 'Expertise', score: audit.expertise_score, signals: audit.expertise_signals, weight: '30%' },
    { key: 'Authority', score: audit.authority_score, signals: audit.authority_signals, weight: '25%' },
    { key: 'Trust', score: audit.trust_score, signals: audit.trust_signals, weight: '20%' },
  ]

  return (
    <>
      <HowItWorks tool="eeat" />
      {/* Header with grade + rerun */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24 }}>
        <GradeBadge grade={audit.grade} score={audit.overall_eeat_score} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: BLK, marginBottom: 4 }}>E-E-A-T Score</div>
          <div style={{ fontSize: 13, color: '#1f1f22' }}>
            {audit.url ? `Page: ${audit.url}` : 'Site-wide assessment'} — updated {audit.updated_at ? new Date(audit.updated_at).toLocaleDateString() : 'recently'}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {dimensions.map(d => {
              const color = DIMENSION_COLORS[d.key]
              return (
                <div key={d.key} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{d.key}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{d.score}</span>
                  </div>
                  <ScoreBar score={d.score} color={color} />
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={runAudit} disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', color: '#1f1f22' }}>
            {running ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Rerun
          </button>
        </div>
      </div>

      {/* URL input for re-auditing */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
          placeholder="Audit specific URL (leave blank for homepage)"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK, outline: 'none' }}
        />
        <button onClick={runAudit} disabled={running}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: "#0a0a0a", color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Audit URL
        </button>
      </div>

      {/* 4-quadrant grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {dimensions.map(dim => {
          const Icon = DIMENSION_ICONS[dim.key]
          const color = DIMENSION_COLORS[dim.key]
          const expanded = expandedDim === dim.key
          const foundCount = (dim.signals || []).filter(s => s.found).length
          const totalCount = (dim.signals || []).length

          return (
            <div key={dim.key} style={{ ...card, marginBottom: 0, borderTop: `3px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, cursor: 'pointer' }} onClick={() => setExpandedDim(expanded ? null : dim.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK }}>{dim.key}</div>
                    <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 600 }}>Weight: {dim.weight}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 24, fontWeight: 900, color }}>{dim.score}</div>
                  <div style={{ fontSize: 12, color: '#1f2937' }}>{foundCount}/{totalCount}</div>
                  {expanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                </div>
              </div>

              <ScoreBar score={dim.score} color={color} />

              {expanded && (
                <div style={{ marginTop: 14 }}>
                  <SignalList signals={dim.signals} dimension={dim.key} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Author Entity */}
      {audit.author_name && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <User size={16} color="#0a0a0a" />
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK }}>Author Entity</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color="#0a0a0a" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BLK }}>{audit.author_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {audit.author_has_knowledge_panel
                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: GRN + '12', color: GRN }}>Knowledge Panel</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#f1f1f6', color: '#1f2937' }}>No Knowledge Panel</span>
                }
              </div>
            </div>
          </div>
          {audit.author_entity_signals?.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {audit.author_entity_signals.map((sig, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: sig.found ? GRN + '10' : '#f1f1f6', color: sig.found ? GRN : '#8e8e93' }}>
                  {sig.found ? <CheckCircle size={10} style={{ marginRight: 4, verticalAlign: -1 }} /> : <XCircle size={10} style={{ marginRight: 4, verticalAlign: -1 }} />}
                  {sig.signal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {audit.recommendations?.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color={AMB} /> Recommendations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {audit.recommendations.map((rec, i) => {
              const prioColor = PRIORITY_COLORS[rec.priority] || '#6b6b70'
              const dimColor = DIMENSION_COLORS[rec.dimension?.charAt(0).toUpperCase() + rec.dimension?.slice(1)] || '#6b6b70'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafafb', border: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: prioColor + '12', color: prioColor, textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {rec.priority}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: BLK }}>{rec.action}</div>
                    {rec.impact && <div style={{ fontSize: 11, color: '#1f2937', marginTop: 2 }}>{rec.impact}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: dimColor + '10', color: dimColor, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {rec.dimension}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

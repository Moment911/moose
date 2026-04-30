"use client"
import { useState, useEffect } from 'react'
import {
  Loader2, BarChart3, Phone, Globe, Activity, Clock,
  CheckCircle, AlertTriangle, Info, ArrowUpRight, Smartphone, Monitor
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FH, BLK, GRY, R, T } from '../../lib/theme'

/**
 * Attribution Tab (ATTR-08)
 *
 * Per-page detail view: KPIs, CWV readings, call attribution trail.
 * Linear-style: white bg, subtle borders, generous padding.
 * Mobile-first default (Google CWV is mobile-first).
 */

const API = '/api/wp/builder/attribution'

async function attrAction(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

// ── CWV thresholds (Google's published thresholds) ──────────────────────────
const CWV_THRESHOLDS = {
  lcp_p75_ms:  { good: 2500, poor: 4000, unit: 'ms', label: 'LCP' },
  cls_p75:     { good: 0.1,  poor: 0.25, unit: '',   label: 'CLS' },
  inp_p75_ms:  { good: 200,  poor: 500,  unit: 'ms', label: 'INP' },
  fcp_p75_ms:  { good: 1800, poor: 3000, unit: 'ms', label: 'FCP' },
  ttfb_p75_ms: { good: 800,  poor: 1800, unit: 'ms', label: 'TTFB' },
}

function cwvGrade(key, value) {
  if (value == null) return 'none'
  const t = CWV_THRESHOLDS[key]
  if (!t) return 'none'
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

const GRADE_COLORS = {
  good: '#16a34a',
  'needs-improvement': '#f59e0b',
  poor: '#dc2626',
  none: '#8e8e93',
}

const CONFIDENCE_COLORS = {
  1.0: '#16a34a',
  0.85: '#2563eb',
  0.6: '#f59e0b',
  0.3: '#dc2626',
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AttributionTab({ publishId, siteId, agencyId }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchingCwv, setFetchingCwv] = useState(false)
  const [submittingIndexnow, setSubmittingIndexnow] = useState(false)
  const [deviceTab, setDeviceTab] = useState('mobile') // mobile-first default

  useEffect(() => {
    if (publishId) loadKpis()
  }, [publishId])

  async function loadKpis() {
    setLoading(true)
    const res = await attrAction('page_kpis', { publish_id: publishId, agency_id: agencyId })
    if (res.ok) setKpis(res.data)
    else toast.error(res.error || 'Failed to load KPIs')
    setLoading(false)
  }

  async function fetchCwv() {
    setFetchingCwv(true)
    const res = await attrAction('fetch_cwv', { publish_id: publishId, site_id: siteId, agency_id: agencyId })
    if (res.ok) {
      toast.success(res.data ? 'CWV data fetched' : 'No CrUX data available yet')
      loadKpis()
    } else {
      toast.error(res.error || 'CWV fetch failed')
    }
    setFetchingCwv(false)
  }

  async function submitIndexnow() {
    setSubmittingIndexnow(true)
    const res = await attrAction('submit_indexnow', { publish_id: publishId, site_id: siteId, agency_id: agencyId })
    if (res.ok) {
      toast.success(`Submitted to ${res.data?.count || 0} engine(s)`)
    } else {
      toast.error(res.error || 'IndexNow submission failed')
    }
    setSubmittingIndexnow(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#8e8e93' }} />
      </div>
    )
  }

  if (!kpis) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 40, color: '#6b6b70' }}>
        <Info size={20} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>No attribution data found for this publish.</div>
      </div>
    )
  }

  const cwv = kpis.cwv
  const daysSincePublish = kpis.published_at
    ? Math.floor((Date.now() - new Date(kpis.published_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
            Page Attribution
          </div>
          <div style={{ fontSize: 13, color: '#6b6b70', marginTop: 2 }}>
            {kpis.url}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchCwv} disabled={fetchingCwv} style={actionBtn}>
            {fetchingCwv ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={14} />}
            <span>Fetch CWV</span>
          </button>
          <button onClick={submitIndexnow} disabled={submittingIndexnow} style={actionBtn}>
            {submittingIndexnow ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={14} />}
            <span>Submit IndexNow</span>
          </button>
        </div>
      </div>

      {/* ── KPI summary cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <KpiCard icon={<Phone size={16} />} label="Calls" value={kpis.call_count} color="#0a0a0a" />
        <KpiCard icon={<BarChart3 size={16} />} label="Rank" value={kpis.rank ?? '--'} sub={kpis.rank_keyword} color="#6366f1" />
        <KpiCard icon={<ArrowUpRight size={16} />} label="Est. Revenue" value={kpis.estimated_revenue ? `$${kpis.estimated_revenue.toLocaleString()}` : '--'} color="#16a34a" />
        <KpiCard icon={<Clock size={16} />} label="Days Live" value={daysSincePublish ?? '--'} color="#6b6b70" />
      </div>

      {/* ── CWV Section ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={sectionTitle}>
            <Activity size={16} style={{ color: T }} />
            Core Web Vitals
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <DeviceToggle active={deviceTab === 'mobile'} onClick={() => setDeviceTab('mobile')}>
              <Smartphone size={13} /> Mobile
            </DeviceToggle>
            <DeviceToggle active={deviceTab === 'desktop'} onClick={() => setDeviceTab('desktop')}>
              <Monitor size={13} /> Desktop
            </DeviceToggle>
          </div>
        </div>

        {/* Insufficient data banner */}
        {daysSincePublish !== null && daysSincePublish < 28 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e' }}>
            <AlertTriangle size={14} />
            Page is {daysSincePublish} day{daysSincePublish !== 1 ? 's' : ''} old. CrUX field data requires ~28 days of traffic.
          </div>
        )}

        {/* Source badge */}
        {cwv && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <span style={sourceBadge(cwv.source === 'crux_url' || cwv.source === 'crux_origin' ? 'field' : 'lab')}>
              {cwv.source === 'crux_url' ? 'Field (URL)' :
               cwv.source === 'crux_origin' ? 'Field (Origin)' :
               cwv.source === 'psi_lab' ? 'Lab' :
               cwv.source === 'rum_beacon' ? 'RUM' : cwv.source}
            </span>
            {cwv.fetched_at && (
              <span style={{ fontSize: 11, color: '#8e8e93' }}>
                Fetched {new Date(cwv.fetched_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {cwv ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
            {Object.entries(CWV_THRESHOLDS).map(([key, meta]) => {
              const val = cwv[key]
              const grade = cwvGrade(key, val)
              return (
                <div key={key} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, border: '1px solid #ececef' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: GRADE_COLORS[grade] }}>
                    {val != null ? (key === 'cls_p75' ? val.toFixed(2) : Math.round(val)) : '--'}
                  </div>
                  <div style={{ fontSize: 10, color: GRADE_COLORS[grade], fontWeight: 600, marginTop: 2 }}>
                    {val != null ? meta.unit : ''}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#8e8e93', fontSize: 13 }}>
            No CWV readings yet. Click "Fetch CWV" to pull data from CrUX.
          </div>
        )}

        {kpis.cwv_readings_count > 1 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#8e8e93', textAlign: 'right' }}>
            {kpis.cwv_readings_count} total reading{kpis.cwv_readings_count !== 1 ? 's' : ''} on file
          </div>
        )}
      </div>

      {/* ── Call Attribution Section ──────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>
          <Phone size={16} style={{ color: R }} />
          Call Attribution
        </div>

        {kpis.attributed_calls.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kpis.attributed_calls.map((call, i) => (
              <div key={call.inbound_call_id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid #ececef', background: '#fafafb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Phone size={14} style={{ color: '#6b6b70' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
                      {call.match_method.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: 11, color: '#8e8e93' }}>
                      {new Date(call.matched_at).toLocaleDateString()} {new Date(call.matched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <ConfidenceBadge confidence={call.confidence} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#8e8e93', fontSize: 13 }}>
            No attributed calls yet.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...card, padding: '16px 18px', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: '#6b6b70', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: BLK }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function ConfidenceBadge({ confidence }) {
  const color = CONFIDENCE_COLORS[confidence] || '#6b6b70'
  const label = confidence >= 1.0 ? 'Exact'
    : confidence >= 0.85 ? 'High'
    : confidence >= 0.6 ? 'Medium'
    : 'Low'

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      background: color + '15',
      color,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
    }}>
      {label} ({(confidence * 100).toFixed(0)}%)
    </span>
  )
}

function DeviceToggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
        padding: '5px 12px',
        borderRadius: 8,
        border: '1px solid ' + (active ? '#5aa0ff' : '#ececef'),
        background: active ? T + '10' : '#fff',
        color: active ? '#5aa0ff' : '#6b6b70',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const card = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #ececef',
  padding: '20px 22px',
  marginBottom: 0,
}

const sectionTitle = {
  fontSize: 15,
  fontWeight: 800,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  color: BLK,
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const actionBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
  padding: '8px 16px',
  borderRadius: 10,
  border: '1px solid #ececef',
  background: '#fff',
  color: BLK,
  cursor: 'pointer',
}

function sourceBadge(type) {
  const isField = type === 'field'
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    background: isField ? '#16a34a15' : '#6366f115',
    color: isField ? '#16a34a' : '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  }
}

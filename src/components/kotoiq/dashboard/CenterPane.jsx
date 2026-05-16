"use client"
import { useEffect, useState } from 'react'
import { Sparkles, Loader2, RefreshCw, ArrowUpRight } from 'lucide-react'
import { useKotoIQData, useKotoIQRefreshKey } from '../../../context/KotoIQDataContext'

/**
 * Center pane for the redesigned KotoIQ dashboard.
 * Variant C — focused on the recommendation, not the data dump.
 *
 * Stack:
 *   1. Header: 'Mission Control' breadcrumb + bigger h1
 *   2. AI Intelligence Brief (the headline) — single bordered card
 *   3. This Week's Priorities — 3 numbered rows separated by hairlines
 *   4. Trending Keywords — compact sparkline list
 *
 * Everything else (tool grid, score rings, AI recs list, keyword tables)
 * has moved into the sidebar nav (tools) or right inspector (data health).
 */

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

export default function CenterPane({ clientId, agencyId, clientName, onSwitchTab }) {
  const refreshKey = useKotoIQRefreshKey()
  const [brief, setBrief] = useState(null)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [recs, setRecs] = useState([])
  const [keywords, setKeywords] = useState([])

  // Generate the AI brief on mount + on refresh
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    setLoadingBrief(true)
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ask_kotoiq', client_id: clientId, agency_id: agencyId, message: 'Generate a 2-3 paragraph executive intelligence brief about this client. Focus on what is working, what is at risk, and the single most important action to take this week. Skip greetings.' }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j?.answer) setBrief(j.answer); setLoadingBrief(false) })
      .catch(() => { setLoadingBrief(false) })
    return () => { cancelled = true }
  }, [clientId, agencyId, refreshKey])

  // Pull recommendations
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_recommendations', client_id: clientId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j?.recommendations) setRecs(j.recommendations.slice(0, 3)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, refreshKey])

  // Trending keywords — pull top striking-distance
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    fetch('/api/kotoiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_keywords', client_id: clientId, limit: 6 }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j?.keywords) setKeywords(j.keywords.slice(0, 6)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, refreshKey])

  return (
    <main style={S.center}>
      <div style={S.crumb}>{clientName || 'Select a client'} · Dashboard</div>
      <h1 style={S.h1}>Mission Control</h1>

      {/* AI Intelligence Brief */}
      <div style={S.brief}>
        <div style={S.briefLabel}>
          <Sparkles size={11} color={COLORS.teal} strokeWidth={2} style={{ verticalAlign: -1, marginRight: 4 }} />
          Intelligence Brief
        </div>
        {loadingBrief ? (
          <div style={S.briefLoading}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Analyzing all available data…
          </div>
        ) : brief ? (
          <div style={S.briefText}>
            {brief.split(/\n\n+/).filter(Boolean).slice(0, 3).map((para, i) => (
              <p key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>{para}</p>
            ))}
          </div>
        ) : (
          <div style={S.briefLoading}>
            Click Launch All in the sidebar to generate strategic analysis.
          </div>
        )}
      </div>

      {/* This Week's Priorities */}
      <div style={S.sectionHeader}>This week's priorities</div>
      {recs.length === 0 ? (
        <div style={S.empty}>No recommendations yet — run Launch All Audits to populate.</div>
      ) : (
        <div style={S.priList}>
          {recs.map((r, i) => (
            <div key={i} style={S.priRow}>
              <div style={S.priNum}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.priTitle}>{r.title || r.headline || 'Untitled recommendation'}</div>
                <div style={S.priMeta}>
                  {(r.detail || r.description || '').slice(0, 220)}
                  {r.estimated_impact && (
                    <span style={S.priImpact}> · {r.estimated_impact}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trending Keywords */}
      <div style={{ ...S.sectionHeader, marginTop: 36 }}>Trending keywords</div>
      {keywords.length === 0 ? (
        <div style={S.empty}>No keyword data yet — run Launch All Audits.</div>
      ) : (
        <div style={S.kwCard}>
          {keywords.map((kw, i) => (
            <div key={i} style={{ ...S.kwRow, borderBottom: i < keywords.length - 1 ? '1px solid ' + COLORS.rule : 'none' }}>
              <span style={S.kwName}>{kw.keyword}</span>
              <span style={S.kwSpark} />
              <span style={S.kwPos}>
                {kw.sc_avg_position != null ? `#${Math.round(kw.sc_avg_position)}` : '—'}
                {kw.kp_monthly_volume != null && (
                  <span style={S.kwVol}> · {fmtVol(kw.kp_monthly_volume)}/mo</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}

function fmtVol(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

const COLORS = {
  bg:     '#FCFCFA',
  ink:    '#0A0A0A',
  text:   '#1F1F22',
  muted:  '#6B6B70',
  faint:  '#9CA3AF',
  rule:   '#E8E6E1',
  teal:   '#0E7C7B',
  tealBg: '#E8F4F3',
}

const S = {
  center: {
    flex: 1,
    background: COLORS.bg,
    padding: '32px 40px 56px',
    overflowY: 'auto',
    height: '100%',
    fontFamily: SF,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 1.55,
  },
  crumb: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 6,
    fontFamily: SF,
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.4px',
    color: COLORS.ink,
    marginBottom: 28,
    fontFamily: SF,
  },
  brief: {
    background: '#FFFFFF',
    borderLeft: '3px solid ' + COLORS.teal,
    padding: '22px 26px',
    borderRadius: 4,
    marginBottom: 36,
    boxShadow: '0 1px 2px rgba(0,0,0,.03)',
  },
  briefLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: COLORS.teal,
    marginBottom: 12,
  },
  briefText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: COLORS.text,
  },
  briefLoading: {
    fontSize: 14,
    color: COLORS.muted,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: COLORS.faint,
    marginBottom: 14,
    fontFamily: SF,
  },
  empty: {
    fontSize: 14,
    color: COLORS.muted,
    padding: '12px 0',
    fontStyle: 'italic',
  },
  priList: {
    marginBottom: 0,
  },
  priRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '16px 0',
    borderBottom: '1px solid ' + COLORS.rule,
  },
  priNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1.5px solid ' + COLORS.teal,
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: SF,
  },
  priTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.ink,
    marginBottom: 4,
    fontFamily: SF,
  },
  priMeta: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
  priImpact: {
    color: COLORS.teal,
    fontWeight: 600,
  },
  kwCard: {
    background: '#FFFFFF',
    border: '1px solid ' + COLORS.rule,
    borderRadius: 8,
    padding: '8px 16px',
  },
  kwRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: 13,
  },
  kwName: {
    flex: 1,
    color: COLORS.ink,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingRight: 10,
  },
  kwSpark: {
    width: 64, height: 18,
    background: 'linear-gradient(180deg, transparent 40%, ' + COLORS.tealBg + ' 100%)',
    borderBottom: '1.5px solid ' + COLORS.teal,
    flexShrink: 0,
    margin: '0 12px',
  },
  kwPos: {
    color: COLORS.muted,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 12,
    flexShrink: 0,
  },
  kwVol: {
    color: COLORS.faint,
  },
}

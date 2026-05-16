"use client"
import { useEffect, useState } from 'react'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { useKotoIQData, useKotoIQRefreshKey } from '../../../context/KotoIQDataContext'

/**
 * Right inspector rail for the redesigned KotoIQ dashboard.
 * Variant C — surfaces all the metadata: data health, freshness, KPIs.
 *
 * Fetches from /api/kotoiq:
 *   - get_data_completeness (data health %)
 *   - reads freshness map directly from KotoIQDataContext
 */

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const SOURCES_TO_SHOW = [
  { key: 'quick_scan',              label: 'Keywords' },
  { key: 'sync',                    label: 'Google data' },
  { key: 'generate_topical_map',    label: 'Topical map' },
  { key: 'audit_schema',            label: 'Schema audit' },
  { key: 'audit_eeat',              label: 'E-E-A-T' },
  { key: 'scan_brand_serp',         label: 'Brand SERP' },
  { key: 'analyze_backlinks',       label: 'Backlinks' },
  { key: 'gmb_health',              label: 'GBP' },
  { key: 'run_gsc_audit',           label: 'GSC' },
  { key: 'generate_strategic_plan', label: 'Strategy' },
]

export default function Inspector({ clientId, onSwitchTab }) {
  const refreshKey = useKotoIQRefreshKey()
  const { freshness } = useKotoIQData()
  const [completeness, setCompleteness] = useState(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    fetch('/api/kotoiq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_data_completeness', client_id: clientId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setCompleteness(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, refreshKey])

  const pct = completeness?.completeness_pct ?? null
  const healthColor =
    pct == null ? COLORS.faint :
    pct >= 80 ? COLORS.green :
    pct >= 50 ? COLORS.amber : COLORS.red

  const missing = (completeness?.items || []).filter(i => !i.populated).slice(0, 5)

  return (
    <aside style={S.aside}>

      <div style={S.block}>
        <div style={S.label}>Data Health</div>
        {pct == null ? (
          <div style={S.healthSub}>Loading…</div>
        ) : (
          <>
            <div style={{ ...S.healthPct, color: healthColor }}>{pct}%</div>
            <div style={S.healthSub}>{completeness.populated} of {completeness.total} sources populated</div>
          </>
        )}

        {missing.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...S.label, marginBottom: 8 }}>
              <AlertCircle size={11} color={COLORS.amber} style={{ verticalAlign: -1, marginRight: 4 }} />
              Missing
            </div>
            {missing.map(m => (
              <button
                key={m.source}
                onClick={() => m.tab && onSwitchTab && onSwitchTab(m.tab)}
                disabled={!m.tab}
                style={S.missingRow}
              >
                <span style={S.missingLabel}>{m.label}</span>
                {m.tab && <ArrowRight size={11} color={COLORS.faint} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={S.block}>
        <div style={S.label}>Freshness by source</div>
        {SOURCES_TO_SHOW.map(src => {
          const f = freshness?.[src.key]
          const dotColor =
            !f ? COLORS.faint :
            f.grade === 'fresh' ? COLORS.green :
            f.grade === 'aging' ? COLORS.amber :
            f.grade === 'stale' ? COLORS.red : COLORS.faint
          const ageLabel = f?.age_days != null ? formatAge(f.age_days) : '—'
          return (
            <div key={src.key} style={S.freshRow}>
              <span style={{ ...S.dot, background: dotColor }} />
              <span style={S.freshName}>{src.label}</span>
              <span style={S.freshAge}>{ageLabel}</span>
            </div>
          )
        })}
      </div>

      <div style={S.block}>
        <div style={S.label}>Quick KPIs</div>
        <div style={S.kpiRow}>
          <span style={S.kpiName}>Top 3 ranks</span>
          <span style={S.kpiVal}>—</span>
        </div>
        <div style={S.kpiRow}>
          <span style={S.kpiName}>Top 10 ranks</span>
          <span style={S.kpiVal}>—</span>
        </div>
        <div style={S.kpiRow}>
          <span style={S.kpiName}>Striking distance</span>
          <span style={S.kpiVal}>—</span>
        </div>
        <div style={S.kpiRow}>
          <span style={S.kpiName}>Brand SERP</span>
          <span style={S.kpiVal}>—</span>
        </div>
        <div style={S.kpiRow}>
          <span style={S.kpiName}>E-E-A-T</span>
          <span style={S.kpiVal}>—</span>
        </div>
      </div>

    </aside>
  )
}

function formatAge(days) {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${Math.round(days)}d`
  if (days < 60) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

const COLORS = {
  bg:     '#FFFFFF',
  ink:    '#0A0A0A',
  text:   '#1F1F22',
  muted:  '#6B6B70',
  faint:  '#9CA3AF',
  rule:   '#E8E6E1',
  green:  '#16A34A',
  amber:  '#D97706',
  red:    '#DC2626',
}

const S = {
  aside: {
    width: 300,
    flexShrink: 0,
    background: COLORS.bg,
    borderLeft: '1px solid ' + COLORS.rule,
    padding: '28px 24px',
    overflowY: 'auto',
    height: '100%',
    fontFamily: SF,
    fontSize: 13,
    color: COLORS.text,
  },
  block: {
    marginBottom: 28,
    paddingBottom: 22,
    borderBottom: '1px solid ' + COLORS.rule,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: COLORS.faint,
    marginBottom: 10,
    fontFamily: SF,
  },
  healthPct: {
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    lineHeight: 1,
    fontFamily: SF,
  },
  healthSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
  },
  missingRow: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '6px 0',
    fontFamily: SF,
    fontSize: 13,
    color: COLORS.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    textAlign: 'left',
  },
  missingLabel: {
    color: COLORS.text,
  },
  freshRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 0',
    fontSize: 12,
  },
  dot: {
    width: 7, height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  freshName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  freshAge: {
    color: COLORS.muted,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 12,
  },
  kpiRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
    fontSize: 13,
  },
  kpiName: { color: COLORS.text },
  kpiVal: { color: COLORS.muted, fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
}

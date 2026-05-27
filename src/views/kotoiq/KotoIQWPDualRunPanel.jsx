"use client"
/**
 * KotoIQWPDualRunPanel — Phase 10 Plan 10-10 Task 2.
 *
 * Operator UI for the 7-day shadow-mode dual-run window per CONTEXT.md
 * D-TypeScript-port-equivalence (USER-LOCKED).
 *
 * Three-pane layout:
 *
 *   ┌─────────────────┬─────────────────────────────────────────────┐
 *   │ Site picker     │ Selected site                               │
 *   │ + match% chip   │   Header: dual_run_state + mode switcher    │
 *   │ + major# alert  │   Stats: 7d counts + latency comparison     │
 *   │                 │   Recent diffs: latest 50, click to drill   │
 *   │                 │                                             │
 *   └─────────────────┴─────────────────────────────────────────────┘
 *
 * Integrates into the existing KotoIQ WP view (src/views/KotoIQWPPage.jsx)
 * alongside KotoIQWPTemplatesTab via the ViewToggle. Imported by Phase 9
 * parent file (KotoIQWPPage.jsx) as a sub-tab. This is NOT a standalone
 * route — it lives inside the unified WP view per phase consolidation.
 *
 * Plan 11 cutover playbook uses this panel to confirm 7-day window passed
 * before promoting a site (single click on the mode dropdown → 'promoted').
 *
 * DESIGN.md compliance: Unified Marketing palette (navy + pink + cream).
 * Uses the same NAVY/PINK/CREAM constants as ClientView/FleetView.
 *
 * Color-coded diff_status chips:
 *   - match / v4_only → green
 *   - minor_diff → amber
 *   - major_diff / v3_error / v4_error / both_error → red
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, AlertCircle, CheckCircle2, ChevronRight, Clock,
  Globe, Loader2, RefreshCw, X, Zap, ShieldCheck, ShieldAlert, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { R, BLK, FB, FH } from '../../lib/theme'

const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'
const MUTED = '#6b7280'

const GREEN = '#0d9e6e'
const AMBER = '#f59e0b'
const RED   = '#dc2626'
const GREY  = '#7b778f'

const MODES = ['inactive', 'active', 'promoted', 'rolled_back']
const MODE_LABELS = {
  inactive:    'Inactive (v3 only)',
  active:      'Active (dual-run shadow)',
  promoted:    'Promoted (v4 primary, 1% sample)',
  rolled_back: 'Rolled back (v3 only, emergency)',
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level component
// ────────────────────────────────────────────────────────────────────────────

export default function KotoIQWPDualRunPanel() {
  const [sites, setSites] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loadingSites, setLoadingSites] = useState(true)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const loadSites = useCallback(async () => {
    setLoadingSites(true)
    try {
      const res = await fetch('/api/kotoiq-wp/dual-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_sites' }),
      })
      const data = await res.json()
      const sitesData = data.sites || []
      setSites(sitesData)
      if (!selectedId && sitesData.length) setSelectedId(sitesData[0].id)
    } catch (e) {
      toast.error(e.message || 'Failed to load sites')
    } finally {
      setLoadingSites(false)
    }
  }, [selectedId])

  useEffect(() => { loadSites() }, [loadSites, refreshNonce])

  // 30s auto-refresh of the sites list (latency match% can drift).
  useEffect(() => {
    const i = setInterval(() => setRefreshNonce(n => n + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  const selected = sites.find(s => s.id === selectedId) || null

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, background: CREAM }}>
      {/* Left rail — site picker */}
      <aside style={{
        width: 320, borderRight: `1px solid ${LINE}`, background: '#fff',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Activity size={16} color={PINK} />
          <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 800, color: NAVY, flex: 1 }}>
            Dual-run sites
          </span>
          <button onClick={() => setRefreshNonce(n => n + 1)} title="Refresh" style={iconBtnStyle()}>
            <RefreshCw size={11}/>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 16px' }}>
          {loadingSites && (
            <div style={loadingBoxStyle()}>
              <Loader2 size={14} className="spin" /> Loading…
            </div>
          )}
          {!loadingSites && sites.length === 0 && (
            <div style={emptyBoxStyle()}>
              No v4 sites paired yet. Pair a site via the Fleet view to begin shadow-mode dual-run.
            </div>
          )}
          {!loadingSites && sites.map(s => (
            <SitePickerRow
              key={s.id}
              site={s}
              active={s.id === selectedId}
              onClick={() => setSelectedId(s.id)}
            />
          ))}
        </div>
      </aside>

      {/* Center — selected site detail */}
      <main style={{
        flex: 1, minWidth: 0, padding: 24,
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {!selected && (
          <EmptyState />
        )}
        {selected && (
          <SiteDetail
            site={selected}
            onModeChanged={() => setRefreshNonce(n => n + 1)}
            key={`${selected.id}-${refreshNonce}`}
          />
        )}
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Site picker row
// ────────────────────────────────────────────────────────────────────────────

function SitePickerRow({ site, active, onClick }) {
  const pct = site.match_pct_24h
  const pctColor = pct === null ? MUTED
                  : pct >= 99   ? GREEN
                  : pct >= 95   ? AMBER
                  :               RED
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 12px', marginBottom: 4, borderRadius: 8,
        border: '1px solid transparent',
        background: active ? `${PINK}10` : 'transparent',
        cursor: 'pointer',
        fontFamily: FB,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f3ee' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: active ? PINK : NAVY,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {site.site_name || site.site_url?.replace(/^https?:\/\//, '')}
      </div>
      <div style={{
        marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: MUTED,
      }}>
        <ModeChip mode={site.dual_run_state} />
        {pct !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            color: pctColor, fontWeight: 700,
          }}>
            <CheckCircle2 size={10} /> {pct}%
          </span>
        )}
        {site.major_diff_count_24h > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            color: RED, fontWeight: 700,
          }}>
            <AlertCircle size={10} /> {site.major_diff_count_24h}
          </span>
        )}
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Site detail
// ────────────────────────────────────────────────────────────────────────────

function SiteDetail({ site, onModeChanged }) {
  const [status, setStatus] = useState(null)
  const [diffs, setDiffs] = useState([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingDiffs, setLoadingDiffs] = useState(true)
  const [modeOpen, setModeOpen] = useState(false)
  const [drillLogId, setDrillLogId] = useState(null)

  const reload = useCallback(async () => {
    setLoadingStatus(true)
    setLoadingDiffs(true)
    try {
      const [sRes, dRes] = await Promise.all([
        fetch('/api/kotoiq-wp/dual-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_status', site_id: site.id }),
        }),
        fetch('/api/kotoiq-wp/dual-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list_recent_diffs', site_id: site.id, limit: 50 }),
        }),
      ])
      const sd = await sRes.json()
      const dd = await dRes.json()
      setStatus(sd.window ? sd : null)
      setDiffs(dd.diffs || [])
    } catch (e) {
      toast.error(e.message || 'Failed to load site status')
    } finally {
      setLoadingStatus(false)
      setLoadingDiffs(false)
    }
  }, [site.id])

  useEffect(() => { reload() }, [reload])

  // 60s auto-refresh of selected site stats while panel is open.
  useEffect(() => {
    const i = setInterval(reload, 60_000)
    return () => clearInterval(i)
  }, [reload])

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: FH, fontSize: 28, fontWeight: 400, color: NAVY,
            letterSpacing: '0.02em',
          }}>
            {site.site_name || site.site_url}
          </div>
          <div style={{
            fontFamily: FB, fontSize: 13, color: MUTED, marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <Globe size={11}/> {site.site_url}
            {site.paired_at_v4 && <>
              <span>·</span>
              <span>paired {new Date(site.paired_at_v4).toLocaleDateString()}</span>
            </>}
            {site.v4_promoted_at && <>
              <span>·</span>
              <span style={{ color: GREEN, fontWeight: 700 }}>
                promoted {new Date(site.v4_promoted_at).toLocaleDateString()}
              </span>
            </>}
          </div>
        </div>
        <button onClick={() => setModeOpen(true)} style={primaryBtnStyle()}>
          Change mode
        </button>
      </div>

      {/* Mode chip */}
      <div>
        <ModeChip mode={site.dual_run_state} big />
      </div>

      {/* Stats grid */}
      <StatsGrid loading={loadingStatus} status={status} />

      {/* Recent diffs */}
      <div style={{
        border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${LINE}`,
          fontFamily: FB, fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.14em', color: MUTED,
        }}>
          Recent diffs (latest 50)
        </div>
        {loadingDiffs ? (
          <div style={{ padding: 24, color: MUTED, fontFamily: FB, fontSize: 13 }}>
            <Loader2 size={12} className="spin" /> Loading…
          </div>
        ) : diffs.length === 0 ? (
          <div style={{ padding: 24, color: MUTED, fontFamily: FB, fontSize: 13 }}>
            No dual-run rows yet for this site. Either the site is in mode='inactive', or no verbs have fired since pair time.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f5ef' }}>
                <th style={thStyle()}>When</th>
                <th style={thStyle()}>Verb</th>
                <th style={thStyle()}>Status</th>
                <th style={thStyle()}>v3 ms</th>
                <th style={thStyle()}>v4 ms</th>
                <th style={thStyle()}>{' '}</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map(d => (
                <tr key={d.id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={tdStyle()}>{new Date(d.called_at).toLocaleString()}</td>
                  <td style={tdStyle()}>
                    <code style={codeStyle()}>{d.verb}</code>
                  </td>
                  <td style={tdStyle()}>
                    <StatusChip status={d.diff_status} />
                  </td>
                  <td style={tdStyle()}>{d.latency_v3_ms ?? '—'}</td>
                  <td style={tdStyle()}>{d.latency_v4_ms ?? '—'}</td>
                  <td style={tdStyle()}>
                    <button
                      onClick={() => setDrillLogId(d.id)}
                      style={miniBtnStyle()}
                    >
                      Details <ChevronRight size={10}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modeOpen && (
        <ModeSwitcherModal
          site={site}
          onClose={() => setModeOpen(false)}
          onChanged={() => { setModeOpen(false); onModeChanged?.(); reload() }}
        />
      )}
      {drillLogId && (
        <DiffDetailModal
          logId={drillLogId}
          onClose={() => setDrillLogId(null)}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Stats grid
// ────────────────────────────────────────────────────────────────────────────

function StatsGrid({ loading, status }) {
  if (loading) {
    return (
      <div style={cardStyle()}>
        <div style={{ padding: 24, color: MUTED, fontFamily: FB }}>
          <Loader2 size={12} className="spin" /> Loading 7-day stats…
        </div>
      </div>
    )
  }
  if (!status) {
    return (
      <div style={cardStyle()}>
        <div style={{ padding: 24, color: MUTED, fontFamily: FB, fontSize: 13 }}>
          No stats available.
        </div>
      </div>
    )
  }
  const w = status.window
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      <StatTile label="7-day match %" value={w.match_pct ?? '—'}
                accent={w.match_pct >= 99 ? GREEN : w.match_pct >= 95 ? AMBER : RED}
                hint={`${w.total} calls observed`}/>
      <StatTile label="Major diffs"      value={w.counts.major_diff || 0}  accent={(w.counts.major_diff || 0) > 0 ? RED   : GREEN}/>
      <StatTile label="Minor diffs"      value={w.counts.minor_diff || 0}  accent={AMBER}/>
      <StatTile label="Matches"          value={w.counts.match      || 0}  accent={GREEN}/>
      <StatTile label="v4-only"          value={w.counts.v4_only    || 0}  accent={GREEN}/>
      <StatTile label="v3 errors"        value={w.counts.v3_error   || 0}  accent={RED}/>
      <StatTile label="v4 errors"        value={w.counts.v4_error   || 0}  accent={RED}/>
      <StatTile label="v3 median ms"     value={w.latency_v3_median_ms ?? '—'} hint="round-trip"/>
      <StatTile label="v4 median ms"     value={w.latency_v4_median_ms ?? '—'} hint="round-trip"/>
    </div>
  )
}

function StatTile({ label, value, accent, hint }) {
  return (
    <div style={{
      ...cardStyle(),
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontFamily: FB, fontSize: 10, fontWeight: 700, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.14em',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FH, fontSize: 26, fontWeight: 400,
        color: accent || NAVY, letterSpacing: '0.01em',
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {hint && (
        <div style={{ fontFamily: FB, fontSize: 11, color: MUTED }}>{hint}</div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Status chip + Mode chip
// ────────────────────────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const cfg = {
    match:      { bg: `${GREEN}22`, fg: GREEN, icon: CheckCircle2 },
    v4_only:    { bg: `${GREEN}22`, fg: GREEN, icon: ShieldCheck },
    minor_diff: { bg: `${AMBER}22`, fg: AMBER, icon: Clock },
    major_diff: { bg: `${RED}22`,   fg: RED,   icon: AlertCircle },
    v3_error:   { bg: `${RED}22`,   fg: RED,   icon: AlertCircle },
    v4_error:   { bg: `${RED}22`,   fg: RED,   icon: AlertCircle },
    both_error: { bg: `${RED}22`,   fg: RED,   icon: AlertCircle },
  }[status] || { bg: `${GREY}22`, fg: GREY, icon: Activity }
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: cfg.bg, color: cfg.fg,
      fontFamily: FB, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      <Icon size={10}/> {status}
    </span>
  )
}

function ModeChip({ mode, big }) {
  const cfg = {
    inactive:    { bg: `${GREY}22`,  fg: GREY,  Icon: RotateCcw },
    active:      { bg: `${AMBER}22`, fg: AMBER, Icon: Zap },
    promoted:    { bg: `${GREEN}22`, fg: GREEN, Icon: ShieldCheck },
    rolled_back: { bg: `${RED}22`,   fg: RED,   Icon: ShieldAlert },
  }[mode] || { bg: `${GREY}22`, fg: GREY, Icon: Activity }
  const { Icon } = cfg
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: big ? '6px 14px' : '2px 8px', borderRadius: big ? 8 : 4,
      background: cfg.bg, color: cfg.fg,
      fontFamily: FB, fontSize: big ? 12 : 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      <Icon size={big ? 14 : 10}/> {mode || 'unknown'}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Modals
// ────────────────────────────────────────────────────────────────────────────

function ModeSwitcherModal({ site, onClose, onChanged }) {
  const [mode, setMode] = useState(site.dual_run_state || 'inactive')
  const [busy, setBusy] = useState(false)

  const transitions = {
    inactive:    'No v4 traffic. Dashboard talks to legacy /api/wp only. Use this to pause dual-run.',
    active:      'Both v3 and v4 fire for every dashboard call. v4 is returned. Diffs logged to koto_wp_dual_run_log. This is the 7-day shadow window.',
    promoted:    'v4 is primary. 1% of calls still shadow v3 for monitoring. Use this after 7 days of clean active mode.',
    rolled_back: 'Emergency rollback. v3 only, no v4 calls. Use this if v4 is misbehaving.',
  }

  const submit = async (e) => {
    e.preventDefault()
    if (mode === site.dual_run_state) {
      toast.error('Already in this mode')
      return
    }
    if (mode === 'promoted' && !confirm(`Promote ${site.site_url} to v4-primary? This makes v4 the source of truth. Make sure the 7-day window has zero major_diff entries.`)) {
      return
    }
    if (mode === 'rolled_back' && !confirm(`Roll back ${site.site_url} to v3? v4 will be disabled.`)) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/kotoiq-wp/dual-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_mode', site_id: site.id, mode }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Mode changed to ${mode}`)
        onChanged?.()
      } else {
        toast.error(data.error || 'Mode change failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`Change dual-run mode — ${site.site_url}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MODES.map(m => (
            <label key={m} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: 10, borderRadius: 8,
              border: `1px solid ${mode === m ? PINK : LINE}`,
              background: mode === m ? `${PINK}08` : '#fff',
              cursor: 'pointer',
            }}>
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: NAVY }}>
                  {MODE_LABELS[m]}
                </div>
                <div style={{ fontFamily: FB, fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>
                  {transitions[m]}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle()}>Cancel</button>
          <button type="submit" disabled={busy} style={primaryBtnStyle()}>
            {busy ? <><Loader2 size={12} className="spin"/> Saving…</> : 'Apply'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function DiffDetailModal({ logId, onClose }) {
  const [log, setLog] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    fetch('/api/kotoiq-wp/dual-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_diff_detail', log_id: logId }),
    })
      .then(r => r.json())
      .then(d => { if (d.log) setLog(d.log); else setErr(d.error || 'not_found') })
      .catch(e => setErr(e.message))
  }, [logId])

  return (
    <ModalShell title="Diff detail" onClose={onClose} wide>
      {!log && !err && (
        <div style={{ padding: 24, color: MUTED, fontFamily: FB }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {err && (
        <div style={{ padding: 24, color: RED, fontFamily: FB }}>{err}</div>
      )}
      {log && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetailRow label="Verb"             value={<code style={codeStyle()}>{log.verb}</code>}/>
          <DetailRow label="Legacy endpoint"  value={log.legacy_endpoint || '—'}/>
          <DetailRow label="Status"           value={<StatusChip status={log.diff_status} />}/>
          <DetailRow label="Called at"        value={new Date(log.called_at).toLocaleString()}/>
          <DetailRow label="v3 latency"       value={log.latency_v3_ms ? `${log.latency_v3_ms}ms` : '—'}/>
          <DetailRow label="v4 latency"       value={log.latency_v4_ms ? `${log.latency_v4_ms}ms` : '—'}/>
          <DetailRow label="args hash"        value={<code style={codeStyle()}>{log.args_hash}</code>}/>
          <DetailRow label="v3 response hash" value={<code style={codeStyle()}>{log.v3_response_hash || '—'}</code>}/>
          <DetailRow label="v4 response hash" value={<code style={codeStyle()}>{log.v4_response_hash || '—'}</code>}/>
          {log.diff_summary && (
            <>
              <DiffSummaryBlock title="Changed keys"  items={log.diff_summary.changed_keys || []}/>
              <DiffSummaryBlock title="v3-only keys"  items={log.diff_summary.v3_only_keys || []}/>
              <DiffSummaryBlock title="v4-only keys"  items={log.diff_summary.v4_only_keys || []}/>
              <SamplesBlock     samples={log.diff_summary.samples || []}/>
            </>
          )}
        </div>
      )}
    </ModalShell>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        flex: '0 0 160px',
        fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.14em',
        paddingTop: 2,
      }}>{label}</div>
      <div style={{ flex: 1, fontFamily: FB, fontSize: 13, color: NAVY, overflowWrap: 'anywhere' }}>
        {value}
      </div>
    </div>
  )
}

function DiffSummaryBlock({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: 8, padding: 12, background: '#f7f5ef',
    }}>
      <div style={{
        fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6,
      }}>{title} ({items.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.map((p, i) => (
          <code key={i} style={codeStyle()}>{p}</code>
        ))}
      </div>
    </div>
  )
}

function SamplesBlock({ samples }) {
  if (!samples || samples.length === 0) return null
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: 8, padding: 12, background: '#fff',
    }}>
      <div style={{
        fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
      }}>Samples ({samples.length})</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f5ef' }}>
            <th style={thStyle()}>Path</th>
            <th style={thStyle()}>v3</th>
            <th style={thStyle()}>v4</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((s, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={tdStyle()}><code style={codeStyle()}>{s.path || '(root)'}</code></td>
              <td style={tdStyle()}>{renderSampleValue(s.v3)}</td>
              <td style={tdStyle()}>{renderSampleValue(s.v4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderSampleValue(v) {
  if (v === undefined) return <span style={{ color: MUTED, fontStyle: 'italic' }}>missing</span>
  if (v === null) return <span style={{ color: MUTED }}>null</span>
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
    {s.length > 80 ? s.slice(0, 80) + '…' : s}
  </span>
}

// ────────────────────────────────────────────────────────────────────────────
// Empty state + shared shell + style helpers
// ────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', color: MUTED, fontFamily: FB, fontSize: 14,
      gap: 14, padding: 32,
    }}>
      <Activity size={42} color={LINE} />
      <div style={{ textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        Pick a site to view its dual-run state, recent diffs, and 7-day match %.
        Use the mode switcher to flip a site between inactive / active / promoted / rolled_back.
      </div>
    </div>
  )
}

function ModalShell({ title, children, onClose, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(32, 27, 81, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 24,
    }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: wide ? 900 : 600,
          background: '#fff', borderRadius: 14, border: `1px solid ${LINE}`,
          boxShadow: '0 12px 40px rgba(32, 27, 81, 0.18)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: FH, fontSize: 22, fontWeight: 400, color: NAVY,
            letterSpacing: '0.02em',
          }}>{title}</div>
          <button onClick={onClose} style={iconBtnStyle()}><X size={14}/></button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function cardStyle() {
  return {
    border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff',
  }
}
function loadingBoxStyle() {
  return {
    padding: 24, color: MUTED, fontFamily: FB, fontSize: 12,
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
  }
}
function emptyBoxStyle() {
  return {
    padding: 24, color: MUTED, fontFamily: FB, fontSize: 12,
    textAlign: 'center', lineHeight: 1.6,
  }
}
function codeStyle() {
  return {
    fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
    background: '#f5f3ee', padding: '2px 6px', borderRadius: 4,
    color: NAVY, fontWeight: 600,
  }
}
function primaryBtnStyle() {
  return {
    padding: '8px 14px', borderRadius: 8, border: 'none',
    background: PINK, color: '#fff',
    fontFamily: FB, fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  }
}
function secondaryBtnStyle() {
  return {
    padding: '8px 14px', borderRadius: 8,
    border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
    fontFamily: FB, fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  }
}
function miniBtnStyle() {
  return {
    padding: '4px 8px', borderRadius: 6,
    border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
    fontFamily: FB, fontSize: 11, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
  }
}
function iconBtnStyle() {
  return {
    width: 26, height: 26, borderRadius: 6,
    border: `1px solid ${LINE}`, background: '#fff', color: MUTED,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  }
}
function thStyle() {
  return {
    padding: '8px 12px', textAlign: 'left',
    fontFamily: FB, fontSize: 11, fontWeight: 700, color: MUTED,
    textTransform: 'uppercase', letterSpacing: '0.14em',
  }
}
function tdStyle() {
  return { padding: '10px 12px', fontFamily: FB, fontSize: 13, color: NAVY }
}

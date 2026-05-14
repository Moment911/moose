"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import SideNav from './SideNav'
import Inspector from './Inspector'
import { useKotoIQData } from '../../../context/KotoIQDataContext'

/**
 * Universal KotoIQ shell — wraps any tab's content with the persistent
 * left rail (SideNav, owns Launch All + tool navigation) and an optional
 * right rail (Inspector, owns Data Health + freshness + KPIs).
 *
 * Phase 2: replaces the dashboard-only DashboardLayout. Every tab now
 * gets the same chrome — left rail always visible, Inspector visible
 * on data-heavy tabs (configurable via INSPECTOR_TABS).
 *
 * Owns the Launch All trigger + polling so it works from any tab; bumps
 * the shared refresh key on completion.
 *
 * Responsive:
 *   - <1200px: Inspector tucks behind a chevron toggle
 *   - <900px:  SideNav becomes a hamburger drawer
 */

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"

// Tabs where the Inspector rail makes sense — these are data-driven views
// where freshness + Data Health context adds value. Tool-heavy tabs that
// own their own full-width chrome (builder, bulk_ops, knowledge_graph,
// AI page builder, etc.) are excluded so they can use the full screen.
const INSPECTOR_TABS = new Set([
  'dashboard',
  'keywords',
  'strategy',
  'scorecard',
  'page_factory',
  'topical_authority',
  'topical_map',
  'eeat',
  'brand_serp',
  'backlinks',
  'schema',
  'internal_links',
  'gbp',
  'content_refresh',
  'rank_tracker',
  'semantic',
  'aeo',
  'multi_engine_aeo',
  'query_paths',
  'gsc_audit',
  'roi',
])

export default function KotoIQShell({ clientId, agencyId, clients, currentTab, onSwitchTab, children }) {
  const { bumpRefresh, freshness } = useKotoIQData()
  const [launching, setLaunching] = useState(false)
  const pollRef = useRef(null)
  const runIdRef = useRef(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [navOpen, setNavOpen] = useState(true)
  const [narrowScreen, setNarrowScreen] = useState(false)
  const [veryNarrow, setVeryNarrow] = useState(false)

  const client = clients?.find(c => c.id === clientId)
  const clientName = client?.name || ''
  const hasWebsite = !!client?.website
  const showInspector = INSPECTOR_TABS.has(currentTab)

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      setNarrowScreen(w < 1200)
      setVeryNarrow(w < 900)
      if (w < 1200) setInspectorOpen(false)
      if (w < 900) setNavOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // "Last synced X ago" — earliest of any source's last_run_at, displayed
  // in the SideNav under the Launch button.
  const lastSyncedAgo = (() => {
    let mostRecent = null
    for (const k of Object.keys(freshness || {})) {
      const f = freshness[k]
      if (!f?.last_run_at) continue
      if (!mostRecent || new Date(f.last_run_at) > new Date(mostRecent)) {
        mostRecent = f.last_run_at
      }
    }
    if (!mostRecent) return null
    const days = (Date.now() - new Date(mostRecent).getTime()) / 86400000
    if (days < 0.04) return 'just now'
    if (days < 1) return `${Math.round(days * 24 * 60)}m ago`
    if (days < 14) return `${Math.round(days)}d ago`
    return new Date(mostRecent).toLocaleDateString()
  })()

  const launchAll = useCallback(async () => {
    if (!clientId || !hasWebsite) {
      toast.error('Client needs a website URL first')
      return
    }
    setLaunching(true)
    toast.loading('Deploying all KotoIQ agents…', { id: 'runall' })
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all_audits', client_id: clientId, agency_id: agencyId }),
      })
      const data = await res.json()
      if (data.error || !data.run_id) {
        toast.error(data.error || 'Failed to start audits', { id: 'runall' })
        setLaunching(false)
        return
      }
      runIdRef.current = data.run_id
      pollRef.current = setInterval(async () => {
        if (!runIdRef.current) return
        try {
          const s = await fetch('/api/kotoiq', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'run_all_status', run_id: runIdRef.current }),
          }).then(r => r.json())
          if (s.status === 'complete' || s.status === 'failed') {
            clearInterval(pollRef.current)
            pollRef.current = null
            runIdRef.current = null
            setLaunching(false)
            if (s.status === 'complete') {
              toast.success(`All audits complete · ${(s.completed_actions || []).length} tools succeeded`, { id: 'runall' })
            } else {
              toast.error('Some audits failed — check individual tabs', { id: 'runall' })
            }
            bumpRefresh()
          }
        } catch { /* keep polling */ }
      }, 5000)
    } catch {
      toast.error('Failed to start audits', { id: 'runall' })
      setLaunching(false)
    }
  }, [clientId, agencyId, hasWebsite, bumpRefresh])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  return (
    <div style={S.shell}>

      {navOpen && (
        <SideNav
          currentTab={currentTab}
          onSwitchTab={(t) => {
            onSwitchTab && onSwitchTab(t)
            if (veryNarrow) setNavOpen(false)
          }}
          clientName={clientName}
          onLaunchAll={launchAll}
          launching={launching}
          lastSyncedAgo={lastSyncedAgo}
        />
      )}

      <main style={S.main}>
        {children}
      </main>

      {showInspector && inspectorOpen && !veryNarrow && (
        <Inspector
          clientId={clientId}
          onSwitchTab={onSwitchTab}
        />
      )}

      {showInspector && narrowScreen && !veryNarrow && (
        <button
          onClick={() => setInspectorOpen(o => !o)}
          style={S.toggleInspector}
          title={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
        >
          {inspectorOpen ? '›' : '‹'}
        </button>
      )}

      {veryNarrow && (
        <button
          onClick={() => setNavOpen(o => !o)}
          style={S.toggleNav}
          title={navOpen ? 'Hide Nav' : 'Show Nav'}
        >
          ☰
        </button>
      )}

    </div>
  )
}

const S = {
  shell: {
    display: 'flex',
    width: '100%',
    minHeight: 'calc(100vh - 80px)',
    fontFamily: SF,
    background: '#FCFCFA',
    position: 'relative',
  },
  main: {
    flex: 1,
    minWidth: 0, // Allow children to shrink properly inside flex
    overflowY: 'auto',
    height: '100%',
    background: '#FCFCFA',
  },
  toggleInspector: {
    position: 'fixed',
    right: 8,
    top: 80,
    width: 28, height: 28,
    borderRadius: '50%',
    border: '1px solid #E8E6E1',
    background: '#FFFFFF',
    color: '#6B6B70',
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,.08)',
    zIndex: 5,
  },
  toggleNav: {
    position: 'fixed',
    left: 8,
    top: 80,
    width: 32, height: 32,
    borderRadius: '50%',
    border: '1px solid #E8E6E1',
    background: '#FFFFFF',
    color: '#0A0A0A',
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,.08)',
    zIndex: 5,
  },
}

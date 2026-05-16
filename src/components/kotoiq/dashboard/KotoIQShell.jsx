"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react'
import SideNav from './SideNav'
import Inspector from './Inspector'
import KotoTabHeader from './KotoTabHeader'
import { useKotoIQData } from '../../../context/KotoIQDataContext'
import { kotoiqFetch } from '../../../lib/kotoiqFetch'

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

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

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

export default function KotoIQShell({ clientId, agencyId, clients, currentTab, onSwitchTab, onSwitchClient, children }) {
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
      const data = await kotoiqFetch('run_all_audits', { client_id: clientId, agency_id: agencyId })
      if (!data || data.error || !data.run_id) {
        toast.error(data?.error || 'Failed to start audits', { id: 'runall' })
        setLaunching(false)
        return
      }
      runIdRef.current = data.run_id
      pollRef.current = setInterval(async () => {
        if (!runIdRef.current) return
        try {
          const s = await kotoiqFetch('run_all_status', { run_id: runIdRef.current })
          if (!s) return
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

      {navOpen ? (
        <div style={S.railLeftWrap}>
          <SideNav
            currentTab={currentTab}
            onSwitchTab={(t) => {
              onSwitchTab && onSwitchTab(t)
              if (veryNarrow) setNavOpen(false)
            }}
            clientName={clientName}
            clients={clients}
            clientId={clientId}
            onSwitchClient={onSwitchClient}
            onLaunchAll={launchAll}
            launching={launching}
            lastSyncedAgo={lastSyncedAgo}
          />
          <button
            onClick={() => setNavOpen(false)}
            style={S.toggleIconLeft}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <PanelLeftClose size={15} strokeWidth={1.75} color="#6B6B70" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setNavOpen(true)}
          style={S.collapsedStripLeft}
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <PanelLeft size={15} strokeWidth={1.75} color="#6B6B70" />
        </button>
      )}

      <main style={S.main}>
        {/* Universal page header — pulls metadata from kotoiqTabMeta.ts.
            Renders nothing for tabs that own their own bespoke hero (AEO,
            Today, Auto-Fix Queue, Feature Directory, etc.). */}
        <KotoTabHeader tabKey={currentTab} />
        {children}
      </main>

      {showInspector && (inspectorOpen ? (
        <div style={S.railRightWrap}>
          <button
            onClick={() => setInspectorOpen(false)}
            style={S.toggleIconRight}
            title="Hide inspector"
            aria-label="Hide inspector"
          >
            <PanelRightClose size={15} strokeWidth={1.75} color="#6B6B70" />
          </button>
          <Inspector
            clientId={clientId}
            onSwitchTab={onSwitchTab}
          />
        </div>
      ) : (
        <button
          onClick={() => setInspectorOpen(true)}
          style={S.collapsedStripRight}
          title="Show inspector"
          aria-label="Show inspector"
        >
          <PanelRight size={15} strokeWidth={1.75} color="#6B6B70" />
        </button>
      ))}

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
    minWidth: 0,
    overflowY: 'auto',
    height: '100%',
    background: '#FCFCFA',
  },
  // Wraps the SideNav so we can position the toggle icon inside the rail
  railLeftWrap: {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    height: '100%',
  },
  railRightWrap: {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    height: '100%',
  },
  // Subtle sidebar-toggle icon button anchored top-right of left rail
  toggleIconLeft: {
    position: 'absolute',
    top: 14,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 6,
  },
  // Subtle sidebar-toggle icon button anchored top-left of right rail
  toggleIconRight: {
    position: 'absolute',
    top: 22,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 6,
  },
  // Collapsed-state thin strip — full height, subtle, click anywhere to expand
  collapsedStripLeft: {
    width: 28,
    flexShrink: 0,
    background: '#F5F4F2',
    borderRight: '1px solid #E8E6E1',
    cursor: 'pointer',
    border: 'none',
    padding: '14px 0 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  collapsedStripRight: {
    width: 28,
    flexShrink: 0,
    background: '#F5F4F2',
    borderLeft: '1px solid #E8E6E1',
    cursor: 'pointer',
    border: 'none',
    padding: '22px 0 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
}

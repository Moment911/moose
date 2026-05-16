"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import SideNav from './SideNav'
import CenterPane from './CenterPane'
import Inspector from './Inspector'
import { useKotoIQData } from '../../../context/KotoIQDataContext'

/**
 * 3-pane dashboard layout — Variant C (macOS Finder / Mail influence).
 *
 * Owns the run_all_audits trigger + polling loop (moved out of
 * MissionControl). Bumps the shared refresh key on completion so all
 * subscribers (CenterPane, Inspector, FreshnessBadge instances) refetch.
 *
 * Responsive collapse:
 *   - Below 1200px wide: right inspector tucks behind a button
 *   - Below 900px wide: left nav becomes a hamburger drawer
 *
 * Other tabs (strategy, scorecard, etc.) still render in KotoIQPage as
 * before — this layout is dashboard-only for Phase 1. Phase 2 would
 * wrap every tab in the same chrome.
 */

const SF = "'DM Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

export default function DashboardLayout({ clientId, agencyId, clients, currentTab, onSwitchTab }) {
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

  // Track viewport for responsive collapse
  useEffect(() => {
    const check = () => {
      setNarrowScreen(window.innerWidth < 1200)
      setVeryNarrow(window.innerWidth < 900)
      if (window.innerWidth < 1200) setInspectorOpen(false)
      if (window.innerWidth < 900) setNavOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Find last completed run for "Last synced" indicator
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

  // Run All Audits — kicks off run_all_audits + polls every 5s until complete
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
    } catch (e) {
      toast.error('Failed to start audits', { id: 'runall' })
      setLaunching(false)
    }
  }, [clientId, agencyId, hasWebsite, bumpRefresh])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  return (
    <div style={{
      ...S.shell,
      // Reach full viewport — the parent KotoIQPage already has its own scroll
      // container, so this layout fills its given height.
      minHeight: 'calc(100vh - 64px)',
    }}>

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

      <CenterPane
        clientId={clientId}
        agencyId={agencyId}
        clientName={clientName}
        onSwitchTab={onSwitchTab}
      />

      {inspectorOpen && !veryNarrow && (
        <Inspector
          clientId={clientId}
          onSwitchTab={onSwitchTab}
        />
      )}

      {/* Toggle for inspector on narrow screens */}
      {narrowScreen && !veryNarrow && (
        <button
          onClick={() => setInspectorOpen(o => !o)}
          style={S.toggleInspector}
          title={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
        >
          {inspectorOpen ? '›' : '‹'}
        </button>
      )}

      {/* Toggle for nav on very narrow screens */}
      {veryNarrow && (
        <button
          onClick={() => setNavOpen(o => !o)}
          style={{ ...S.toggleInspector, left: 8, right: 'auto' }}
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
    fontFamily: SF,
    background: '#FCFCFA',
    position: 'relative',
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
  },
}

"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { Command, RefreshCw, Globe } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { R, BLK, FH, FB } from '../lib/theme'
import ViewToggle from '../components/kotoiq-wp/ViewToggle'
import FleetView   from '../components/kotoiq-wp/FleetView'
import ClientView  from '../components/kotoiq-wp/ClientView'
import KotoIQWPTemplatesTab from './kotoiq/KotoIQWPTemplatesTab'
import KotoIQWPDualRunPanel from './kotoiq/KotoIQWPDualRunPanel'

/**
 * KotoIQWPPage — unified WordPress site management at /kotoiq-wp.
 *
 * Replaces three older routes (/wpsimplecode, /kotoiq-sites, /control-center)
 * with a single page that toggles between FleetView (agency-wide table +
 * bulk update + stats) and ClientView (per-client deep-dive with 6 module
 * tabs). Drill-down from Fleet → Client is one click on any row.
 *
 * URL state:
 *   ?view=fleet|client   — which view is active
 *   ?site=<uuid>         — pre-selected site for Client view
 * Persists `view` to localStorage so the user's preference sticks across
 * sessions.
 *
 * Unified Marketing palette throughout: navy + pink + cream.
 */
const NAVY  = BLK
const PINK  = R
const CREAM = '#faf9f6'
const LINE  = '#e9e6dd'
const VIEW_LS_KEY = 'kotoiq_wp_view'

function readFromURL() {
  if (typeof window === 'undefined') return { view: 'fleet', siteId: null, tab: null, clientId: null }
  const params = new URLSearchParams(window.location.search)
  const urlView = params.get('view')
  const urlSite = params.get('site')
  const urlTab = params.get('tab')
  const urlClient = params.get('client')
  const validViews = ['fleet', 'client', 'templates', 'dualrun']
  if (validViews.includes(urlView)) {
    return { view: urlView, siteId: urlSite || null, tab: urlTab || null, clientId: urlClient || null }
  }
  const stored = window.localStorage?.getItem(VIEW_LS_KEY)
  const validStored = validViews.includes(stored) ? stored : 'fleet'
  return { view: validStored, siteId: urlSite || null, tab: urlTab || null, clientId: urlClient || null }
}

export default function KotoIQWPPage() {
  const { agencyName, fullName } = useAuth()
  const [{ view, siteId, tab, clientId }, setState] = useState({ view: 'fleet', siteId: null, tab: null, clientId: null })
  const [hydrated, setHydrated] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const skipPushRef = useRef(false)

  useEffect(() => {
    setState(readFromURL())
    setHydrated(true)
    const onPop = () => { skipPushRef.current = true; setState(readFromURL()) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Sync URL + localStorage whenever state changes.
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const params = new URLSearchParams()
    params.set('view', view)
    if (siteId) params.set('site', siteId)
    if (clientId) params.set('client', clientId)
    if (tab) params.set('tab', tab)
    const next = `${window.location.pathname}?${params.toString()}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      if (skipPushRef.current) {
        skipPushRef.current = false
        window.history.replaceState({}, '', next)
      } else {
        window.history.pushState({}, '', next)
      }
    }
    try { window.localStorage?.setItem(VIEW_LS_KEY, view) } catch {}
  }, [view, siteId, tab, clientId, hydrated])

  const setView = useCallback(v => setState(s => ({ view: v, siteId: v === 'client' ? s.siteId : null, tab: null, clientId: v === 'client' ? s.clientId : null })), [])
  const handleSelectSite = useCallback((site, cId) => {
    setState(s => ({ view: 'client', siteId: site?.id || null, tab: s.tab || null, clientId: cId || null }))
  }, [])
  const handleTabChange = useCallback(t => {
    setState(s => ({ ...s, tab: t }))
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: CREAM }}>
      <Sidebar/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* Top bar: brand + breadcrumb + view toggle + refresh */}
        <div style={{
          padding: '14px 28px', borderBottom: `1px solid ${LINE}`,
          background: '#fff', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${PINK}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Globe size={18} color={PINK}/>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: FB, fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: '-0.01em' }}>
              KotoIQ WP
            </span>
            {agencyName && <>
              <span style={{ color: '#d1d5db', fontSize: 14 }}>›</span>
              <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{agencyName}</span>
            </>}
            <span style={{ color: '#d1d5db', fontSize: 14 }}>›</span>
            <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: PINK }}>
              {view === 'fleet' ? 'Fleet'
                : view === 'templates' ? 'Templates'
                : view === 'dualrun' ? 'Dual-run'
                : 'Client'}
            </span>
          </div>

          <ViewToggle value={view} onChange={setView}/>

          <button
            onClick={() => setRefreshNonce(n => n + 1)}
            title="Refresh"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 11px', borderRadius: 8,
              border: `1px solid ${LINE}`, background: '#fff', color: NAVY,
              fontFamily: FB, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <RefreshCw size={11}/> Refresh
          </button>

          {fullName && (
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB }}>
              Signed in as <strong style={{ color: '#6b7280' }}>{fullName}</strong>
            </span>
          )}
        </div>

        {/* Active view */}
        {hydrated && view === 'fleet' && (
          <FleetView key={`fleet-${refreshNonce}`} onSelectSite={handleSelectSite}/>
        )}
        {hydrated && view === 'client' && (
          <ClientView
            key={`client-${refreshNonce}`}
            preselectedSiteId={siteId}
            preselectedClientId={clientId}
            preselectedTab={tab}
            onSiteSelected={handleSelectSite}
            onTabChange={handleTabChange}
            onClearSelection={() => setState(s => ({ ...s, siteId: null, clientId: null }))}
          />
        )}
        {hydrated && view === 'templates' && (
          <KotoIQWPTemplatesTab key={`templates-${refreshNonce}`}/>
        )}
        {hydrated && view === 'dualrun' && (
          <KotoIQWPDualRunPanel key={`dualrun-${refreshNonce}`}/>
        )}
      </div>
    </div>
  )
}

"use client"
import { useState, useEffect, useCallback } from 'react'
import { Command, RefreshCw, Globe } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { R, BLK, FH, FB } from '../lib/theme'
import ViewToggle from '../components/kotoiq-wp/ViewToggle'
import FleetView   from '../components/kotoiq-wp/FleetView'
import ClientView  from '../components/kotoiq-wp/ClientView'

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

function readInitial() {
  if (typeof window === 'undefined') return { view: 'fleet', siteId: null }
  const params = new URLSearchParams(window.location.search)
  const urlView = params.get('view')
  const urlSite = params.get('site')
  if (urlView === 'fleet' || urlView === 'client') {
    return { view: urlView, siteId: urlSite || null }
  }
  const stored = window.localStorage?.getItem(VIEW_LS_KEY)
  return { view: stored === 'client' ? 'client' : 'fleet', siteId: urlSite || null }
}

export default function KotoIQWPPage() {
  const { agencyName, fullName } = useAuth()
  const [{ view, siteId }, setState] = useState({ view: 'fleet', siteId: null })
  const [hydrated, setHydrated] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    setState(readInitial())
    setHydrated(true)
  }, [])

  // Sync URL + localStorage whenever view/siteId changes.
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.set('view', view)
    if (siteId) params.set('site', siteId); else params.delete('site')
    const next = `${window.location.pathname}?${params.toString()}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({}, '', next)
    }
    try { window.localStorage?.setItem(VIEW_LS_KEY, view) } catch {}
  }, [view, siteId, hydrated])

  const setView = useCallback(v => setState(s => ({ view: v, siteId: v === 'client' ? s.siteId : null })), [])
  const handleSelectSite = useCallback(site => {
    setState({ view: 'client', siteId: site?.id || null })
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
              {view === 'fleet' ? 'Fleet' : 'Client'}
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
            key={`client-${siteId || 'none'}-${refreshNonce}`}
            preselectedSiteId={siteId}
            onClearSelection={() => setState(s => ({ ...s, siteId: null }))}
          />
        )}
      </div>
    </div>
  )
}

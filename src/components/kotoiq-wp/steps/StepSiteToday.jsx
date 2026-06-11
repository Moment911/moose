'use client'
// ── Step 2: Your site today ─────────────────────────────────────────────────
// The day-1 baseline inventory of the client's OWN pages (11-02), shown as a
// page count + a page-type breakdown, with a LiveTicker driven by the spine's
// run_all_status polling so the long background scan never looks frozen. The ONE
// primary action is "Next: see who you're up against" once we have a baseline.
//
// While the scan is running (no baseline yet, or run still in flight) we show
// the LiveTicker (Pattern 10) with the current wave — that's the live status.

import { useState, useEffect, useCallback } from 'react'
import { FileText, ArrowRight, Tag, Quote, Wrench, Package } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, Skeleton, LiveTicker, StatGrid, Stat, FlagChip,
} from '../../ui/koto'
import CategoryChips from '../../kotoiq/CategoryChips'
import StepShell from './StepShell'

// The four comprehensive categories (12-01) — each rendered as its own editable
// chip group, all hydrated from ONE extract_comprehensive call (12-02 seedItems)
// so we don't fire four round-trips.
const CATEGORIES = [
  { key: 'keywords',  label: 'Keywords',  icon: Tag,    placeholder: 'Add a keyword…' },
  { key: 'phrases',   label: 'Phrases',   icon: Quote,  placeholder: 'Add a phrase…' },
  { key: 'services',  label: 'Services',  icon: Wrench,  placeholder: 'Add a service…' },
  { key: 'offerings', label: 'Offerings', icon: Package, placeholder: 'Add an offering…' },
]

export default function StepSiteToday({ clientId, agencyId, goNext, runId, scanStatus, scanRunning }) {
  const [loading, setLoading] = useState(true)
  const [inv, setInv] = useState(null) // { total_pages, types[], captured_at, sample[] }
  const [error, setError] = useState(null)

  // ONE comprehensive extraction (12-01) → four category lists, fetched once and
  // passed to four CategoryChips groups via seedItems (no four round-trips).
  const [extract, setExtract] = useState(null) // full extract_comprehensive response
  const [extractError, setExtractError] = useState(null)

  const loadExtract = useCallback(async () => {
    if (!clientId || !agencyId) return
    setExtractError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_comprehensive', client_id: clientId, agency_id: agencyId }),
      })
      const d = await r.json()
      if (d.error && !d.keywords && !d.services) {
        setExtractError(typeof d.error === 'string' ? d.error : 'Could not extract from your site')
        return
      }
      setExtract(d)
    } catch (e) {
      setExtractError(e?.message || 'Could not reach the server')
    }
  }, [clientId, agencyId])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_site_inventory', client_id: clientId, agency_id: agencyId }),
      })
      const d = await r.json()
      if (d.error) { setError(typeof d.error === 'string' ? d.error : 'Could not load your site inventory'); return }
      setInv(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadExtract() }, [loadExtract])

  // Refresh the inventory + the comprehensive extraction when the scan completes
  // (it populates the baseline that both read from).
  useEffect(() => {
    if (scanStatus?.status && scanStatus.status !== 'running') { load(); loadExtract() }
  }, [scanStatus?.status, load, loadExtract])

  const hasInventory = inv?.total_pages > 0
  const status = loading ? 'running' : scanRunning ? 'running' : hasInventory ? 'done' : 'waiting'

  // Live wave label for the ticker.
  const waveLabel = scanStatus
    ? `Scanning your site · wave ${scanStatus.wave || 1} of ${scanStatus.total_waves || 3}`
    : 'Scanning your site'

  return (
    <StepShell
      stepNumber={2}
      title="Your site today"
      accent="today"
      status={status}
      subtitle="A snapshot of every page already on your site — how many there are and what kinds. This is your starting line, so we only ever build what's missing."
      noteId="guided-site-today"
      noteTitle="What this does"
      note={
        <>
          We crawl your live site once and save an inventory of its pages. Later, when we suggest
          new pages, we check this list first — so we never duplicate something you already have.
        </>
      }
    >
      {/* Live scan status — the anti-"looks broken" signal. */}
      {scanRunning && (
        <div style={{ marginBottom: 18 }}>
          <LiveTicker label={waveLabel} value={`${(scanStatus?.completed_actions?.length || 0)} done`} />
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: t.muted, lineHeight: 1.5 }}>
            This runs in the background and can take a couple of minutes. You can keep going — the
            inventory fills in as the scan completes.
          </p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="40%" />
        </div>
      )}

      {!loading && error && (
        <ActionCallout variant="warning" title="Couldn't load your inventory" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {!loading && !error && hasInventory && (
        <>
          <StatGrid columns={Math.min(4, 1 + (inv.types?.length || 0))}>
            <Stat value={inv.total_pages} label="Pages on your site" />
            {(inv.types || []).slice(0, 3).map((tp, i, arr) => (
              <Stat key={tp.type} value={tp.count} label={tp.type} isLast={i === arr.length - 1} />
            ))}
          </StatGrid>

          {inv.captured_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <FlagChip variant="info" icon={FileText}>From your own site</FlagChip>
              <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.muted }}>
                captured {new Date(inv.captured_at).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Four-category comprehensive extraction (12-01) — keywords / phrases /
              services / offerings — each an editable chip group, all hydrated from
              ONE extract_comprehensive call (seedItems). The user curates + confirms
              per category; AI-inferred chips are flagged (data-integrity). */}
          <div style={{ borderTop: `1px solid ${t.line}`, margin: '8px 0 0', paddingTop: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontFamily: t.fontBody, fontSize: 16, fontWeight: 600, color: t.text }}>
              What we found on your site
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: t.muted, lineHeight: 1.55, maxWidth: 640 }}>
              We read your pages and pulled out the keywords, phrases, services, and offerings you already
              signal. Edit each list — confirmed items drive your competitor analysis, gaps, and strategy.
            </p>

            {extractError && (
              <ActionCallout variant="warning" title="Couldn't extract from your site" action={{ label: 'Retry', onClick: loadExtract }}>
                {extractError}
              </ActionCallout>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {CATEGORIES.map((c) => (
                <div key={c.key} style={{
                  background: t.off, border: `1px solid ${t.line}`, borderRadius: t.rTile, padding: '18px 20px',
                }}>
                  <CategoryChips
                    agencyId={agencyId}
                    clientId={clientId}
                    category={c.key}
                    title={`Your ${c.label.toLowerCase()}`}
                    icon={c.icon}
                    placeholder={c.placeholder}
                    seedItems={extract}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <CtaButton
              label="See who you're up against"
              icon={ArrowRight}
              onClick={goNext}
              pulse
            />
          </div>
        </>
      )}

      {!loading && !error && !hasInventory && !scanRunning && (
        <EmptyState
          icon={FileText}
          headline="No inventory yet"
          sub={runId
            ? 'The scan is queued. Page inventory shows up here the moment the first wave finishes.'
            : 'Run the scan on step 1 to capture your site\'s pages, then come back here.'}
          primary={{ label: 'Refresh', onClick: load }}
        />
      )}
    </StepShell>
  )
}

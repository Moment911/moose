'use client'
// ── Step 1: Connected ───────────────────────────────────────────────────────
// Pair status for the current client. We read koto_wp_sites via the existing
// /api/wp `wpsc_list_clients` action and look for the row whose client matches.
// A site is fully connected on the v4 channel when shim_version==='v4' AND
// connected===true. The ONE primary action is "Scan my site now" — it kicks the
// post-pair audit chain (run_all_audits) and hands the run id up to the spine so
// step 2 can poll live status. (Pairing itself happens in Settings → WordPress;
// this step verifies it and starts the work, it does not re-implement pairing.)

import { useState, useEffect, useCallback } from 'react'
import { Plug, RefreshCw } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import { CtaButton, ActionCallout, Skeleton, NextStepLink, FlagChip } from '../../ui/koto'
import StepShell from './StepShell'

export default function StepConnected({ clientId, agencyId, goNext, runId, setRunId, scanRunning }) {
  const [loading, setLoading] = useState(true)
  const [site, setSite] = useState(null)
  const [clientName, setClientName] = useState('')
  const [kicking, setKicking] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/wp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wpsc_list_clients', agency_id: agencyId }),
      })
      const d = await r.json()
      if (d.error) { setError(typeof d.error === 'string' ? d.error : 'Could not load connection status'); return }
      const row = (d.rows || []).find(rw => rw.client?.id === clientId)
      setSite(row?.site || null)
      setClientName(row?.client?.name || '')
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [agencyId, clientId])

  useEffect(() => { load() }, [load])

  const isV4 = site?.shim_version === 'v4'
  const connected = !!site?.connected && isV4

  // ONE primary action: scan the site (kick run_all_audits) and advance.
  const scanNow = useCallback(async () => {
    setKicking(true)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all_audits', client_id: clientId, agency_id: agencyId }),
      })
      const d = await r.json()
      if (d.run_id) {
        setRunId(d.run_id)
        goNext() // → step 2 (Your site today) shows the live scan
      } else {
        setError(typeof d.error === 'string' ? d.error : 'Could not start the scan')
      }
    } catch (e) {
      setError(e?.message || 'Could not start the scan')
    } finally {
      setKicking(false)
    }
  }, [clientId, agencyId, setRunId, goNext])

  const status = loading ? 'running' : connected ? 'done' : 'waiting'

  return (
    <StepShell
      stepNumber={1}
      title="Connected"
      status={status}
      subtitle={
        connected
          ? `${clientName || 'This client'}'s WordPress site is paired with KotoIQ. We can read its pages and publish back to it.`
          : 'Before we can help, your WordPress site needs to be paired with KotoIQ so we can read your pages and publish new ones.'
      }
      noteId="guided-connected"
      noteTitle="What this does"
      note={
        <>
          Pairing connects your live WordPress site to KotoIQ over a signed, secure link.
          Once paired, every scan and every page we build flows to the real site — nothing here is a mockup.
        </>
      }
    >
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={20} width="60%" />
          <Skeleton height={44} width={220} radius={t.rPill} />
        </div>
      )}

      {!loading && error && (
        <ActionCallout variant="warning" title="Couldn't check the connection" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {!loading && !error && connected && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Plug size={16} color={t.success} />
            <span style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>
              Paired on the v4 channel
            </span>
            <FlagChip variant="success">Live</FlagChip>
            {site?.site_url && (
              <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.muted }}>{site.site_url}</span>
            )}
          </div>
          <CtaButton
            label={scanRunning ? 'Scan running…' : runId ? 'Re-scan my site' : 'Scan my site now'}
            icon={RefreshCw}
            onClick={scanNow}
            disabled={kicking || scanRunning}
            pulse={!runId && !scanRunning}
          />
          {(runId || scanRunning) && (
            <div style={{ marginTop: 16 }}>
              <NextStepLink onClick={goNext}>see your site inventory</NextStepLink>
            </div>
          )}
        </>
      )}

      {!loading && !error && !connected && (
        <ActionCallout
          variant="info"
          title="Not paired yet"
          action={{ label: 'Open WordPress settings', href: '/kotoiq-wp?shell=settings' }}
        >
          {site
            ? 'This site is connected on the legacy channel. Re-pair it on the v4 channel from Settings → WordPress to unlock guided onboarding.'
            : 'No WordPress site is paired for this client yet. Pair one from Settings → WordPress, then come back here.'}
        </ActionCallout>
      )}
    </StepShell>
  )
}

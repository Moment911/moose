'use client'
// ── Step 6: Live + cited ────────────────────────────────────────────────────
// Surfaces what's actually live (published Page Factory pages) and whether AI
// assistants are citing the client (AEO = answer-engine optimization). This step
// is SURFACE ONLY — no auto-remediation (deferred per CONTEXT). The ONE primary
// action is "Open AEO visibility" to dig deeper. We gloss every acronym in plain
// English so a non-expert understands what they're looking at.

import { useState, useEffect, useCallback } from 'react'
import { Radio, ExternalLink, Sparkles } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, StatGrid, Stat, FlagChip, Skeleton,
} from '../../ui/koto'
import StepShell from './StepShell'

export default function StepLiveCited({ clientId, agencyId }) {
  const [loading, setLoading] = useState(true)
  const [pub, setPub] = useState(null)  // get_page_factory_stats
  const [aeo, setAeo] = useState(null)  // aeo_overview_stats
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [pubRes, aeoRes] = await Promise.all([
        fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_page_factory_stats', client_id: clientId, agency_id: agencyId }),
        }).then(r => r.json()).catch(() => null),
        fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'aeo_overview_stats', client_id: clientId, agency_id: agencyId }),
        }).then(r => r.json()).catch(() => null),
      ])
      if (pubRes && !pubRes.error) setPub(pubRes)
      if (aeoRes && !aeoRes.error) setAeo(aeoRes)
      if ((!pubRes || pubRes.error) && (!aeoRes || aeoRes.error)) {
        setError('Could not load your live status')
      }
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load])

  const publishedTotal = pub?.publishes?.total || 0
  const publishedRecent = pub?.publishes?.last_7_days || 0
  const sov = aeo?.share_of_voice ?? null
  const promptsTracked = aeo?.prompts_tracked ?? 0
  const hasAnything = publishedTotal > 0 || promptsTracked > 0

  const status = loading ? 'running' : hasAnything ? 'done' : 'waiting'

  return (
    <StepShell
      stepNumber={7}
      title="Live + cited"
      accent="cited"
      status={status}
      subtitle="What's actually published, and whether AI assistants are recommending you. This is where you watch the work pay off."
      noteId="guided-live-cited"
      noteTitle="What this does"
      note={
        <>
          <strong>AEO</strong> (answer-engine optimization) is whether AI assistants like ChatGPT, Claude,
          Gemini, and Google's AI Overviews recommend you when someone asks. Share of voice is how often
          you show up versus competitors. We track it here so you can see the pages you built start getting cited.
        </>
      }
    >
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="45%" />
        </div>
      )}

      {!loading && error && (
        <ActionCallout variant="warning" title="Couldn't load your live status" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {!loading && !error && hasAnything && (
        <>
          <StatGrid columns={4}>
            <Stat value={publishedTotal} label="Pages live" />
            <Stat value={publishedRecent} label="Published · 7 days" color={t.pink} />
            <Stat
              value={sov != null ? sov : '—'}
              accent={sov != null ? '%' : undefined}
              label="AI share of voice"
              color={t.success}
            />
            <Stat value={promptsTracked} label="Prompts tracked" isLast />
          </StatGrid>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <FlagChip variant="info" icon={Sparkles}>AI assistants = ChatGPT · Claude · Gemini · Google AI</FlagChip>
            {aeo?.last_scan_at && (
              <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.muted }}>
                last checked {new Date(aeo.last_scan_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Surface only — no auto-remediation (deferred). */}
          <ActionCallout variant="tip" title="Want to dig into citations?">
            See exactly which AI assistants mention you, for which questions, and where competitors beat you —
            in the AEO visibility view.
          </ActionCallout>

          {/* Opens in a new tab so the guided flow stays put (no eject). */}
          <CtaButton
            label="Open AEO visibility"
            icon={ExternalLink}
            href="/kotoiq-wp?shell=intel&sub=aeo"
            target="_blank"
            pulse
          />
        </>
      )}

      {!loading && !error && !hasAnything && (
        <EmptyState
          icon={Radio}
          headline="Nothing live yet"
          sub="Once you build and publish pages from your plan, they show up here — and we start tracking whether AI assistants cite them."
          primary={{ label: 'Refresh', onClick: load }}
        />
      )}
    </StepShell>
  )
}

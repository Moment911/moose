'use client'
// ── Step 3: Who you're up against ───────────────────────────────────────────
// The user picks the cities they want to win (11-04 CityPicker, Census-backed),
// then we run the THREE-LENS competitor-intel aggregator (12-04 competitor_intel):
//   ORGANIC — top 3-5 by DataForSEO SERP rank
//   GEO     — local map-pack presence across the geo grid
//   AEO     — AI answer-engine share-of-voice (ChatGPT/Claude/Gemini/Perplexity/AIO)
// rendered per-competitor × per-lens with Blazly-style visibility bars + a
// DataSourceBadge per lens (source_url + fetched_at). A lens that failed to run is
// marked 'unavailable' EXPLICITLY — never empty-as-no-competitors (data-integrity).
//
// The chosen cities are owned by the spine and scope the gap list (step 4) + the
// strategy (step 6). All ranks are fetched live — never recalled or hardcoded.

import { useState, useEffect, useCallback } from 'react'
import { Swords, ArrowRight, Search, MapPin, MessageSquareQuote } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import { CtaButton, ActionCallout, FlagChip, NextStepLink } from '../../ui/koto'
import CityPicker from '../../kotoiq/CityPicker'
import DataSourceBadge from '../../DataSourceBadge'
import StepShell from './StepShell'

// The three lenses, with their plain-English gloss + icon.
const LENSES = [
  { key: 'organic', label: 'Organic', gloss: 'Google search results', icon: Search },
  { key: 'geo',     label: 'Map pack', gloss: 'Local map results (GEO)', icon: MapPin },
  { key: 'aeo',     label: 'AI answers', gloss: 'ChatGPT / Perplexity / AI Overviews (AEO)', icon: MessageSquareQuote },
]

// Map a competitor's per-lens data → a 0..1 visibility fraction for the bar.
function lensVisibility(comp, lensKey) {
  if (lensKey === 'organic') {
    const rank = comp.organic?.rank
    if (typeof rank !== 'number') return null
    // Rank 1 = full bar; rank 10+ ≈ empty. (1 → 1.0, 10 → 0.1)
    return Math.max(0.05, Math.min(1, (11 - Math.min(rank, 10)) / 10))
  }
  if (lensKey === 'geo') {
    const rank = comp.geo?.local_pack_rank
    if (typeof rank !== 'number' || rank == null) return null
    return Math.max(0.05, Math.min(1, (4 - Math.min(rank, 3)) / 3))
  }
  if (lensKey === 'aeo') {
    const share = comp.aeo?.share
    if (typeof share !== 'number') return null
    return Math.max(0.02, Math.min(1, share))
  }
  return null
}

function lensValueLabel(comp, lensKey) {
  if (lensKey === 'organic') return comp.organic?.rank != null ? `#${comp.organic.rank}` : '—'
  if (lensKey === 'geo') return comp.geo?.local_pack_rank != null ? `#${comp.geo.local_pack_rank}` : '—'
  if (lensKey === 'aeo') return comp.aeo?.share != null ? `${Math.round(comp.aeo.share * 100)}%` : '—'
  return '—'
}

// Blazly-style visibility bar (navy/cream — NOT the blazly reskin colours).
function VisibilityBar({ frac }) {
  if (frac == null) {
    return <span style={{ fontSize: 11, color: t.faint, fontFamily: t.fontMono }}>n/a</span>
  }
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 999, background: t.off, overflow: 'hidden', minWidth: 60 }}>
      <div style={{
        width: `${Math.round(frac * 100)}%`, height: '100%', borderRadius: 999,
        background: frac > 0.66 ? t.pink : frac > 0.33 ? t.warning : t.muted,
      }} />
    </div>
  )
}

export default function StepCompetitors({
  clientId, agencyId, goNext,
  selectedState, setSelectedState,
  selectedCities, setSelectedCities,
}) {
  const [states, setStates] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [intel, setIntel] = useState(null) // competitor_intel response
  const [error, setError] = useState(null)

  // Load the state list for the picker (STATE_FIPS — a permanent federal standard).
  useEffect(() => {
    let cancelled = false
    fetch('/api/kotoiq/topic-campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_states', agency_id: agencyId }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.states) setStates(d.states) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [agencyId])

  // CityPicker handlers (parent owns the Set).
  const onToggle = useCallback((name) => {
    setSelectedCities(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }, [setSelectedCities])
  const onSelectAllFiltered = useCallback((names) => {
    setSelectedCities(prev => {
      const next = new Set(prev)
      names.forEach(n => next.add(n))
      return next
    })
  }, [setSelectedCities])
  const onClear = useCallback(() => setSelectedCities(new Set()), [setSelectedCities])

  const cityCount = selectedCities.size

  // ONE primary action: run the three-lens competitor-intel aggregator (12-04)
  // for the chosen cities + the client's confirmed services.
  const findCompetitors = useCallback(async () => {
    setDiscovering(true); setError(null)
    try {
      const cities = Array.from(selectedCities)
      // The aggregator needs the confirmed services — read them from the profile.
      const sr = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract_comprehensive', client_id: clientId, agency_id: agencyId }),
      })
      const sd = await sr.json()
      const services = Array.isArray(sd?.services)
        ? sd.services.map(x => (x?.value || x?.name || '').trim()).filter(Boolean)
        : []

      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'competitor_intel',
          client_id: clientId, agency_id: agencyId,
          services: services.length ? services : ['general'],
          cities, state: selectedState,
        }),
      })
      const d = await r.json()
      if (d.error && !d.competitors) {
        setError(typeof d.error === 'string' ? d.error : 'Could not find competitors')
        return
      }
      setIntel(d)
    } catch (e) {
      setError(e?.message || 'Could not start competitor discovery')
    } finally {
      setDiscovering(false)
    }
  }, [selectedCities, selectedState, clientId, agencyId])

  const competitors = intel?.competitors || []
  const lensStatus = intel?.lenses || {}
  const provenance = intel?.provenance || {}
  const aiUnavailable = intel && intel.ai_available === false
  const discovered = !!intel
  const status = cityCount > 0 ? (discovered ? 'done' : 'waiting') : 'waiting'

  return (
    <StepShell
      stepNumber={3}
      title="Who you're up against"
      status={status}
      subtitle="Pick the cities you want to win. We'll find the businesses already ranking there — across Google search, the local map, and AI answers — so you can out-build the real competition."
      noteId="guided-competitors"
      noteTitle="What this does"
      note={
        <>
          Every city you choose gets checked against live results across three lenses: <strong>organic</strong> (Google
          search), <strong>map pack</strong> (local map results — GEO), and <strong>AI answers</strong> (who AI engines
          like ChatGPT and Perplexity cite — AEO). Real competitor data drives your plan. City data comes from the
          U.S. Census; rankings are fetched live and timestamped.
        </>
      }
    >
      <div style={{
        background: t.off, border: `1px solid ${t.line}`, borderRadius: t.rTile,
        padding: '18px 20px', marginBottom: 18,
      }}>
        <CityPicker
          agencyId={agencyId}
          states={states}
          state={selectedState}
          onStateChange={setSelectedState}
          selectedCities={selectedCities}
          onToggle={onToggle}
          onSelectAllFiltered={onSelectAllFiltered}
          onClear={onClear}
          title="Pick your target cities"
          subtitle="Each city becomes a market we score for gaps and (later) a page we can build."
        />
      </div>

      {cityCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FlagChip variant="high" icon={Swords}>{cityCount} {cityCount === 1 ? 'city' : 'cities'} selected</FlagChip>
        </div>
      )}

      {error && (
        <ActionCallout variant="warning" title="Couldn't run competitor intel" action={{ label: 'Retry', onClick: findCompetitors }}>
          {error}
        </ActionCallout>
      )}

      {cityCount === 0 ? (
        <ActionCallout variant="info" title="Pick at least one city">
          Choose the cities you want to rank in above. We score competitor gaps city by city.
        </ActionCallout>
      ) : !discovered ? (
        <CtaButton
          label={discovering ? 'Finding competitors…' : 'Find competitors in these cities'}
          icon={ArrowRight}
          onClick={findCompetitors}
          disabled={discovering}
          pulse={!discovering}
        />
      ) : null}

      {/* Per-lens status row — a failed lens is shown EXPLICITLY as unavailable. */}
      {discovered && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '4px 0 16px' }}>
            {LENSES.map((L) => {
              const st = lensStatus[L.key]
              const prov = provenance[L.key]
              const variant = st === 'ok' ? 'success' : st === 'unavailable' ? 'low' : 'medium'
              const label = st === 'ok' ? L.label : st === 'unavailable' ? `${L.label} · unavailable` : `${L.label} · skipped`
              return (
                <div key={L.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FlagChip variant={variant} icon={L.icon}>{label}</FlagChip>
                  {prov?.fetched_at && (
                    <DataSourceBadge
                      sourceName={prov.source_name || L.gloss}
                      sourceUrl={prov.source_url}
                      fetchedAt={prov.fetched_at}
                      category="rankings"
                      compact
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* AEO can't run without a funded AI key — show the banner, don't swallow. */}
          {aiUnavailable && (
            <ActionCallout variant="warning" title="AI-answer lens unavailable">
              We couldn't run the AI-answer (AEO) lens — it needs a funded AI key. The organic and map-pack
              lenses still ran. Once the AI key is funded, re-run to see who AI engines cite.
            </ActionCallout>
          )}

          {/* Per-competitor × per-lens visibility grid (Blazly-style bars). */}
          {competitors.length > 0 ? (
            <div style={{
              border: `1px solid ${t.line}`, borderRadius: t.rTile, overflow: 'hidden', marginBottom: 18,
            }}>
              {competitors.slice(0, 8).map((comp, i) => (
                <div key={`${comp.name}-${i}`} style={{
                  padding: '12px 16px', borderTop: i ? `1px solid ${t.line}` : 'none', background: t.white,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{comp.name}</span>
                    {comp.domain && (
                      <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.faint }}>{comp.domain}</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {LENSES.map((L) => (
                      <div key={L.key}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: t.muted, marginBottom: 4 }}>
                          {L.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <VisibilityBar frac={lensVisibility(comp, L.key)} />
                          <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.text, minWidth: 34, textAlign: 'right' }}>
                            {lensValueLabel(comp, L.key)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ActionCallout variant="info" title="No competitors surfaced yet">
              We ran the lenses but didn't find ranked competitors for these cities/services. Try more cities,
              or confirm your services on the previous step so the search is sharper.
            </ActionCallout>
          )}

          <CtaButton label="See your gaps" icon={ArrowRight} onClick={goNext} pulse />
          <div style={{ marginTop: 12 }}>
            <NextStepLink onClick={goNext}>see your gaps</NextStepLink>
          </div>
        </>
      )}
    </StepShell>
  )
}

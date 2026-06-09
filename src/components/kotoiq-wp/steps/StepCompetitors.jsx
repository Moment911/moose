'use client'
// ── Step 3: Who you're up against ───────────────────────────────────────────
// The user picks the cities they want to win (11-04 CityPicker, Census-backed),
// then we discover who already ranks for their services in those cities. The
// chosen cities are owned by the spine and scope the gap scoring in step 4.
//
// The ONE primary action is "Find competitors in these cities" — it kicks a
// competitor discovery pass (analyze_competitors over a representative
// service×city) for an immediate read, and advances to the gap report.
// All competitor rank data is fetched live (DataForSEO / Google Places) — never
// recalled or hardcoded (data-integrity standard).

import { useState, useEffect, useCallback } from 'react'
import { Swords, ArrowRight } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import { CtaButton, ActionCallout, FlagChip, NextStepLink } from '../../ui/koto'
import CityPicker from '../../kotoiq/CityPicker'
import StepShell from './StepShell'

export default function StepCompetitors({
  clientId, agencyId, goNext,
  selectedState, setSelectedState,
  selectedCities, setSelectedCities,
}) {
  const [states, setStates] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState(false)
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

  // ONE primary action: discover competitors in the chosen cities, then advance.
  const findCompetitors = useCallback(async () => {
    setDiscovering(true); setError(null)
    try {
      // Best-effort: kick a competitor discovery pass for a representative
      // city so the user gets immediate signal. The authoritative per-cell
      // ranks are gathered by score_grid (step 4) scoped to ALL chosen cities.
      const firstCity = Array.from(selectedCities)[0]
      if (firstCity) {
        await fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_competitors',
            client_id: clientId, agency_id: agencyId,
            market: { city: firstCity, state: selectedState },
          }),
        }).catch(() => {}) // never block the flow on a single preview
      }
      setDiscovered(true)
      goNext() // → step 4 (Your gaps) scores against these cities
    } catch (e) {
      setError(e?.message || 'Could not start competitor discovery')
    } finally {
      setDiscovering(false)
    }
  }, [selectedCities, selectedState, clientId, agencyId, goNext])

  const status = cityCount > 0 ? (discovered ? 'done' : 'waiting') : 'waiting'

  return (
    <StepShell
      stepNumber={3}
      title="Who you're up against"
      status={status}
      subtitle="Pick the cities you want to win. We'll find the businesses already ranking there for your services — that's the competition we'll out-build."
      noteId="guided-competitors"
      noteTitle="What this does"
      note={
        <>
          Every city you choose gets checked against live search results to see who ranks for your
          services there. Real competitor data drives your plan — so you build pages that beat real rivals,
          not guesses. City data comes from the U.S. Census; rankings are fetched live.
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
        <ActionCallout variant="warning" title="Couldn't start discovery" action={{ label: 'Retry', onClick: findCompetitors }}>
          {error}
        </ActionCallout>
      )}

      {cityCount === 0 ? (
        <ActionCallout variant="info" title="Pick at least one city">
          Choose the cities you want to rank in above. We score competitor gaps city by city.
        </ActionCallout>
      ) : (
        <CtaButton
          label={discovering ? 'Finding competitors…' : "Find competitors in these cities"}
          icon={ArrowRight}
          onClick={findCompetitors}
          disabled={discovering}
          pulse={!discovering}
        />
      )}

      {discovered && (
        <div style={{ marginTop: 16 }}>
          <NextStepLink onClick={goNext}>see your gaps</NextStepLink>
        </div>
      )}
    </StepShell>
  )
}

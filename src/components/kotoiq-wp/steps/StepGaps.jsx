'use client'
// ── Step 4: Your gaps ───────────────────────────────────────────────────────
// The EXTENSIVE, competitor-driven opportunity list (12-05 opportunity_list),
// rendered as OUTCOMES not metrics: "62 opportunities — 14 quick wins, 33 net-new,
// 15 big bets", grown beyond the client's own services by competitor-derived
// keywords (source_counts.competitor_derived). The user first confirms ALL FOUR
// comprehensive categories (12-02 CategoryChips, AI-inferred flagged) since the
// confirmed services drive the scoring + the seed set.
//
// The ONE primary action is "Find my opportunities" (then, once built, "Turn this
// into a strategy"). When competitor intel hasn't been run yet the list degrades
// to the own-only grid with a visible prompt to run step 3 (never empty-as-nothing).

import { useState, useCallback } from 'react'
import { Target, ArrowRight, MapPinOff, Tag, Quote, Wrench, Package } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, StatGrid, Stat, FlagChip, Skeleton,
} from '../../ui/koto'
import CategoryChips from '../../kotoiq/CategoryChips'
import StepShell from './StepShell'

// Human labels for the buckets (outcomes language).
const BUCKET_LABEL = {
  quick_win: 'Quick wins',
  net_new: 'Net-new',
  big_bet: 'Big bets',
  low_demand_deprioritize: 'Deprioritized',
}
const BUCKET_VARIANT = {
  quick_win: 'success',
  net_new: 'high',
  big_bet: 'medium',
  low_demand_deprioritize: 'low',
}

// The four comprehensive categories (12-01/12-02) confirmed here drive scoring.
const CATEGORIES = [
  { key: 'keywords',  label: 'Keywords',  icon: Tag,     placeholder: 'Add a keyword…' },
  { key: 'phrases',   label: 'Phrases',   icon: Quote,   placeholder: 'Add a phrase…' },
  { key: 'services',  label: 'Services',  icon: Wrench,  placeholder: 'Add a service…' },
  { key: 'offerings', label: 'Offerings', icon: Package, placeholder: 'Add an offering…' },
]

export default function StepGaps({
  clientId, agencyId, goNext,
  selectedState, selectedCities, confirmedServices, setConfirmedServices,
}) {
  // Services confirmed (the scoring-critical category). Other categories save
  // independently via their own CategoryChips Confirm button.
  const [servicesReady, setServicesReady] = useState(!!confirmedServices)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState(null) // opportunity_list response
  const [error, setError] = useState(null)

  const onServicesConfirmed = useCallback((services) => {
    setConfirmedServices(services)
    setServicesReady(true)
  }, [setConfirmedServices])

  // ONE primary action: build the EXTENSIVE competitor-driven opportunity list
  // (12-05) over the confirmed services + cities + competitor intel (step 3).
  const buildList = useCallback(async () => {
    setBuilding(true); setError(null)
    try {
      const cities = Array.from(selectedCities || [])
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'opportunity_list',
          client_id: clientId, agency_id: agencyId,
          cities: cities.length ? cities : undefined,
          state: selectedState || undefined,
        }),
      })
      const d = await r.json()
      if (!d.ok) { setError(typeof d.error === 'string' ? d.error : 'Could not build your opportunity list'); return }
      setResult(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setBuilding(false)
    }
  }, [clientId, agencyId, selectedCities, selectedState])

  const items = result?.items || []
  const buckets = result?.buckets || null
  const sourceCounts = result?.source_counts || null
  const competitorDerived = sourceCounts?.competitor_derived || 0
  const total = items.length
  // Cities the client listed but no competitor targets — surfaced with reason.
  const noCompetitorCells = items.filter(c => c.client_listed_city && (c.competitor_count || 0) === 0)

  const status = building ? 'running' : result ? 'done' : 'waiting'

  return (
    <StepShell
      stepNumber={4}
      title="Your gaps"
      accent="gaps"
      status={status}
      subtitle="The extensive list of pages your competitors rank for that you don't have yet — ranked by what'll move traffic fastest. First confirm what you offer, since that drives the list."
      noteId="guided-gaps"
      noteTitle="What this does"
      note={
        <>
          We take your confirmed services and the keywords your competitors rank for, then score every
          gap by demand, how contested it is, what you already cover, and how hard it is to win. The list
          grows well beyond your own services — quick wins are pages you almost rank for; big bets are
          high-value but harder.
        </>
      }
    >
      {/* Confirm all four comprehensive categories (12-02) — services drive scoring. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
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
              onConfirmed={c.key === 'services' ? onServicesConfirmed : undefined}
            />
          </div>
        ))}
      </div>

      {!servicesReady && (
        <ActionCallout variant="info" title="Confirm your services first">
          Review the four lists above (we inferred them from your site — verify before they drive builds).
          Confirming your <strong>services</strong> unlocks the opportunity list.
        </ActionCallout>
      )}

      {servicesReady && !result && (
        <CtaButton
          label={building ? 'Building your list…' : 'Find my opportunities'}
          icon={Target}
          onClick={buildList}
          disabled={building}
          pulse={!building}
        />
      )}

      {building && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="50%" />
        </div>
      )}

      {error && (
        <ActionCallout variant="warning" title="Couldn't build your opportunity list" action={{ label: 'Retry', onClick: buildList }}>
          {error}
        </ActionCallout>
      )}

      {result && total > 0 && (
        <>
          {/* Outcome headline. */}
          <h3 style={{
            margin: '4px 0 16px', fontFamily: t.fontBody, fontSize: 16, fontWeight: 600, color: t.text,
          }}>
            {result.headline || `${total} opportunities found`}
          </h3>

          <StatGrid columns={4}>
            <Stat value={total} label="Opportunities" />
            <Stat value={buckets?.quick_win ?? 0} label="Quick wins" color={t.success} />
            <Stat value={buckets?.net_new ?? 0} label="Net-new" color={t.pink} />
            <Stat value={buckets?.big_bet ?? 0} label="Big bets" color={t.warning} isLast />
          </StatGrid>

          {/* Competitor-derived growth signal — proves the list is competitor-driven. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 18px', flexWrap: 'wrap' }}>
            {competitorDerived > 0 ? (
              <FlagChip variant="high" icon={Target}>
                {competitorDerived} extra {competitorDerived === 1 ? 'opportunity' : 'opportunities'} from competitor keywords
              </FlagChip>
            ) : result.competitor_intel_available === false ? (
              <FlagChip variant="low">
                Competitor intel not run yet — showing your own services. Run step 3 for the extensive list.
              </FlagChip>
            ) : (
              <FlagChip variant="info">Competitor-driven list</FlagChip>
            )}
          </div>

          {/* No-competitor client cities, surfaced with their reason. */}
          {noCompetitorCells.length > 0 && (
            <div style={{
              border: `1px solid ${t.line}`, borderRadius: t.rTile, padding: '14px 16px', marginBottom: 18,
              background: t.white,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <MapPinOff size={15} color={t.muted} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                  Cities you listed with no competitor targeting them
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {noCompetitorCells.slice(0, 12).map((c, i) => (
                  <span key={`${c.city}-${c.service}-${i}`} style={{
                    fontFamily: t.fontMono, fontSize: 12, color: t.muted,
                    border: `1px solid ${t.line}`, borderRadius: t.rPill, padding: '4px 10px',
                  }} title={c.reason}>
                    {c.city}{c.bucket === 'quick_win' ? ' · uncontested win' : ' · low demand'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* The extensive list (top slice as outcomes — larger than the own-only grid). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {items.slice(0, 16).map((c, i) => (
              <div key={`${c.service}-${c.city}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: t.rTile,
                border: `1px solid ${t.line}`, background: t.white,
              }}>
                <FlagChip variant={BUCKET_VARIANT[c.bucket] || 'low'}>{BUCKET_LABEL[c.bucket] || c.bucket}</FlagChip>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                  {c.service} in {c.city}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }} title={c.reason}>
                  {c.reason}
                </span>
              </div>
            ))}
            {total > 16 && (
              <span style={{ fontSize: 12, color: t.muted }}>+ {total - 16} more in your strategy.</span>
            )}
          </div>

          {result?.sources?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <FlagChip variant="info">Live ranking data</FlagChip>
              <span style={{ fontSize: 12, color: t.muted }}>
                Competitor ranks fetched live and timestamped (data integrity).
              </span>
            </div>
          )}

          <CtaButton label="Turn this into a strategy" icon={ArrowRight} onClick={goNext} pulse />
        </>
      )}

      {result && total === 0 && (
        <EmptyState
          icon={Target}
          headline="No gaps found"
          sub="Either you already cover these markets or there isn't enough competitor demand to justify new pages. Try adding more target cities, or run competitor intel on step 3."
          primary={{ label: 'Retry', onClick: buildList }}
        />
      )}
    </StepShell>
  )
}

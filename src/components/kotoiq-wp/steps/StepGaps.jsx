'use client'
// ── Step 4: Your gaps ───────────────────────────────────────────────────────
// The competitor-driven gap report (11-05 score_grid), rendered as OUTCOMES not
// metrics: "38 opportunities — 9 quick wins, 21 net-new, 8 big bets". The user
// first confirms the services we found (11-03 ServiceChips, AI-inferred flagged)
// because confirmed services drive the scoring. Cities a client listed but no
// competitor targets are surfaced with their reason.
//
// The ONE primary action is "Score my gaps" (then, once scored, "See my plan").

import { useState, useCallback } from 'react'
import { Target, ArrowRight, MapPinOff } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, StatGrid, Stat, FlagChip, Skeleton,
} from '../../ui/koto'
import ServiceChips from '../../kotoiq/ServiceChips'
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

export default function StepGaps({
  clientId, agencyId, goNext,
  selectedCities, confirmedServices, setConfirmedServices,
}) {
  const [servicesReady, setServicesReady] = useState(!!confirmedServices)
  const [scoring, setScoring] = useState(false)
  const [result, setResult] = useState(null) // { report, cells, sources, services, state }
  const [error, setError] = useState(null)

  const onServicesConfirmed = useCallback((services) => {
    setConfirmedServices(services)
    setServicesReady(true)
  }, [setConfirmedServices])

  // ONE primary action: score the service×city grid for the chosen cities.
  const scoreGaps = useCallback(async () => {
    setScoring(true); setError(null)
    try {
      const cities = Array.from(selectedCities || [])
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'score_grid',
          client_id: clientId, agency_id: agencyId,
          cities: cities.length ? cities : undefined,
        }),
      })
      const d = await r.json()
      if (!d.ok) { setError(typeof d.error === 'string' ? d.error : 'Could not score your gaps'); return }
      setResult(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setScoring(false)
    }
  }, [clientId, agencyId, selectedCities])

  const report = result?.report
  const cells = result?.cells || []
  // Cities the client listed but no competitor targets — surfaced with reason.
  const noCompetitorCells = cells.filter(c => c.client_listed_city && (c.competitor_count || 0) === 0)

  const status = scoring ? 'running' : report ? 'done' : 'waiting'

  return (
    <StepShell
      stepNumber={4}
      title="Your gaps"
      accent="gaps"
      status={status}
      subtitle="The pages your competitors rank for that you don't have yet — ranked by what'll move traffic fastest. First confirm what you offer, since that drives the scoring."
      noteId="guided-gaps"
      noteTitle="What this does"
      note={
        <>
          We compare your pages to who's ranking in your target cities and score each gap by demand,
          how contested it is, what you already cover, and how hard it is to win. Quick wins are pages
          you almost rank for; big bets are high-value but harder.
        </>
      }
    >
      {/* Confirm services (11-03) — they drive the scoring. */}
      <div style={{
        background: t.off, border: `1px solid ${t.line}`, borderRadius: t.rTile,
        padding: '18px 20px', marginBottom: 20,
      }}>
        <ServiceChips agencyId={agencyId} clientId={clientId} onConfirmed={onServicesConfirmed} />
      </div>

      {!servicesReady && (
        <ActionCallout variant="info" title="Confirm your services first">
          Review the services above (we inferred them from your site — verify before they drive builds),
          then score your gaps.
        </ActionCallout>
      )}

      {servicesReady && !result && (
        <CtaButton
          label={scoring ? 'Scoring your gaps…' : 'Score my gaps'}
          icon={Target}
          onClick={scoreGaps}
          disabled={scoring}
          pulse={!scoring}
        />
      )}

      {scoring && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="50%" />
        </div>
      )}

      {error && (
        <ActionCallout variant="warning" title="Couldn't score your gaps" action={{ label: 'Retry', onClick: scoreGaps }}>
          {error}
        </ActionCallout>
      )}

      {report && (
        <>
          {/* Outcome headline (CONTEXT specifics). */}
          <h3 style={{
            margin: '4px 0 16px', fontFamily: t.fontBody, fontSize: 16, fontWeight: 600, color: t.text,
          }}>
            {report.headline || `${report.total} opportunities found`}
          </h3>

          <StatGrid columns={4}>
            <Stat value={report.total} label="Opportunities" />
            <Stat value={report.quick_wins} label="Quick wins" color={t.success} />
            <Stat value={report.net_new} label="Net-new" color={t.pink} />
            <Stat value={report.big_bets} label="Big bets" color={t.warning} isLast />
          </StatGrid>

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

          {/* Top cells preview as outcomes. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {cells.slice(0, 8).map((c, i) => (
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
          </div>

          {result?.sources?.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <FlagChip variant="info">Live ranking data</FlagChip>
              <span style={{ fontSize: 12, color: t.muted }}>
                Competitor ranks fetched live and timestamped (data integrity).
              </span>
            </div>
          )}

          <CtaButton label="Turn this into a plan" icon={ArrowRight} onClick={goNext} pulse />
        </>
      )}

      {result && report?.total === 0 && (
        <EmptyState
          icon={Target}
          headline="No gaps found"
          sub="Either you already cover these markets or there isn't enough competitor demand to justify new pages. Try adding more target cities."
          primary={{ label: 'Back to cities', onClick: () => {} }}
        />
      )}
    </StepShell>
  )
}

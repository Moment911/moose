'use client'
// ── Step 6: Your strategy (WS7 — Phase 12 / 12-06) ───────────────────────────
// The capstone guided step. Runs the semantic Koto tool (recommend_strategy)
// over the confirmed inputs (step 2) + competitor intel (step 3) + the extensive
// opportunity list (step 4) → a concrete FAST-RANK AI-SEO / GEO / AEO plan:
// topic clusters, a pillar/hub architecture, an internal-linking plan, a schema
// plan, AEO/GEO tactics (citation targets, answer-first pages, llms.txt), and a
// prioritized build order.
//
// Cost control (T-12-24): the Sonnet strategy is BUTTON-TRIGGERED, never on mount.
// AI-unavailable (T-12-22): when the funded ANTHROPIC_API_KEY is missing the
// engine returns ai_available:false — we render a VISIBLE banner (no silent
// swallow). The strategy is clearly AI-GENERATED (flagged) per data-integrity.
//
// Built on the DESIGN.md koto/* primitives + tokens (navy/cream — NOT the
// deferred blazly reskin).

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, ArrowRight, Network, Layers, Link2, Code2, MessageSquareQuote, ListOrdered,
} from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EducationalNote, FlagChip, Skeleton, StatGrid, Stat,
} from '../../ui/koto'
import StepShell from './StepShell'

// A small labelled section card used to group each part of the plan.
function PlanSection({ icon: Icon, title, sub, children }) {
  return (
    <div style={{
      border: `1px solid ${t.line}`, borderRadius: t.rTile, padding: '16px 18px',
      background: t.white, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sub ? 4 : 10 }}>
        {Icon && <Icon size={16} color={t.pink} />}
        <span style={{ fontFamily: t.fontBody, fontSize: 14, fontWeight: 700, color: t.text }}>{title}</span>
      </div>
      {sub && <p style={{ margin: '0 0 12px 26px', fontSize: 12.5, color: t.muted, lineHeight: 1.5 }}>{sub}</p>}
      {children}
    </div>
  )
}

// Human label for a cluster kind (no bare jargon in the rail copy).
const KIND_LABEL = {
  pillar: 'Pillar',
  service_x_city: 'Service × city',
  neighborhood: 'Neighborhood',
  comparison: 'Comparison',
  problem: 'Problem',
  service_areas_hub: 'Hub',
  about: 'About',
}
const INTENT_VARIANT = {
  commercial: 'high', local: 'success', comparison: 'medium', informational: 'info', problem: 'low',
}

export default function StepStrategy({
  clientId, agencyId,
  selectedState, selectedCities,
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)  // { ok, ai_available, reason, strategy, competitor_intel_available }
  const [error, setError] = useState(null)
  // Rehydrate the last generated strategy on mount so re-entering this step
  // shows the full plan instead of the (paid) "Build my strategy" button.
  const [hydrating, setHydrating] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_strategy', client_id: clientId, agency_id: agencyId }),
        })
        const d = await r.json()
        if (!cancelled && d?.strategy) {
          setResult({ ok: true, ai_available: true, strategy: d.strategy, competitor_intel_available: d.competitor_intel_available })
        }
      } catch {
        // Non-blocking — fall back to the run button.
      } finally {
        if (!cancelled) setHydrating(false)
      }
    })()
    return () => { cancelled = true }
  }, [clientId, agencyId])

  // ONE primary action: run the fast-rank strategy synthesis (button-triggered,
  // never on mount — controls Sonnet spend, T-12-24).
  const runStrategy = useCallback(async () => {
    setRunning(true); setError(null)
    try {
      const cities = Array.from(selectedCities || [])
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommend_strategy',
          client_id: clientId, agency_id: agencyId,
          cities: cities.length ? cities : undefined,
          state: selectedState || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok && !d.ai_available && !d.strategy) {
        // Validation / server error (not the graceful ai_unavailable degrade).
        setError(typeof d.error === 'string' ? d.error : 'Could not build your strategy')
        // Still surface the degrade banner if the server reported one.
        if (d.ai_available === false) setResult(d)
        return
      }
      setResult(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setRunning(false)
    }
  }, [clientId, agencyId, selectedCities, selectedState])

  const strategy = result?.strategy
  const aiUnavailable = result && result.ai_available === false
  const status = running ? 'running' : strategy ? 'done' : 'waiting'

  const clusters = strategy?.topic_clusters || []
  const pillars = clusters.filter(c => c.kind === 'pillar' || c.kind === 'service_areas_hub')
  const aeo = strategy?.aeo_strategy || null
  const linking = strategy?.internal_linking_strategy || null
  const schema = strategy?.schema_plan || null
  const attack = strategy?.attack_plan || []
  const enrichment = strategy?.query_enrichment || null

  return (
    <StepShell
      stepNumber={6}
      title="Your strategy"
      accent="strategy"
      status={status}
      subtitle="The semantic Koto tool turns everything we found — your services, your competitors, and the gaps — into a concrete plan to rank your pages as fast as possible across Google, AI Overviews, and answer engines."
      noteId="guided-strategy"
      noteTitle="What this does"
      note={
        <>
          We run a strategy pass over your confirmed services, the competitors already ranking in your
          cities, and the opportunity list. It returns topic clusters, a pillar/hub structure, an
          internal-linking plan, the schema to add, and answer-engine tactics — in the order that ranks
          you fastest. <strong>AEO</strong> = winning AI answers (ChatGPT/Perplexity/Google AI Overviews);
          <strong> GEO</strong> = winning the local map results. The plan is AI-generated — review before building.
        </>
      }
    >
      {/* Brief rehydration shimmer so we don't flash the Build button before the
          saved strategy (if any) loads back in. */}
      {hydrating && !strategy && !running && (
        <Skeleton height={56} width="100%" radius={t.rTile} />
      )}

      {/* Run trigger (button-triggered — never auto-runs the Sonnet pass). */}
      {!hydrating && !strategy && !aiUnavailable && (
        <CtaButton
          label={running ? 'Building your strategy…' : 'Build my fast-rank strategy'}
          icon={Sparkles}
          onClick={runStrategy}
          disabled={running}
          pulse={!running}
        />
      )}

      {running && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={64} width="100%" radius={t.rTile} />
          <Skeleton height={20} width="60%" />
          <Skeleton height={20} width="45%" />
        </div>
      )}

      {/* Visible AI-unavailable signal — never swallow the $0-credit degrade
          (T-12-22, data-integrity standard). */}
      {aiUnavailable && (
        <ActionCallout
          variant="warning"
          title="AI unavailable — strategy can't run yet"
          action={{ label: 'Try again', onClick: runStrategy }}
        >
          The strategy step needs a funded AI key to synthesize your plan. We didn't run it (so nothing
          was charged or guessed). Once the AI key is funded, come back and build your fast-rank strategy here.
        </ActionCallout>
      )}

      {error && !aiUnavailable && (
        <div style={{ marginTop: 16 }}>
          <ActionCallout variant="warning" title="Couldn't build your strategy" action={{ label: 'Retry', onClick: runStrategy }}>
            {error}
          </ActionCallout>
        </div>
      )}

      {strategy && (
        <>
          {/* AI-generated provenance flag (data-integrity — strategy is not verified fact). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 18px', flexWrap: 'wrap' }}>
            <FlagChip variant="info" icon={Sparkles}>AI-generated plan · review before building</FlagChip>
            {result?.competitor_intel_available
              ? <FlagChip variant="success">Built from live competitor intel</FlagChip>
              : <FlagChip variant="low">No competitor intel yet — run step 3 for a sharper plan</FlagChip>}
            {strategy?.plan_id && (
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.faint }}>
                saved as plan {String(strategy.plan_id).slice(0, 8)}
              </span>
            )}
          </div>

          {/* Headline counts. */}
          <StatGrid columns={4}>
            <Stat value={clusters.length} label="Pages to build" />
            <Stat value={pillars.length} label="Pillar / hub pages" color={t.pink} />
            <Stat value={(aeo?.answer_format_pages || []).length} label="Answer-engine pages" color={t.success} />
            <Stat value={attack.length} label="Build phases" color={t.warning} isLast />
          </StatGrid>

          {/* URL architecture + topic clusters. */}
          <PlanSection icon={Layers} title="Topic clusters & page architecture" sub={strategy?.url_structure?.pattern ? `URL pattern: ${strategy.url_structure.pattern}` : undefined}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clusters.slice(0, 12).map((c, i) => (
                <div key={`${c.url}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  borderRadius: t.rTile, border: `1px solid ${t.line}`, background: t.off,
                }}>
                  <FlagChip variant={INTENT_VARIANT[c.search_intent] || 'low'}>{KIND_LABEL[c.kind] || c.kind}</FlagChip>
                  <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{c.title || c.target_query}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 11, color: t.muted }}>{c.url}</span>
                </div>
              ))}
              {clusters.length > 12 && (
                <span style={{ fontSize: 12, color: t.muted }}>+ {clusters.length - 12} more in the saved plan.</span>
              )}
            </div>
          </PlanSection>

          {/* Internal-linking / hub-and-spoke. */}
          {linking && (
            <PlanSection icon={Link2} title="Internal linking (pillar & hub)">
              <p style={{ margin: 0, fontSize: 13, color: t.text, lineHeight: 1.6 }}>
                {linking.hub_and_spoke}
              </p>
              {(linking.cross_links || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {linking.cross_links.slice(0, 6).map((x, i) => (
                    <span key={i} style={{
                      fontFamily: t.fontMono, fontSize: 11, color: t.muted,
                      border: `1px solid ${t.line}`, borderRadius: t.rPill, padding: '4px 10px',
                    }} title={x.anchor_strategy}>
                      {x.from_pattern} → {x.to_pattern}
                    </span>
                  ))}
                </div>
              )}
            </PlanSection>
          )}

          {/* Schema plan. */}
          {schema && (
            <PlanSection icon={Code2} title="Schema to add" sub={schema.notes}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[...(schema.site_wide || []), ...(schema.service_pages || []), ...(schema.city_pages || [])]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .slice(0, 16)
                  .map((sch, i) => (
                    <FlagChip key={`${sch}-${i}`} variant="info">{sch}</FlagChip>
                  ))}
              </div>
            </PlanSection>
          )}

          {/* AEO / GEO tactics — citation targets, answer-first pages, llms.txt. */}
          {aeo && (
            <PlanSection icon={MessageSquareQuote} title="Answer-engine tactics (AEO / GEO)">
              {aeo.structured_answers && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: t.text, lineHeight: 1.6 }}>{aeo.structured_answers}</p>
              )}
              {aeo.citation_strategy && (
                <p style={{ margin: '0 0 12px', fontSize: 12.5, color: t.muted, lineHeight: 1.55 }}>
                  <strong style={{ color: t.text }}>Citation targets:</strong> {aeo.citation_strategy}
                </p>
              )}
              {(aeo.target_entities || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {aeo.target_entities.slice(0, 14).map((ent, i) => (
                    <span key={`${ent}-${i}`} style={{
                      fontSize: 12, color: t.text, fontWeight: 500,
                      background: t.infoBg, border: `1px solid ${t.infoLine}`,
                      borderRadius: t.rPill, padding: '4px 12px',
                    }}>{ent}</span>
                  ))}
                </div>
              )}
            </PlanSection>
          )}

          {/* Optional semantic query-network enrichment of the top cluster. */}
          {enrichment && (
            <PlanSection icon={Network} title="Query network (top cluster)" sub={enrichment.primary_angle}>
              {(enrichment.query_network || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {enrichment.query_network.slice(0, 16).map((q, i) => (
                    <span key={`${q}-${i}`} style={{
                      fontFamily: t.fontMono, fontSize: 11, color: t.muted,
                      border: `1px solid ${t.line}`, borderRadius: t.rPill, padding: '4px 10px',
                    }}>{q}</span>
                  ))}
                </div>
              )}
            </PlanSection>
          )}

          {/* Prioritized build order. */}
          {attack.length > 0 && (
            <PlanSection icon={ListOrdered} title="Build order (fastest-ranking first)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attack.map((ph, i) => (
                  <div key={`${ph.phase}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: t.rTile, border: `1px solid ${t.line}`, background: t.off,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: t.rPill, background: t.navy, color: t.warm,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{ph.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }}>
                      {(ph.pages || []).length} pages · {ph.weeks}w
                    </span>
                  </div>
                ))}
              </div>
            </PlanSection>
          )}

          <EducationalNote noteId="guided-strategy-next" title="What happens next">
            This plan is saved to your Page Factory queue. Move to <strong>Your plan</strong> to review the
            ranked build order and start publishing — every suggested page is checked against your existing
            site first, so we only build what's missing.
          </EducationalNote>
        </>
      )}
    </StepShell>
  )
}

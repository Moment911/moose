'use client'
// ── Step 5: Your plan ───────────────────────────────────────────────────────
// The ranked build order (11-05 scored suggestions), shown as outcomes, with
// the ONE primary action being "Build these pages" — which hands off to the
// Page Factory where the operator APPROVES each build (the approval gate is
// preserved; nothing auto-publishes). Auto-internal-linking happens on build via
// 11-05's computeInternalLinks.

import { useState, useEffect, useCallback } from 'react'
import { ListChecks, Hammer, ArrowRight } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import {
  CtaButton, ActionCallout, EmptyState, StatGrid, Stat, FlagChip, Skeleton, NextStepLink,
} from '../../ui/koto'
import StepShell from './StepShell'

const BUCKET_LABEL = {
  quick_win: 'Quick win', net_new: 'Net-new', big_bet: 'Big bet',
  low_demand_deprioritize: 'Low demand', unscored: 'Unscored',
}
const BUCKET_VARIANT = {
  quick_win: 'success', net_new: 'high', big_bet: 'medium',
  low_demand_deprioritize: 'low', unscored: 'low',
}

export default function StepPlan({ clientId, agencyId, goNext }) {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null) // { total, by_bucket, order[] }
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_build_order', client_id: clientId, agency_id: agencyId }),
      })
      const d = await r.json()
      if (!d.ok) { setError(typeof d.error === 'string' ? d.error : 'Could not load your plan'); return }
      setPlan(d)
    } catch (e) {
      setError(e?.message || 'Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [clientId, agencyId])

  useEffect(() => { load() }, [load])

  const total = plan?.total || 0
  const order = plan?.order || []
  const byBucket = plan?.by_bucket || {}
  const status = loading ? 'running' : total > 0 ? 'waiting' : 'waiting'

  return (
    <StepShell
      stepNumber={5}
      title="Your plan"
      accent="plan"
      status={status}
      subtitle="Your gaps, turned into a ranked build order. Build them in the Page Factory — you review and approve every page before anything goes live."
      noteId="guided-plan"
      noteTitle="What this does"
      note={
        <>
          We line up the pages worth building, best opportunity first. Building a page also wires it into
          your site's internal links automatically. Nothing publishes on its own — you approve each page in
          the Page Factory.
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
        <ActionCallout variant="warning" title="Couldn't load your plan" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {!loading && !error && total === 0 && (
        <EmptyState
          icon={ListChecks}
          headline="No build order yet"
          sub="Score your gaps on the previous step to generate a ranked build order, then come back here."
          secondary={{ label: 'Back to gaps', onClick: () => {} }}
        />
      )}

      {!loading && !error && total > 0 && (
        <>
          <StatGrid columns={4}>
            <Stat value={total} label="Pages in plan" />
            <Stat value={byBucket.quick_win || 0} label="Quick wins" color={t.success} />
            <Stat value={byBucket.net_new || 0} label="Net-new" color={t.pink} />
            <Stat value={byBucket.big_bet || 0} label="Big bets" color={t.warning} isLast />
          </StatGrid>

          {/* Ranked order preview. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {order.slice(0, 10).map((p, i) => (
              <div key={p.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: t.rTile,
                border: `1px solid ${t.line}`, background: t.white,
              }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.muted, width: 22 }}>{i + 1}</span>
                <FlagChip variant={BUCKET_VARIANT[p.bucket] || 'low'}>{BUCKET_LABEL[p.bucket] || p.bucket}</FlagChip>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{p.service} in {p.city}</span>
                {p.reason && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }} title={p.reason}>
                    {p.reason}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FlagChip variant="medium" icon={Hammer}>Approval required</FlagChip>
            <span style={{ fontSize: 12, color: t.muted }}>
              You review and approve every page in the Page Factory before it publishes.
            </span>
          </div>

          {/* ONE primary action → the gated Page Factory build flow. */}
          <CtaButton
            label={`Build these ${total} pages in Page Factory`}
            icon={Hammer}
            href="/kotoiq-wp?shell=publish&sub=factory"
            pulse
          />

          <div style={{ marginTop: 16 }}>
            <NextStepLink onClick={goNext}>check what's live + cited</NextStepLink>
          </div>
        </>
      )}
    </StepShell>
  )
}

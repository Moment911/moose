'use client'
// ── SynergySuggestions ─────────────────────────────────────────────────────
// Phase 12 Plan 12-03 (WS3) — accept-able synergy suggestion chips.
//
// A Sonnet pass (recommend_synergies action) over the client's CONFIRMED
// services/offerings + industry/business context recommends COMPLEMENTARY /
// SYNERGISTIC services and products. These are SUGGESTIONS the user can promote
// into their category lists — they are NOT the client's confirmed inputs, so they
// render in a DISTINCT visual state (dashed violet "suggested" chips) clearly
// separate from the solid confirmed chips in CategoryChips.
//
// Behavior:
//  - The fetch is BUTTON-TRIGGERED, not on-mount (T-12-10: Sonnet costs money —
//    don't fire on every render).
//  - synergistic_services render with category 'services'; complementary_products
//    with category 'offerings'.
//  - Each chip shows its one-line rationale (subtext under the name).
//  - "Accept" on a chip PROMOTES it: POST save_field { category, items:[{ name,
//    user_added:true, confidence:1.0 }] } (the 12-01 persistence). The accepted
//    chip flips to an accepted state and onAccepted(category, name) fires so the
//    parent can refresh its confirmed CategoryChips.
//  - When ai_available:false (the $0-credit / absent Sonnet key), a VISIBLE "AI
//    unavailable" notice renders — never a silent swallow (T-12-11, data-integrity).
//
// Built only on the DESIGN.md koto/* primitives + tokens (navy/cream — NOT the
// deferred blazly reskin). Reference: CategoryChips.jsx / AEOVisibilityTab.jsx.

import { useState, useCallback } from 'react'
import { Sparkles, Check, Plus, Lightbulb } from 'lucide-react'
import { t } from '../../styles/koto-tokens'
import {
  SectionHeader,
  EducationalNote,
  ActionCallout,
  CtaButton,
  Skeleton,
  KotoKeyframes,
} from '../ui/koto'

// The distinct "suggested, not yet yours" palette — violet, deliberately NOT the
// confirmed pink (CategoryChips user chips) nor the AI-inference blue. A DASHED
// border reinforces "this is a suggestion you can accept".
const VIOLET = '#7c3aed'
const VIOLET_BG = 'rgba(124, 58, 237, .07)'
const VIOLET_LINE = 'rgba(124, 58, 237, .35)'

// One synergy suggestion chip. Distinct dashed-violet state; shows the rationale.
function SuggestionChip({ name, rationale, accepted, busy, onAccept }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '10px 12px', borderRadius: t.rTile,
        background: accepted ? t.successBg : VIOLET_BG,
        border: accepted
          ? `1px solid ${t.successLine}`
          : `1px dashed ${VIOLET_LINE}`,
        minWidth: 200, maxWidth: 320, flex: '1 1 240px',
        fontFamily: t.fontBody,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: t.text }}>
          {accepted
            ? <Check size={13} style={{ color: t.success }} />
            : <Sparkles size={12} style={{ color: VIOLET }} />}
          {name}
        </span>
        {accepted ? (
          <span
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
              color: t.success, background: 'rgba(13,158,110,.12)',
              padding: '2px 8px', borderRadius: t.rPill, whiteSpace: 'nowrap',
            }}
          >
            Added
          </span>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            title={`Add "${name}" to your list`}
            aria-label={`Accept ${name}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: t.rPill, border: `1px solid ${VIOLET_LINE}`,
              background: t.white, color: VIOLET,
              fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
              letterSpacing: '.04em', textTransform: 'uppercase',
              cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Plus size={11} /> Accept
          </button>
        )}
      </div>
      {rationale && (
        <span style={{ fontSize: 12, color: t.muted, lineHeight: 1.45 }}>{rationale}</span>
      )}
    </div>
  )
}

// One labeled group of suggestion chips (services or products).
function SuggestionGroup({ heading, items, category, busyKey, acceptedKeys, onAccept }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8,
        fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
        letterSpacing: '.14em', textTransform: 'uppercase', color: t.muted,
      }}>
        <Lightbulb size={12} style={{ color: VIOLET }} />
        {heading}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {items.map((it) => {
          const key = `${category}:${it.name.toLowerCase()}`
          return (
            <SuggestionChip
              key={key}
              name={it.name}
              rationale={it.rationale}
              accepted={acceptedKeys.has(key)}
              busy={busyKey === key}
              onAccept={() => onAccept(category, it)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function SynergySuggestions({ agencyId, clientId, onAccepted }) {
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [error, setError] = useState(null)
  const [aiAvailable, setAiAvailable] = useState(true)
  const [reason, setReason] = useState(null)
  const [services, setServices] = useState([])    // [{ name, rationale }]
  const [products, setProducts] = useState([])    // [{ name, rationale }]
  const [acceptedKeys, setAcceptedKeys] = useState(() => new Set())
  const [busyKey, setBusyKey] = useState(null)

  // Button-triggered fetch (NOT on-mount) to control Sonnet spend (T-12-10).
  const loadSynergies = useCallback(async () => {
    if (!agencyId || !clientId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recommend_synergies', agency_id: agencyId, client_id: clientId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'recommend_synergies failed')
      setServices(Array.isArray(d.synergistic_services) ? d.synergistic_services : [])
      setProducts(Array.isArray(d.complementary_products) ? d.complementary_products : [])
      // ai_available:false flips the visible banner (never a silent degrade).
      setAiAvailable(d.ai_available !== false)
      setReason(d.reason || null)
      setFetched(true)
    } catch (e) {
      setError(e?.message || 'Could not load suggestions')
    } finally {
      setLoading(false)
    }
  }, [agencyId, clientId])

  // Accept a suggestion → promote it via save_field as user_added (12-01 path).
  const accept = useCallback(async (category, item) => {
    if (!agencyId || !clientId) return
    const key = `${category}:${item.name.toLowerCase()}`
    setBusyKey(key)
    setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_field',
          agency_id: agencyId,
          client_id: clientId,
          category,
          items: [{ name: item.name, user_added: true, confidence: 1.0 }],
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d?.error || 'Could not accept suggestion')
      setAcceptedKeys((cur) => {
        const next = new Set(cur)
        next.add(key)
        return next
      })
      if (typeof onAccepted === 'function') onAccepted(category, item.name)
    } catch (e) {
      setError(e?.message || 'Could not accept suggestion')
    } finally {
      setBusyKey(null)
    }
  }, [agencyId, clientId, onAccepted])

  const hasAny = services.length > 0 || products.length > 0

  return (
    <div style={{ fontFamily: t.fontBody, color: t.text }}>
      <KotoKeyframes />
      <SectionHeader
        icon={Sparkles}
        title="Synergistic recommendations"
        rationale="Based on what you confirmed, here are complementary services and products to consider adding. These are suggestions — accept the ones that fit and they join your lists."
      />

      <EducationalNote noteId="kotoiq_synergy_suggestions" title="Why this matters">
        Customers who hire you for one thing usually need adjacent work too. These
        ideas come from your confirmed services and offerings — accept what makes
        sense and it gets added as <strong>your</strong> service or product.
      </EducationalNote>

      {/* Visible AI-unavailable signal — never swallow the $0-credit degrade
          (T-12-11, data-integrity standard). */}
      {fetched && !aiAvailable && (
        <ActionCallout variant="warning" title="AI unavailable — no suggestions">
          We couldn't reach the AI strategist{reason ? ` (${reason})` : ''}, so there
          are no synergy suggestions right now. Your confirmed services and offerings
          are unaffected. Try again once the AI connection is restored.
        </ActionCallout>
      )}

      {error && (
        <ActionCallout variant="warning" title="Something went wrong" action={{ label: 'Retry', onClick: loadSynergies }}>
          {error}
        </ActionCallout>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
          {[220, 200, 240, 210].map((w, i) => <Skeleton key={i} width={w} height={62} radius={t.rTile} />)}
        </div>
      ) : (
        <>
          {fetched && aiAvailable && !hasAny && (
            <ActionCallout variant="info" title="No suggestions yet">
              We didn't find complementary services or products to suggest. Confirm
              more of your services and offerings first, then run this again.
            </ActionCallout>
          )}

          <SuggestionGroup
            heading="Services to consider adding"
            items={services}
            category="services"
            busyKey={busyKey}
            acceptedKeys={acceptedKeys}
            onAccept={accept}
          />
          <SuggestionGroup
            heading="Products & packages to consider"
            items={products}
            category="offerings"
            busyKey={busyKey}
            acceptedKeys={acceptedKeys}
            onAccept={accept}
          />

          {/* Single primary action — button-triggered to control Sonnet spend. */}
          <div style={{ marginTop: 20 }}>
            <CtaButton
              label={fetched ? 'Refresh suggestions' : 'Recommend synergies'}
              icon={Sparkles}
              onClick={loadSynergies}
              disabled={loading || !agencyId || !clientId}
              pulse={!fetched}
            />
          </div>
        </>
      )}
    </div>
  )
}

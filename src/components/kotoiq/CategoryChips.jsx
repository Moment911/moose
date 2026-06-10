'use client'
// ── CategoryChips ──────────────────────────────────────────────────────────
// Phase 12 Plan 12-02 (WS2 + WS4) — category-parameterized editable chips.
//
// Generalizes ServiceChips into a single component that renders editable,
// AI-flagged chips for ANY of the four comprehensive categories
// (keywords / phrases / services / offerings). It is the chip group the
// guided steps (12-06) hydrate four times from ONE extract_comprehensive call.
//
// Behavior carried over from ServiceChips UNCHANGED:
//  - AI-inferred chips render an "AI" badge (info/violet) so the user knows to
//    verify them before they drive builds (data-integrity standard, T-12-06).
//  - The user can select/remove any chip and add a custom one. A manually added
//    chip is source_type: user_added, confidence 1.0 (WS4 manual entry).
//  - A single primary "Confirm" action POSTs the save action with provenance
//    (user_added / user_confirmed / ai_inferred).
//
// New in 12-02:
//  - `category` drives both the read shape (d[category]) and the save payload
//    ({ category, items } → save_field, the 12-01 category-aware persistence).
//  - `seedItems` lets a parent hydrate from one extract_comprehensive call and
//    pass d[category] down, avoiding four round-trips.
//  - When the source reports ai_available:false (e.g. the $0-credit Claude key),
//    a VISIBLE "AI unavailable — showing heuristic suggestions" notice renders
//    instead of silently swallowing the degrade (T-12-08, data-integrity).
//
// Built on the DESIGN.md koto/* primitives + tokens (navy/cream — NOT the
// deferred blazly reskin). Reference: AEOVisibilityTab.jsx / ServiceChips.jsx.

import { useState, useEffect, useCallback } from 'react'
import { Tag, Sparkles, Plus, X, Check } from 'lucide-react'
import { t } from '../../styles/koto-tokens'
import {
  SectionHeader,
  EducationalNote,
  ActionCallout,
  CtaButton,
  FlagChip,
  Skeleton,
  KotoKeyframes,
} from '../ui/koto'

const VALID_CATEGORIES = ['keywords', 'phrases', 'services', 'offerings']

// AI-inferred badge — DESIGN.md Pattern 8, info/violet variant. Signals
// "verify me" on any machine-inferred chip (data-integrity standard, T-12-06).
function AiBadge() {
  return (
    <span
      title="Inferred by AI from your site — verify before it drives builds"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 6px', borderRadius: t.rPill,
        background: t.infoBg, color: t.info,
        fontFamily: t.fontBody, fontSize: 9, fontWeight: 800,
        letterSpacing: '.08em', textTransform: 'uppercase',
      }}
    >
      <Sparkles size={9} />
      AI
    </span>
  )
}

// One editable chip. `kind` ∈ ai_inferred | user_confirmed | user_added.
function CategoryChip({ name, kind, onRemove }) {
  const isAi = kind === 'ai_inferred'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 8px 6px 14px', borderRadius: t.rPill,
        background: isAi ? t.infoBg : t.pinkSoft,
        border: `1px solid ${isAi ? t.infoLine : 'rgba(203,28,107,.25)'}`,
        fontFamily: t.fontBody, fontSize: 13, fontWeight: 600, color: t.text,
      }}
    >
      {name}
      {isAi && <AiBadge />}
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        aria-label={`Remove ${name}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: t.rPill, border: 'none',
          background: 'transparent', color: t.muted, cursor: 'pointer', padding: 0,
        }}
      >
        <X size={13} />
      </button>
    </span>
  )
}

// Normalize a stored category record (12-01 StoredServiceRecord shape:
// { value, source_type, confidence, source_url, captured_at }) OR the older
// infer_services service shape ({ name, provenance:{...} }) into a chip.
function recordToChip(rec) {
  if (!rec) return null
  const name = rec.value ?? rec.name
  if (!name) return null
  const sourceType = rec.source_type ?? (rec.provenance?.source_type)
  return {
    name,
    // Anything the user already confirmed stays confirmed (non-AI styling);
    // everything else from the source is machine-inferred → flagged.
    kind: sourceType === 'user_added' || sourceType === 'user_confirmed'
      ? sourceType
      : 'ai_inferred',
    source_url: rec.source_url ?? rec.provenance?.source_url,
    confidence: rec.confidence ?? rec.provenance?.confidence,
  }
}

export default function CategoryChips({
  agencyId,
  clientId,
  category = 'services',
  title,
  subtitle,
  icon: Icon = Tag,
  placeholder = 'Add an item…',
  seedItems = null,         // optional pre-fetched list (parent fetched extract_comprehensive once)
  inferAction = 'extract_comprehensive',
  saveAction = 'save_field',
  onConfirmed,
}) {
  const [loading, setLoading] = useState(seedItems == null)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)
  const [aiAvailable, setAiAvailable] = useState(true)
  const [baselinePages, setBaselinePages] = useState(0)
  const [chips, setChips] = useState([]) // { name, kind, source_url?, confidence? }
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Pull a category list out of an extract_comprehensive / infer_services
  // response. extract_comprehensive returns d[category]; infer_services (the
  // services back-compat path) returns d.services.
  const readCategoryList = useCallback((d) => {
    const list = Array.isArray(d?.[category]) ? d[category]
      : Array.isArray(d?.services) ? d.services
        : []
    return list.map(recordToChip).filter(Boolean)
  }, [category])

  const load = useCallback(async () => {
    if (!agencyId || !clientId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: inferAction, agency_id: agencyId, client_id: clientId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || `${inferAction} failed`)
      setChips(readCategoryList(d))
      setSource(d.source || null)
      // ai_available defaults to true when the action doesn't report it
      // (e.g. infer_services). Only an explicit false flips the banner.
      setAiAvailable(d.ai_available !== false)
      setBaselinePages(d.baseline_pages || d.pages || 0)
    } catch (e) {
      setError(e?.message || 'Could not load items')
    } finally {
      setLoading(false)
    }
  }, [agencyId, clientId, inferAction, readCategoryList])

  // Hydrate from the seedItems prop when provided (parent fetched once for all
  // four categories); otherwise fetch per-category. Effect only syncs the
  // external source → local chips, never derives during render.
  useEffect(() => {
    if (seedItems == null) {
      load()
      return
    }
    // seedItems may be the raw category array OR the full response object.
    const list = Array.isArray(seedItems) ? seedItems : readCategoryList(seedItems)
    const mapped = Array.isArray(seedItems)
      ? seedItems.map(recordToChip).filter(Boolean)
      : list
    setChips(mapped)
    if (!Array.isArray(seedItems)) {
      setSource(seedItems?.source || null)
      setAiAvailable(seedItems?.ai_available !== false)
      setBaselinePages(seedItems?.baseline_pages || seedItems?.pages || 0)
    }
    setLoading(false)
  }, [seedItems, load, readCategoryList])

  const removeChip = (name) => {
    setChips((cur) => cur.filter((c) => c.name !== name))
    setSaved(false)
  }

  const addChip = () => {
    const name = draft.trim()
    if (!name) return
    const exists = chips.some((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      // WS4 manual entry: a hand-added item is user_added, confidence 1.0.
      setChips((cur) => [...cur, { name, kind: 'user_added', confidence: 1.0 }])
      setSaved(false)
    }
    setDraft('')
  }

  const confirm = async () => {
    if (!agencyId || !clientId || chips.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const items = chips.map((c) => ({
        name: c.name,
        // A chip the user added by hand is user_added; an AI chip they LEFT in
        // place is treated as user_confirmed (they verified it by confirming);
        // confidence/source_url preserved for provenance.
        user_added: c.kind === 'user_added',
        user_edited: c.kind !== 'user_added',
        source_url: c.source_url,
        confidence: c.confidence,
      }))
      // save_field is category-aware (12-01); the services back-compat path
      // uses save_services with a `services` payload key.
      const body = saveAction === 'save_field'
        ? { action: saveAction, agency_id: agencyId, client_id: clientId, category, items }
        : { action: saveAction, agency_id: agencyId, client_id: clientId, services: items }
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d?.error || `${saveAction} failed`)
      setSaved(true)
      if (typeof onConfirmed === 'function') onConfirmed(chips.map((c) => c.name))
    } catch (e) {
      setError(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const aiCount = chips.filter((c) => c.kind === 'ai_inferred').length
  const label = title || `Your ${category}`
  const rationale = subtitle
    || 'We read your own pages and inferred these. Edit them — they drive your content gaps and build order, so they need to be right.'
  const validCategory = VALID_CATEGORIES.includes(category)

  return (
    <div style={{ fontFamily: t.fontBody, color: t.text }}>
      <KotoKeyframes />
      <SectionHeader
        icon={Icon}
        title={label}
        accent="confirmed"
        rationale={rationale}
      />

      <EducationalNote noteId={`kotoiq_category_chips_${category}`} title="Why this matters">
        These come straight from your scanned site, not a generic list. Anything
        tagged <strong>AI</strong> was inferred — remove what is wrong, add what is
        missing, then confirm. Only confirmed items feed your strategy.
      </EducationalNote>

      {!validCategory && (
        <ActionCallout variant="warning" title="Unknown category">
          "{category}" is not one of keywords, phrases, services, or offerings.
        </ActionCallout>
      )}

      {/* Visible AI-unavailable signal — never swallow the $0-credit degrade
          (T-12-08, data-integrity standard). */}
      {!aiAvailable && (
        <ActionCallout variant="warning" title="AI unavailable — showing heuristic suggestions">
          We couldn't reach the AI extractor, so these are best-effort guesses from
          your page text. Review them closely and add anything missing before you confirm.
        </ActionCallout>
      )}

      {error && (
        <ActionCallout variant="warning" title="Couldn't load items" action={{ label: 'Retry', onClick: load }}>
          {error}
        </ActionCallout>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          {[110, 90, 130, 80].map((w, i) => <Skeleton key={i} width={w} height={32} radius={t.rPill} />)}
        </div>
      ) : (
        <>
          {chips.length === 0 ? (
            <ActionCallout variant="info" title={`No ${category} yet`}>
              {baselinePages > 0
                ? `We scanned your site but could not infer ${category} automatically. Add them below.`
                : 'Your site baseline has not been captured yet. Add items below to get started.'}
            </ActionCallout>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
              {chips.map((c) => (
                <CategoryChip key={c.name} name={c.name} kind={c.kind} onRemove={() => removeChip(c.name)} />
              ))}
            </div>
          )}

          {/* Add-an-item input (WS4 manual entry) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 16 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
              placeholder={placeholder}
              style={{
                flex: '0 1 260px', padding: '8px 12px', borderRadius: t.rInput,
                border: `1px solid ${t.line}`, background: t.off,
                fontFamily: t.fontBody, fontSize: 13, color: t.text, outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addChip}
              disabled={!draft.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: t.rPill,
                border: `1px solid ${t.line}`, background: t.white,
                fontFamily: t.fontBody, fontSize: 12, fontWeight: 700,
                letterSpacing: '.04em', textTransform: 'uppercase',
                color: draft.trim() ? t.text : t.faint,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {/* Provenance summary + single primary action (one CTA) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {aiCount > 0 && (
              <FlagChip variant="info" icon={Sparkles}>{aiCount} AI-inferred · verify</FlagChip>
            )}
            <CtaButton
              label={saved ? 'Confirmed' : `Confirm ${category}`}
              icon={saved ? Check : undefined}
              onClick={confirm}
              disabled={saving || chips.length === 0}
              pulse={!saved && chips.length > 0}
            />
            {source && (
              <span style={{ fontSize: 11, color: t.faint, fontFamily: t.fontMono }}>
                inferred via {source}{baselinePages ? ` · ${baselinePages} pages` : ''}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

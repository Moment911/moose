'use client'
// ── ServiceChips ───────────────────────────────────────────────────────────
// Phase 11 Plan 11-03 (WS3) — editable, AI-inferred service chips.
//
// On mount this calls infer_services and pre-seeds editable add/remove chips
// from the client's OWN scanned pages (kotoiq_site_baseline). AI-inferred chips
// render an "AI-inferred" badge (info/violet variant) so the user knows to
// verify them before they drive any builds (data-integrity standard). The user
// can remove a chip, add a chip (marked user-added), and a single primary
// "Confirm services" action POSTs save_services with provenance.
//
// Optional per-service target phrases load via derive_phrases (manual add too).
//
// Built on the DESIGN.md koto/* primitives + tokens (NOT the legacy
// src/lib/theme #111/FH/FB tokens — Pitfall 6). Reference: AEOVisibilityTab.jsx.
// This component replaces the manual comma-separated services box in
// PageSuggestionsTab's flow and is consumed by the 11-06 guided shell.

import { useState, useEffect, useCallback } from 'react'
import { Wrench, Sparkles, Plus, X, Check } from 'lucide-react'
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

// AI-inferred badge — DESIGN.md Pattern 8, info/violet variant (mirrors the
// AEOVisibilityTab "AI" chip for ai-seeded rows). Signals "verify me".
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
function ServiceChip({ name, kind, onRemove }) {
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

export default function ServiceChips({ agencyId, clientId, onConfirmed }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)
  const [baselinePages, setBaselinePages] = useState(0)
  const [chips, setChips] = useState([]) // { name, kind, source_url?, confidence? }
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!agencyId || !clientId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'infer_services', agency_id: agencyId, client_id: clientId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'infer_services failed')
      const inferred = Array.isArray(d.services) ? d.services : []
      setChips(inferred.map((sv) => ({
        name: sv.name,
        kind: 'ai_inferred',
        source_url: sv.provenance?.source_url,
        confidence: sv.provenance?.confidence,
      })))
      setSource(d.source || null)
      setBaselinePages(d.baseline_pages || 0)
    } catch (e) {
      setError(e?.message || 'Could not load services')
    } finally {
      setLoading(false)
    }
  }, [agencyId, clientId])

  useEffect(() => { load() }, [load])

  const removeChip = (name) => {
    setChips((cur) => cur.filter((c) => c.name !== name))
    setSaved(false)
  }

  const addChip = () => {
    const name = draft.trim()
    if (!name) return
    const exists = chips.some((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
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
      const services = chips.map((c) => ({
        name: c.name,
        // A chip the user added by hand is user_added; an AI chip they LEFT in
        // place is treated as user_confirmed (they verified it by confirming);
        // confidence/source_url preserved for provenance.
        user_added: c.kind === 'user_added',
        user_edited: c.kind !== 'user_added',
        source_url: c.source_url,
        confidence: c.confidence,
      }))
      const r = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_services', agency_id: agencyId, client_id: clientId, services }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d?.error || 'save_services failed')
      setSaved(true)
      if (typeof onConfirmed === 'function') onConfirmed(chips.map((c) => c.name))
    } catch (e) {
      setError(e?.message || 'Could not save services')
    } finally {
      setSaving(false)
    }
  }

  const aiCount = chips.filter((c) => c.kind === 'ai_inferred').length

  return (
    <div style={{ fontFamily: t.fontBody, color: t.text }}>
      <KotoKeyframes />
      <SectionHeader
        icon={Wrench}
        title="Your services"
        accent="confirmed"
        rationale="We read your own pages and inferred the services you offer. Edit them — these drive your content gaps and build order, so they need to be right."
      />

      <EducationalNote noteId="kotoiq_service_chips" title="Why this matters">
        These come straight from your scanned site, not a generic list. Anything
        tagged <strong>AI</strong> was inferred — remove what is wrong, add what is
        missing, then confirm. Only confirmed services feed your gap grid.
      </EducationalNote>

      {error && (
        <ActionCallout variant="warning" title="Couldn't load services" action={{ label: 'Retry', onClick: load }}>
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
            <ActionCallout variant="info" title="No services inferred yet">
              {baselinePages > 0
                ? 'We scanned your site but could not infer services automatically. Add them below.'
                : 'Your site baseline has not been captured yet. Add your services below to get started.'}
            </ActionCallout>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
              {chips.map((c) => (
                <ServiceChip key={c.name} name={c.name} kind={c.kind} onRemove={() => removeChip(c.name)} />
              ))}
            </div>
          )}

          {/* Add-a-service input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 16 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
              placeholder="Add a service…"
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

          {/* Provenance summary + single primary action (WS7 spine: one CTA) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {aiCount > 0 && (
              <FlagChip variant="info" icon={Sparkles}>{aiCount} AI-inferred · verify</FlagChip>
            )}
            <CtaButton
              label={saved ? 'Services confirmed' : 'Confirm services'}
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

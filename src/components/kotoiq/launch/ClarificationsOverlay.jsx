"use client"
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { profileFetch } from '../../../lib/kotoiqProfileFetch'
import HotspotDot from './HotspotDot'
import ClarificationCard from './ClarificationCard'

/**
 * UI-SPEC §5.11 + §5.8c — in-context hotspots + inline callouts.
 *
 * Mounts HotspotDots over editable spans on the briefing canvas, anchored to
 * any element with a `data-field-path` attribute that matches an open
 * kotoiq_clarifications row's `target_field_path`. Clicking a dot opens the
 * ClarificationCard inline (rendered as a portal positioned just below the
 * paragraph that contains the matching span).
 *
 * Realtime subscription on kotoiq_clarifications keeps the overlay live —
 * new HIGH-severity inserts also trigger a 12s modal escalation sheet
 * bottom-right (UI-SPEC §5.9 / D-20).
 *
 * WR-08 — kotoiq_clarifications RLS is currently `USING (true) WITH CHECK
 * (true)` (per 20260507 migration line 171-172), which permits any reader.
 * Service-role-only is enforced by app convention, NOT by RLS.  We
 * therefore include both client_id AND agency_id in the realtime channel
 * filter so a malicious browser cannot subscribe to a different agency's
 * clarifications stream by enumerating clientId values.  Once RLS is
 * tightened to JWT-aware predicates, the agency_id filter becomes
 * redundant but harmless.
 *
 * Props:
 *   clientId    — used as the realtime channel filter
 *   agencyId    — REQUIRED for the realtime channel filter (WR-08).  The
 *                 component still never sends agency_id in any HTTP body
 *                 (the route derives it from session).
 *   onAnswer(id, text)   — wired by LaunchPage to /api/kotoiq/profile
 *   onForward(id, ch?)   — wired by LaunchPage to /api/kotoiq/profile
 *   onSkip(id)           — wired by LaunchPage to /api/kotoiq/profile
 */
export default function ClarificationsOverlay({ clientId, agencyId, onAnswer, onForward, onSkip }) {
  const [clarifications, setClarifications] = useState([])
  const [modalTarget, setModalTarget] = useState(null)   // 12s HIGH-severity sheet
  const [inlineTarget, setInlineTarget] = useState(null) // open inline hotspot card
  const [spans, setSpans] = useState([])                 // [{ fieldPath, rect }]
  const highSeen = useRef(new Set())

  // ─── Realtime subscription + initial fetch ──────────────────────────────
  useEffect(() => {
    if (!clientId) return undefined
    let mounted = true

    const load = async () => {
      try {
        const j = await profileFetch({ action: 'list_clarifications', client_id: clientId, status: 'open' })
        if (mounted) setClarifications(Array.isArray(j.clarifications) ? j.clarifications : [])
      } catch {
        // Non-blocking — overlay simply has no rows to render.
      }
    }
    load()

    // WR-08 — Realtime: kotoiq_clarifications IS in the supabase_realtime
    // publication (per Plan 1).  Supabase realtime postgres_changes only
    // accepts a single `filter:` predicate, so we client-side-filter the
    // payload by agency_id below.  We also include agencyId in the channel
    // name so per-agency subscriptions are isolated at the channel layer.
    // If agencyId is missing the subscription is skipped — better to render
    // nothing than to subscribe with no agency scope at all.
    if (!agencyId) return () => { mounted = false }
    const ch = supabase
      .channel(`kotoiq_clarifications:${agencyId}:${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kotoiq_clarifications', filter: `client_id=eq.${clientId}` },
        (payload) => {
          // WR-08 — drop any payload whose agency_id doesn't match the
          // logged-in agency.  The server-side filter only narrows by
          // client_id; this guard prevents a broadcast from a colliding
          // client_id under a different agency from leaking into the
          // overlay.
          const row = payload.new || payload.old
          if (row && row.agency_id && row.agency_id !== agencyId) return
          if (!mounted) return
          setClarifications((prev) => {
            const arr = [...prev]
            if (payload.eventType === 'INSERT') {
              arr.push(payload.new)
              // HIGH severity + first appearance → modal escalation (D-20)
              if (payload.new.severity === 'high' && !highSeen.current.has(payload.new.id)) {
                highSeen.current.add(payload.new.id)
                setModalTarget(payload.new)
                const newId = payload.new.id
                setTimeout(() => {
                  if (!mounted) return
                  setModalTarget((m) => (m && m.id === newId ? null : m))
                }, 12000)
              }
              return arr.filter((c) => c.status === 'open')
            }
            if (payload.eventType === 'UPDATE') {
              const i = arr.findIndex((c) => c.id === payload.new.id)
              if (i >= 0) arr[i] = payload.new
              return arr.filter((c) => c.status === 'open')
            }
            if (payload.eventType === 'DELETE') {
              return arr.filter((c) => c.id !== payload.old.id)
            }
            return arr.filter((c) => c.status === 'open')
          })
        },
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(ch)
    }
  }, [clientId, agencyId])

  // ─── DOM scan for [data-field-path] spans ───────────────────────────────
  useEffect(() => {
    const update = () => {
      if (typeof document === 'undefined') return
      const nodes = Array.from(document.querySelectorAll('[data-field-path]'))
      setSpans(
        nodes.map((el) => ({
          fieldPath: el.getAttribute('data-field-path'),
          rect: el.getBoundingClientRect(),
        })),
      )
    }
    update()
    window.addEventListener('resize', update)
    // Capture-phase scroll listener fires for ANY scrolling ancestor (including
    // KotoIQShellPage's scroll container) — keeps HotspotDots anchored when the
    // briefing scrolls inside a scrollable shell instead of the window
    // (per UI-SPEC §5.11 hotspot-anchoring contract + 07-08-PLAN Warning 13).
    window.addEventListener('scroll', update, true)
    // Re-scan after 300ms to catch layout settling (briefing fade-in animation)
    const t = setTimeout(update, 300)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      clearTimeout(t)
    }
  }, [clarifications])

  // ─── Group clarifications per field, pick worst severity per field ──────
  const byField = new Map()
  for (const c of clarifications) {
    if (!c?.target_field_path) continue
    const existing = byField.get(c.target_field_path)
    if (existing) existing.push(c)
    else byField.set(c.target_field_path, [c])
  }

  const rankSev = (s) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1)
  const hotspots = spans.flatMap((s) => {
    const group = byField.get(s.fieldPath)
    if (!group || group.length === 0) return []
    const worst = group.reduce((acc, c) => (rankSev(c.severity) > rankSev(acc.severity) ? c : acc), group[0])
    return [{ ...s, clarifications: group, worst }]
  })

  if (typeof document === 'undefined') return null

  return (
    <>
      {/* HotspotDots — portaled to body so they render above everything else.
          position:fixed = viewport-relative, so we use raw getBoundingClientRect
          values directly — adding window.scrollX/Y would double-count scroll
          offset in scrollable shells. */}
      {createPortal(
        hotspots.map((h) => (
          <div
            key={h.fieldPath}
            style={{
              position: 'fixed',
              top: h.rect.top - 3,
              left: h.rect.right - 3,
              zIndex: 55,
              width: 8,
              height: 8,
            }}
          >
            <HotspotDot
              severity={h.worst.severity}
              count={h.clarifications.length}
              onClick={() => setInlineTarget(h)}
            />
          </div>
        )),
        document.body,
      )}

      {/* Inline clarification card — anchored to the clicked hotspot. */}
      {inlineTarget
        ? createPortal(
            <div
              role="dialog"
              aria-label="Clarification"
              style={{
                position: 'fixed',
                top: Math.min(inlineTarget.rect.bottom + 8, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320),
                left: Math.max(16, inlineTarget.rect.left - 60),
                zIndex: 60,
                maxWidth: 420,
              }}
            >
              <ClarificationCard
                clarification={inlineTarget.worst}
                variant="hotspot"
                onAnswer={onAnswer}
                onForward={onForward}
                onSkip={onSkip}
                onClose={() => setInlineTarget(null)}
              />
            </div>,
            document.body,
          )
        : null}

      {/* HIGH-severity modal escalation sheet (D-20) — 12s auto-dismiss. */}
      {modalTarget
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 80,
                maxWidth: 360,
                animation: 'kotoiqBotFadeIn 240ms ease-out',
              }}
            >
              <ClarificationCard
                clarification={modalTarget}
                variant="hotspot"
                onAnswer={onAnswer}
                onForward={onForward}
                onSkip={onSkip}
                onClose={() => setModalTarget(null)}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

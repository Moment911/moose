'use client'
// ── StepShell ───────────────────────────────────────────────────────────────
// Shared chrome for every step in the guided spine (WS7). Enforces the three
// non-negotiables CONTEXT requires of each step:
//   1. a plain-English "what this does" subtitle (no bare acronyms),
//   2. a visible STATUS pill (done / running / waiting on you),
//   3. exactly ONE primary action (passed by the step; rendered by the step
//      itself via the koto CtaButton — StepShell just frames everything).
//
// Built on DESIGN.md koto/* primitives + tokens (NOT the legacy theme).

import { Loader2, CheckCircle2, Clock } from 'lucide-react'
import { t } from '../../../styles/koto-tokens'
import { SectionHeader, EducationalNote } from '../../ui/koto'

// Status pill — the "done / running / waiting on you" signal every step shows.
export function StatusPill({ status }) {
  const MAP = {
    done:    { label: 'Done',           color: t.success, bg: 'rgba(13,158,110,.10)', Icon: CheckCircle2 },
    running: { label: 'Running',        color: t.pink,    bg: 'rgba(203,28,107,.10)', Icon: Loader2, spin: true },
    waiting: { label: 'Waiting on you', color: t.warning, bg: 'rgba(217,119,6,.10)',  Icon: Clock },
  }
  const v = MAP[status] || MAP.waiting
  const Icon = v.Icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: t.rPill,
      background: v.bg, color: v.color,
      fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
      letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <Icon size={12} className={v.spin ? 'animate-spin' : undefined} />
      {v.label}
    </span>
  )
}

/**
 * Frame for a step.
 *
 * Props:
 *  - stepNumber  number      — 1..6
 *  - title       string
 *  - accent      string      — italic pink accent word in the title (optional)
 *  - status      'done'|'running'|'waiting'
 *  - subtitle    ReactNode   — the plain-English "what this does" line (REQUIRED)
 *  - noteId      string      — localStorage dismiss id for the EducationalNote
 *  - noteTitle   string      — eyebrow for the note (default "Why this matters")
 *  - note        ReactNode   — gloss any acronyms here (AEO/GEO) — optional
 *  - children    ReactNode   — the step body + its single primary action
 */
export default function StepShell({
  stepNumber, title, accent, status = 'waiting',
  subtitle, noteId, noteTitle, note, children,
}) {
  return (
    <div style={{
      background: t.white, border: `1px solid ${t.line}`, borderRadius: t.rCard,
      padding: '28px 32px', boxShadow: t.sCard, fontFamily: t.fontBody,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 28, height: 28, borderRadius: t.rPill, background: t.navy, color: t.warm,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: t.fontBody, fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>{stepNumber}</span>
          <SectionHeader title={title} accent={accent} style={{ marginBottom: 0 }} />
        </div>
        <StatusPill status={status} />
      </div>

      {subtitle && (
        <p style={{ margin: '0 0 16px 40px', fontSize: 13.5, color: t.muted, lineHeight: 1.55, maxWidth: 640 }}>
          {subtitle}
        </p>
      )}

      {note && (
        <EducationalNote noteId={noteId} title={noteTitle}>
          {note}
        </EducationalNote>
      )}

      {children}
    </div>
  )
}

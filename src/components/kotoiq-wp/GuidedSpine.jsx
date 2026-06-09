'use client'
// ── GuidedSpine (WS7) ───────────────────────────────────────────────────────
// Phase 11 Plan 11-06. The linear 6-step onboarding spine that assembles
// everything from 11-01..11-05 into a self-explanatory flow at
// /kotoiq-wp?shell=guided:
//
//   1. Connected        — pair status (koto_wp_sites.shim_version==='v4' + connected)
//   2. Your site today  — 11-02 baseline inventory + live run_all_status scan
//   3. Who you're up against — 11-04 CityPicker → competitor discovery
//   4. Your gaps        — 11-05 score_grid bucketed outcome report + 11-03 ServiceChips
//   5. Your plan        — ranked build order → Page Factory build (approval gate)
//   6. Live + cited     — published pages + AEO citation status (surface only)
//
// Every step has: a plain-English "what this does" subtitle (no bare acronyms —
// AEO/GEO are glossed), exactly ONE primary action, and a visible status
// (done / running / waiting on you). Long background scans surface live status
// from run_all_status polling so they never look frozen.
//
// Built ENTIRELY on DESIGN.md koto/* primitives + koto-tokens (navy #201b51 /
// pink #cb1c6b / cream #faf9f6) — NOT the legacy #111/FH/FB theme (Pitfall 6).
// Reference implementation: src/components/kotoiq/AEOVisibilityTab.jsx.
//
// This view is ADDITIVE — it does not replace or disturb FleetView or the
// existing power-user tabs (those stay reachable via the shell tab bar above).

import { useState, useEffect, useCallback, useRef } from 'react'
import { Compass } from 'lucide-react'
import { t } from '../../styles/koto-tokens'
import {
  Eyebrow,
  WorkflowStepper,
  KotoKeyframes,
} from '../ui/koto'

import StepConnected from './steps/StepConnected'
import StepSiteToday from './steps/StepSiteToday'
import StepCompetitors from './steps/StepCompetitors'
import StepGaps from './steps/StepGaps'
import StepPlan from './steps/StepPlan'
import StepLiveCited from './steps/StepLiveCited'

// The 6 steps, in spine order. `label`/`sub` drive the WorkflowStepper rail.
const STEPS = [
  { key: 'connected',   label: 'Connected',      sub: 'Pairing' },
  { key: 'site',        label: 'Your site today', sub: 'Inventory' },
  { key: 'competitors', label: "Who you're up against", sub: 'Rivals' },
  { key: 'gaps',        label: 'Your gaps',      sub: 'Opportunities' },
  { key: 'plan',        label: 'Your plan',      sub: 'Build order' },
  { key: 'live',        label: 'Live + cited',   sub: 'Published' },
]

export default function GuidedSpine({ clientId, agencyId }) {
  // ── Which step the user is viewing ────────────────────────────────────────
  const [current, setCurrent] = useState(0)

  // ── Cross-step state the spine owns (so steps share one source of truth) ──
  // The run id for the post-pair scan (step 2 polls run_all_status for it).
  const [runId, setRunId] = useState(null)
  // City targeting (step 3) — shared with the gap grid (step 4).
  const [selectedState, setSelectedState] = useState('')
  const [selectedCities, setSelectedCities] = useState(() => new Set())
  // Confirmed services (step 4 ServiceChips) — gate the gap scoring.
  const [confirmedServices, setConfirmedServices] = useState(null)

  const goNext = useCallback(() => setCurrent(c => Math.min(c + 1, STEPS.length - 1)), [])
  const goTo = useCallback((i) => setCurrent(i), [])

  // ── Live scan status (run_all_status polling) ─────────────────────────────
  // Owned here so the stepper rail can mark step 2 "running" while the
  // background audit chain is mid-flight, no matter which step is in view.
  const [scanStatus, setScanStatus] = useState(null) // { status, wave, total_waves, completed_actions, failed_actions, completed_at }
  const pollRef = useRef(null)
  useEffect(() => {
    if (!runId) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const r = await fetch('/api/kotoiq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'run_all_status', run_id: runId, agency_id: agencyId }),
        })
        const d = await r.json()
        if (cancelled || d.error) return
        setScanStatus(d)
        // Stop polling once the chain reports done/error.
        if (d.status && d.status !== 'running') {
          clearInterval(pollRef.current)
        }
      } catch {
        // Non-blocking — keep the last-known status; a transient fetch error
        // shouldn't make a long scan look broken.
      }
    }
    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => { cancelled = true; clearInterval(pollRef.current) }
  }, [runId, agencyId])

  const scanRunning = scanStatus?.status === 'running'

  const shared = {
    clientId, agencyId,
    goNext, goTo,
    runId, setRunId,
    selectedState, setSelectedState,
    selectedCities, setSelectedCities,
    confirmedServices, setConfirmedServices,
    scanStatus, scanRunning,
  }

  if (!clientId) {
    return (
      <div style={{ padding: '64px 40px', fontFamily: t.fontBody, textAlign: 'center' }}>
        <KotoKeyframes />
        <Compass size={28} color={t.muted} style={{ marginBottom: 14 }} />
        <div style={{
          fontFamily: t.fontDisplay, fontSize: 32, color: t.text,
          letterSpacing: '.02em', textTransform: 'uppercase',
        }}>Pick a client to begin</div>
        <p style={{ margin: '8px auto 0', maxWidth: 420, fontSize: 13, color: t.muted, lineHeight: 1.6 }}>
          The guided setup walks one client's site from connected to live + cited.
          Choose a client from the switcher to start.
        </p>
      </div>
    )
  }

  // The stepper marks completed/running visually. We pass `current` as the
  // active step; step 2 reflects scan-running independently via its own status.
  return (
    <div style={{ fontFamily: t.fontBody, padding: '28px 40px 64px', maxWidth: 1100, margin: '0 auto' }}>
      <KotoKeyframes />

      {/* ── Title + rail ─────────────────────────────────────────────────── */}
      <Eyebrow style={{ marginBottom: 10 }}>Guided setup · 6 steps</Eyebrow>
      <h1 style={{
        margin: '0 0 4px', fontFamily: t.fontDisplay, fontSize: 40, color: t.text,
        letterSpacing: '.02em', lineHeight: 1,
      }}>
        From connected to{' '}
        <em style={{ fontFamily: t.fontAccent, fontStyle: 'italic', color: t.pink, fontWeight: 400 }}>cited</em>
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: t.muted, lineHeight: 1.55, maxWidth: 620 }}>
        Six steps. We scan your site, confirm what you offer and where, find the gaps your
        competitors already rank for, then build and publish the pages that close them.
      </p>

      {/* Clickable stepper rail — steps before the current one are "done", the
          current is active. Step 2 also shows running if the scan is live. */}
      <div style={{
        background: t.white, border: `1px solid ${t.line}`, borderRadius: t.rCard,
        padding: '20px 24px', marginBottom: 28, boxShadow: t.sHair,
      }}>
        <ClickableStepper steps={STEPS} current={current} onSelect={goTo} scanRunning={scanRunning} />
      </div>

      {/* ── Active step ──────────────────────────────────────────────────── */}
      <div>
        {current === 0 && <StepConnected {...shared} />}
        {current === 1 && <StepSiteToday {...shared} />}
        {current === 2 && <StepCompetitors {...shared} />}
        {current === 3 && <StepGaps {...shared} />}
        {current === 4 && <StepPlan {...shared} />}
        {current === 5 && <StepLiveCited {...shared} />}
      </div>
    </div>
  )
}

// ── Clickable stepper ───────────────────────────────────────────────────────
// Thin wrapper over the DESIGN.md Pattern 7 WorkflowStepper that lets the user
// jump between steps and overlays clickable hotspots. The underlying primitive
// renders the dots/connectors/labels; we add navigation + a scan-running hint
// on step 2 so the rail itself communicates live status.
function ClickableStepper({ steps, current, onSelect, scanRunning }) {
  // Annotate step 2's sub-label when a scan is live so the rail shows it.
  const railSteps = steps.map((s, i) => (
    i === 1 && scanRunning ? { ...s, sub: 'Scanning…' } : s
  ))
  return (
    <div style={{ position: 'relative' }}>
      <WorkflowStepper steps={railSteps} current={current} />
      {/* Invisible clickable columns aligned to each step for navigation. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => onSelect(i)}
            aria-label={`Go to step ${i + 1}: ${s.label}`}
            style={{
              flex: i < steps.length - 1 ? 1.5 : 1,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}

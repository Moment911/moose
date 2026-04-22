"use client"
import { GRN } from '../../lib/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Trainer Phase 2 — TrainerStatusStrip.
//
// 6 dots showing chain progress: Baseline → Roadmap → Playbook → Workout →
// Food → Meals.  Green = done, gray = pending, pulsing amber = in progress
// (driven by `pendingStep` — the step whose generator is currently running).
// ─────────────────────────────────────────────────────────────────────────────

const BRD = '#e5e7eb'
const GRY5 = '#6b7280'
const AMB = '#f59e0b'

const STEPS = [
  { key: 'baseline', label: 'Baseline' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'playbook', label: 'Playbook' },
  { key: 'workout', label: 'Workout' },
  { key: 'food_prefs', label: 'Food' },
  { key: 'meals', label: 'Meals' },
]

export default function TrainerStatusStrip({ done = {}, pendingKey = null }) {
  return (
    <>
      <style>{`@keyframes kotoPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.25)}}`}</style>
      <div
        role="status"
        aria-label="Plan progress"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: '#fff',
          border: `1px solid ${BRD}`,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          color: GRY5,
          whiteSpace: 'nowrap',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {STEPS.map((s, i) => {
          const isDone = !!done[s.key]
          const isPending = pendingKey === s.key
          const color = isDone ? GRN : isPending ? AMB : '#d1d5db'
          return (
            <span
              key={s.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: isDone ? GRN : isPending ? AMB : GRY5,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: isPending ? `0 0 0 3px ${AMB}20` : 'none',
                  animation: isPending ? 'kotoPulse 1.2s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }}
              />
              <span style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.label}</span>
              {i < STEPS.length - 1 && (
                <span style={{ color: '#d1d5db', margin: '0 2px' }}>›</span>
              )}
            </span>
          )
        })}
      </div>
    </>
  )
}
